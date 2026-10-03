#!/usr/bin/env python3
"""Advisory local task claims shared by Git worktrees; no filesystem enforcement.

All command results are JSON. The catalog lives in the current checkout;
reservations and evidence live in the Git common directory, never in Git.
Local catalog edits require explicit coordinator acceptance after initialization;
an older worktree cannot silently replace the accepted catalog.
Claims never expire automatically. A coordinator may explicitly recover an
abandoned session with a rationale. This is cooperative coordination, not ACLs.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time
from typing import Any, Iterator
import uuid


ROLES = ("coordinator", "frontend", "backend", "agent", "devops", "qa")
DATABASE_NAME = "livingforma-coordination.sqlite3"
STALE_AFTER_SECONDS = 900
IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")


class CoordinationError(Exception):
    def __init__(self, code: str, message: str, **details: Any):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


def encoded(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def timestamp(value: float | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, timezone.utc).isoformat(timespec="seconds")


def git_value(repo: Path, argument: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", argument],
        text=True, capture_output=True, check=False,
    )
    if result.returncode:
        raise CoordinationError("NOT_GIT_REPOSITORY", "Run in a Git checkout or supply --repo PATH.")
    return result.stdout.strip()


def validate_path(root: Path, path: Any, *, scope: bool = False) -> str:
    """Accept explicit POSIX paths, including future files, but no symlinks."""
    if not isinstance(path, str) or not path or len(path) > 4096:
        raise CoordinationError("PATH_INVALID", "Paths must be nonempty repo-relative strings.")
    if path.startswith("/") or "\\" in path or any(ord(c) < 32 for c in path):
        raise CoordinationError("PATH_INVALID", "Absolute paths, backslashes and control characters are forbidden.")
    prefix = scope and path.endswith("/")
    value = path[:-1] if path.endswith("/") else path
    parts = value.split("/")
    if any(part in ("", ".", "..") for part in parts) or any(c in value for c in "*?[]"):
        raise CoordinationError("PATH_INVALID", "Paths cannot contain traversal, empty components or glob patterns.")
    # Avoid Windows absolute paths too, even when the coordinator runs on macOS.
    if re.match(r"^[A-Za-z]:", value) or parts[0].casefold() == ".git":
        raise CoordinationError("PATH_INVALID", "Git administrative paths and drive paths are forbidden.")
    current = root
    for part in parts:
        current = current / part
        if current.is_symlink():
            raise CoordinationError("PATH_INVALID", "A path or its ancestor is a symlink.", path=path)
    if prefix and current.exists() and not current.is_dir():
        raise CoordinationError("PATH_INVALID", "A directory prefix currently names a file.", path=path)
    return value + ("/" if prefix else "")


def path_key(path: str) -> tuple[str, ...]:
    # Conservatively reject aliases on the common case-insensitive macOS volume.
    return tuple(component.casefold() for component in path.rstrip("/").split("/"))


def overlaps(left: str, right: str) -> bool:
    a, b = path_key(left), path_key(right)
    return a[:len(b)] == b or b[:len(a)] == a


def includes(scope: str, path: str) -> bool:
    a, b = path_key(scope), path_key(path)
    return a == b or (scope.endswith("/") and b[:len(a)] == a)


def critical_spec(task: dict[str, Any]) -> str:
    # Acceptance determines what completion evidence means; display text does not.
    value = {key: task[key] for key in ("id", "role", "paths", "depends_on")}
    value["acceptance"] = task.get("acceptance", [])
    return hashlib.sha256(encoded(value).encode()).hexdigest()


def catalog_digest(tasks: list[dict[str, Any]]) -> str:
    return hashlib.sha256(encoded({"version": 1, "tasks": tasks}).encode()).hexdigest()


def read_catalog(root: Path) -> list[dict[str, Any]]:
    name = validate_path(root, ".codex/coordination.json")
    try:
        data = json.loads((root / name).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise CoordinationError("CATALOG_INVALID", "Cannot read valid .codex/coordination.json.") from exc
    if not isinstance(data, dict) or type(data.get("version")) is not int or data["version"] != 1:
        raise CoordinationError("CATALOG_INVALID", "Catalog version must be integer 1.")
    if not isinstance(data.get("tasks"), list):
        raise CoordinationError("CATALOG_INVALID", "Catalog tasks must be an array.")
    tasks, ids = [], set()
    for raw in data["tasks"]:
        if not isinstance(raw, dict):
            raise CoordinationError("CATALOG_INVALID", "Every task must be an object.")
        task = dict(raw)  # Preserve acceptance, notes and future JSON metadata.
        task_id = task.get("id")
        if not isinstance(task_id, str) or not IDENTIFIER.fullmatch(task_id) or task_id in ids:
            raise CoordinationError("CATALOG_INVALID", "Task IDs must be unique safe identifiers.")
        if task.get("role") not in ROLES:
            raise CoordinationError("CATALOG_INVALID", "Task role is not supported.", task=task_id)
        if not isinstance(task.get("title"), str) or not task["title"].strip():
            raise CoordinationError("CATALOG_INVALID", "Task title must be nonempty.", task=task_id)
        paths = task.get("paths")
        if not isinstance(paths, list) or not paths:
            raise CoordinationError("CATALOG_INVALID", "Task paths must be a nonempty array.", task=task_id)
        task["paths"] = [validate_path(root, path, scope=True) for path in paths]
        if len({path_key(path) for path in task["paths"]}) != len(paths):
            raise CoordinationError("CATALOG_INVALID", "Task paths cannot contain duplicate aliases.", task=task_id)
        deps = task.get("depends_on")
        if not isinstance(deps, list) or any(not isinstance(dep, str) for dep in deps) or len(set(deps)) != len(deps):
            raise CoordinationError("CATALOG_INVALID", "Task depends_on must be an array of unique IDs.", task=task_id)
        if "acceptance" in task and (
            not isinstance(task["acceptance"], list)
            or any(not isinstance(item, str) for item in task["acceptance"])
        ):
            raise CoordinationError("CATALOG_INVALID", "Task acceptance must be an array of strings.", task=task_id)
        if "notes" in task and not isinstance(task["notes"], str):
            raise CoordinationError("CATALOG_INVALID", "Task notes must be a string.", task=task_id)
        ids.add(task_id)
        tasks.append(task)
    by_id = {task["id"]: task for task in tasks}
    visiting, visited = set(), set()

    def visit(task_id: str) -> None:
        if task_id in visiting:
            raise CoordinationError("CATALOG_INVALID", "Task dependencies contain a cycle.", task=task_id)
        if task_id in visited:
            return
        visiting.add(task_id)
        for dependency in by_id[task_id]["depends_on"]:
            if dependency not in by_id:
                raise CoordinationError("CATALOG_INVALID", "A dependency is absent from the catalog.", task=task_id)
            visit(dependency)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in by_id:
        visit(task_id)
    return tasks


class Coordinator:
    def __init__(self, repo: str | Path):
        supplied = Path(repo).absolute()
        self.root = Path(git_value(supplied, "--show-toplevel")).resolve()
        common = Path(git_value(self.root, "--git-common-dir"))
        self.common = (self.root / common).resolve() if not common.is_absolute() else common.resolve()
        self.database = self.common / DATABASE_NAME
        if self.database.is_symlink():
            raise CoordinationError("DATABASE_ERROR", "Coordination database must not be a symlink.")
        self.connection = sqlite3.connect(self.database, timeout=10, isolation_level=None)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA busy_timeout=10000")
        self.connection.execute("PRAGMA foreign_keys=ON")
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, role TEXT NOT NULL, status TEXT NOT NULL,
                created_at REAL NOT NULL, heartbeat_at REAL NOT NULL,
                checkout TEXT NOT NULL, retired_at REAL
            );
            DROP INDEX IF EXISTS one_active_role;
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, role TEXT NOT NULL, spec TEXT NOT NULL,
                critical TEXT NOT NULL, position INTEGER NOT NULL,
                present INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'available',
                completed_at REAL, completed_by TEXT, evidence TEXT
            );
            CREATE TABLE IF NOT EXISTS claims (
                task_id TEXT PRIMARY KEY REFERENCES tasks(id),
                session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),
                paths TEXT NOT NULL, critical TEXT NOT NULL, claimed_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY, at REAL NOT NULL, kind TEXT NOT NULL,
                session_id TEXT, task_id TEXT, details TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS catalog_state (
                id INTEGER PRIMARY KEY CHECK(id=1), digest TEXT NOT NULL,
                revision INTEGER NOT NULL, accepted_at REAL NOT NULL,
                accepted_by TEXT, reason TEXT NOT NULL
            );
        """)
        self.migrate_catalog_state()

    def close_database(self) -> None:
        self.connection.close()

    @contextmanager
    def transaction(self) -> Iterator[None]:
        self.connection.execute("BEGIN IMMEDIATE")
        try:
            yield
        except BaseException:
            self.connection.execute("ROLLBACK")
            raise
        else:
            self.connection.execute("COMMIT")

    def event(self, kind: str, session: str | None = None, task: str | None = None, **details: Any) -> None:
        self.connection.execute(
            "INSERT INTO events(at,kind,session_id,task_id,details) VALUES (?,?,?,?,?)",
            (time.time(), kind, session, task, encoded(details)),
        )

    def catalog_json(self) -> dict[str, Any] | None:
        row = self.connection.execute("SELECT * FROM catalog_state WHERE id=1").fetchone()
        if row is None:
            return None
        return {
            "digest": row["digest"], "revision": row["revision"],
            "accepted_at": timestamp(row["accepted_at"]),
            "accepted_by": row["accepted_by"], "reason": row["reason"],
        }

    def record_catalog(self, tasks: list[dict[str, Any]], session_id: str | None, reason: str, revision: int) -> None:
        self.connection.execute(
            "INSERT INTO catalog_state VALUES (1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET "
            "digest=excluded.digest,revision=excluded.revision,accepted_at=excluded.accepted_at,"
            "accepted_by=excluded.accepted_by,reason=excluded.reason",
            (catalog_digest(tasks), revision, time.time(), session_id, reason),
        )

    def migrate_catalog_state(self) -> None:
        # Upgrade an existing pre-digest database from its stored snapshot, never
        # from the caller's potentially older checkout. Completion stays intact.
        with self.transaction():
            if self.catalog_json() is not None:
                return
            stored = self.connection.execute("SELECT * FROM tasks WHERE present=1 ORDER BY position").fetchall()
            if not stored:
                return
            tasks = [json.loads(row["spec"]) for row in stored]
            for row, task in zip(stored, tasks):
                fingerprint = critical_spec(task)
                self.connection.execute("UPDATE tasks SET critical=? WHERE id=?", (fingerprint, row["id"]))
                self.connection.execute("UPDATE claims SET critical=? WHERE task_id=?", (fingerprint, row["id"]))
            self.record_catalog(tasks, None, "Migrated stored catalog; no checkout changes accepted", 1)
            self.event("catalog_migrated", digest=catalog_digest(tasks), revision=1)

    def require_catalog(self, tasks: list[dict[str, Any]]) -> None:
        accepted, local = self.catalog_json(), catalog_digest(tasks)
        if accepted is None:
            # The first valid catalog establishes the empty local coordination DB.
            self.sync_catalog(tasks)
            self.record_catalog(tasks, None, "Initial valid catalog", 1)
            self.event("catalog_initialized", digest=local, revision=1)
        elif accepted["digest"] != local:
            raise CoordinationError(
                "CATALOG_STALE", "Local catalog differs from the accepted catalog; coordinator sync-catalog is required.",
                accepted_digest=accepted["digest"], local_digest=local, revision=accepted["revision"],
            )

    def accept_catalog(self, session_id: str, reason: str, expected_digest: str) -> dict[str, Any]:
        reason, tasks = self.require_text(reason, "Catalog sync reason"), read_catalog(self.root)
        with self.transaction():
            actor = self.active_session(session_id)
            if actor["role"] != "coordinator":
                raise CoordinationError("ROLE_REQUIRED", "Catalog sync requires an active coordinator session.")
            accepted = self.catalog_json()
            if accepted is None:
                raise CoordinationError(
                    "CATALOG_UNINITIALIZED", "Run status with a valid initial catalog, then claim its catalog-owning coordinator task.",
                )
            claim = self.connection.execute("SELECT * FROM claims WHERE session_id=?", (session_id,)).fetchone()
            if claim is None:
                raise CoordinationError("CATALOG_CLAIM_REQUIRED", "Coordinator must already hold a task covering .codex/coordination.json.")
            registry = self.task_row(claim["task_id"])
            stored_task = json.loads(registry["spec"])
            if (registry["role"] != "coordinator" or claim["critical"] != registry["critical"]
                    or registry["critical"] != critical_spec(stored_task)
                    or json.loads(claim["paths"]) != stored_task["paths"]):
                raise CoordinationError("CLAIM_MISMATCH", "Reservation does not match its accepted task fingerprint and paths.",
                                        task=claim["task_id"])
            if not any(includes(path, ".codex/coordination.json") for path in json.loads(claim["paths"])):
                raise CoordinationError("CATALOG_CLAIM_REQUIRED", "Held task does not cover .codex/coordination.json.",
                                        task=claim["task_id"])
            current = accepted["digest"]
            if expected_digest != current:
                raise CoordinationError("CATALOG_CAS_FAILED", "Accepted catalog changed or the expected digest is incorrect.",
                                        accepted_digest=current, expected_digest=expected_digest)
            local = catalog_digest(tasks)
            self.sync_catalog(tasks)  # Active task/dependency/acceptance guards apply.
            revision = accepted["revision"] + 1 if local != current else accepted["revision"]
            self.record_catalog(tasks, session_id, reason, revision)
            self.touch(session_id)
            self.event("catalog_synced", session=session_id, previous_digest=current,
                       digest=local, revision=revision, reason=reason)
            return {"accepted": True, "previous_digest": current, "catalog": self.catalog_json()}

    def sync_catalog(self, tasks: list[dict[str, Any]]) -> None:
        by_id = {task["id"]: task for task in tasks}
        existing = {row["id"]: row for row in self.connection.execute("SELECT * FROM tasks")}
        revised = {
            task["id"] for task in tasks
            if task["id"] in existing and existing[task["id"]]["critical"] != critical_spec(task)
        }
        affected = set(revised)
        while True:
            descendants = {
                task["id"] for task in tasks if any(dep in affected for dep in task["depends_on"])
            }
            if descendants <= affected:
                break
            affected.update(descendants)
        for claim in self.connection.execute("SELECT task_id,critical FROM claims"):
            task = by_id.get(claim["task_id"])
            if task is None or critical_spec(task) != claim["critical"] or task["id"] in affected:
                raise CoordinationError(
                    "CATALOG_CONFLICT", "An active task or dependency changed role, paths, dependencies or acceptance, or was removed.",
                    task=claim["task_id"],
                )
        self.connection.execute("UPDATE tasks SET present=0")
        for position, task in enumerate(tasks):
            task_id, fingerprint = task["id"], critical_spec(task)
            old = existing.get(task_id)
            if old is None:
                self.connection.execute(
                    "INSERT INTO tasks(id,role,spec,critical,position,present) VALUES (?,?,?,?,?,1)",
                    (task_id, task["role"], encoded(task), fingerprint, position),
                )
            else:
                self.connection.execute(
                    "UPDATE tasks SET role=?,spec=?,critical=?,position=?,present=1 WHERE id=?",
                    (task["role"], encoded(task), fingerprint, position, task_id),
                )
                if task_id in affected:
                    # Changed work must earn fresh evidence before unlocking dependencies.
                    self.connection.execute(
                        "UPDATE tasks SET status='available',completed_at=NULL,completed_by=NULL,evidence=NULL WHERE id=?",
                        (task_id,),
                    )
                    self.event("task_revised", task=task_id)

    def active_session(self, session_id: str) -> sqlite3.Row:
        row = self.connection.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        if row is None:
            raise CoordinationError("SESSION_NOT_FOUND", "Session does not exist.")
        if row["status"] != "active":
            raise CoordinationError("SESSION_CLOSED", "Session is retired; create a new session.")
        return row

    def touch(self, session_id: str) -> None:
        self.connection.execute("UPDATE sessions SET heartbeat_at=? WHERE id=?", (time.time(), session_id))

    def session_json(self, row: sqlite3.Row) -> dict[str, Any]:
        idle = max(0, int(time.time() - row["heartbeat_at"]))
        claim = self.connection.execute("SELECT task_id FROM claims WHERE session_id=?", (row["id"],)).fetchone()
        return {
            "id": row["id"], "role": row["role"], "status": row["status"],
            "created_at": timestamp(row["created_at"]), "heartbeat_at": timestamp(row["heartbeat_at"]),
            "retired_at": timestamp(row["retired_at"]), "checkout": row["checkout"],
            "idle_seconds": idle, "stale": row["status"] == "active" and idle >= STALE_AFTER_SECONDS,
            "task_id": claim["task_id"] if claim else None,
        }

    def task_json(self, row: sqlite3.Row) -> dict[str, Any]:
        claim = self.connection.execute("SELECT * FROM claims WHERE task_id=?", (row["id"],)).fetchone()
        result = {
            "task": json.loads(row["spec"]), "status": "claimed" if claim else row["status"],
            "session_id": claim["session_id"] if claim else None,
            "claimed_at": timestamp(claim["claimed_at"]) if claim else None,
            "completed_at": timestamp(row["completed_at"]),
            "completed_by": row["completed_by"], "evidence": row["evidence"],
        }
        return result

    def session(self, role: str) -> dict[str, Any]:
        if role not in ROLES:
            raise CoordinationError("ROLE_INVALID", "Choose one of the supported roles.", roles=list(ROLES))
        with self.transaction():
            session_id, now = str(uuid.uuid4()), time.time()
            self.connection.execute(
                "INSERT INTO sessions(id,role,status,created_at,heartbeat_at,checkout) VALUES (?,?,'active',?,?,?)",
                (session_id, role, now, now, str(self.root)),
            )
            self.event("session_started", session=session_id, role=role)
            return {"session": self.session_json(self.active_session(session_id))}

    def status(self) -> dict[str, Any]:
        catalog_error = None
        local_digest = None
        with self.transaction():
            # Still show reservations if a changed/broken catalog requires recovery.
            self.connection.execute("SAVEPOINT catalog_sync")
            try:
                tasks = read_catalog(self.root)
                local_digest = catalog_digest(tasks)
                self.require_catalog(tasks)
            except CoordinationError as exc:
                self.connection.execute("ROLLBACK TO catalog_sync")
                catalog_error = {"code": exc.code, "message": exc.message, **exc.details}
            finally:
                self.connection.execute("RELEASE catalog_sync")
            sessions = [self.session_json(row) for row in self.connection.execute("SELECT * FROM sessions ORDER BY created_at")]
            tasks = [self.task_json(row) for row in self.connection.execute("SELECT * FROM tasks WHERE present=1 ORDER BY position")]
            return {
                "repo": str(self.root), "database": str(self.database), "advisory": True,
                "automatic_expiry": False, "stale_after_seconds": STALE_AFTER_SECONDS,
                "catalog": self.catalog_json(), "local_catalog_digest": local_digest,
                "catalog_error": catalog_error, "sessions": sessions, "tasks": tasks,
            }

    def task_row(self, task_id: str) -> sqlite3.Row:
        row = self.connection.execute("SELECT * FROM tasks WHERE id=? AND present=1", (task_id,)).fetchone()
        if row is None:
            raise CoordinationError("TASK_NOT_FOUND", "Task is absent from the current catalog.", task=task_id)
        return row

    def validate_claim(self, session: sqlite3.Row, task: sqlite3.Row) -> None:
        task_id = task["id"]
        if task["role"] != session["role"]:
            raise CoordinationError("ROLE_MISMATCH", "Task belongs to a different role.", task=task_id)
        if task["status"] == "completed":
            raise CoordinationError("TASK_COMPLETE", "Task is already complete.", task=task_id)
        owner = self.connection.execute("SELECT session_id FROM claims WHERE task_id=?", (task_id,)).fetchone()
        if owner:
            raise CoordinationError("TASK_CLAIMED", "Task already has a claimant.", task=task_id, session_id=owner["session_id"])
        existing = self.connection.execute("SELECT task_id FROM claims WHERE session_id=?", (session["id"],)).fetchone()
        if existing:
            raise CoordinationError("SESSION_HAS_CLAIM", "Finish or release the current task before claiming another.", task=existing["task_id"])
        same_role = self.connection.execute(
            "SELECT claims.task_id,claims.session_id FROM claims JOIN tasks ON tasks.id=claims.task_id WHERE tasks.role=?",
            (session["role"],),
        ).fetchone()
        if same_role:
            raise CoordinationError("ROLE_CLAIMED", "Another session already holds a task for this role.",
                                    task=same_role["task_id"], session_id=same_role["session_id"])
        spec = json.loads(task["spec"])
        pending = [dep for dep in spec["depends_on"] if self.task_row(dep)["status"] != "completed"]
        if pending:
            raise CoordinationError("DEPENDENCIES_PENDING", "Task dependencies are not complete.", pending=pending)
        for other in self.connection.execute("SELECT task_id,paths FROM claims"):
            for path in spec["paths"]:
                for held in json.loads(other["paths"]):
                    if overlaps(path, held):
                        raise CoordinationError("PATH_CONFLICT", "An active task reserves an overlapping path.",
                                                task=other["task_id"], path=path, reserved_path=held)

    def reserve(self, session_id: str, task: sqlite3.Row) -> dict[str, Any]:
        spec = json.loads(task["spec"])
        self.connection.execute(
            "INSERT INTO claims(task_id,session_id,paths,critical,claimed_at) VALUES (?,?,?,?,?)",
            (task["id"], session_id, encoded(spec["paths"]), task["critical"], time.time()),
        )
        self.touch(session_id)
        self.event("task_claimed", session=session_id, task=task["id"], checkout=str(self.root))
        return {"available": True, **self.task_json(self.task_row(task["id"]))}

    def claim(self, session_id: str, task_id: str) -> dict[str, Any]:
        tasks = read_catalog(self.root)
        with self.transaction():
            self.require_catalog(tasks)
            session, task = self.active_session(session_id), self.task_row(task_id)
            self.validate_claim(session, task)
            return self.reserve(session_id, task)

    def next(self, session_id: str) -> dict[str, Any]:
        tasks = read_catalog(self.root)
        with self.transaction():
            self.require_catalog(tasks)
            session = self.active_session(session_id)
            held = self.connection.execute("SELECT task_id FROM claims WHERE session_id=?", (session_id,)).fetchone()
            if held:
                raise CoordinationError("SESSION_HAS_CLAIM", "Resume, finish or release the current task first.", task=held["task_id"])
            skipped = []
            for task in self.connection.execute("SELECT * FROM tasks WHERE present=1 AND role=? ORDER BY position", (session["role"],)).fetchall():
                try:
                    self.validate_claim(session, task)
                except CoordinationError as exc:
                    skipped.append({"task_id": task["id"], "reason": exc.code, **exc.details})
                    continue
                return self.reserve(session_id, task)
            self.touch(session_id)
            return {"available": False, "task": None, "skipped": skipped}

    def owner(self, session_id: str, task_id: str) -> sqlite3.Row:
        self.active_session(session_id)
        claim = self.connection.execute("SELECT * FROM claims WHERE task_id=?", (task_id,)).fetchone()
        if claim is None or claim["session_id"] != session_id:
            raise CoordinationError("NOT_OWNER", "Only the active claimant can finish or release this task.", task=task_id)
        return claim

    def check(self, session_id: str, path: str) -> dict[str, Any]:
        path = validate_path(self.root, path)
        with self.transaction():
            session = self.active_session(session_id)
            claim = self.connection.execute("SELECT * FROM claims WHERE session_id=?", (session_id,)).fetchone()
            covered = claim is not None and any(includes(scope, path) for scope in json.loads(claim["paths"]))
            repair = covered and session["role"] == "coordinator" and path == ".codex/coordination.json"
            catalog_error = None
            if repair:
                # A catalog owner needs to repair its own file before accepting it.
                # This exception does not authorize other files or publish changes.
                self.connection.execute("SAVEPOINT repair_check")
                try:
                    self.require_catalog(read_catalog(self.root))
                except CoordinationError as exc:
                    self.connection.execute("ROLLBACK TO repair_check")
                    catalog_error = {"code": exc.code, "message": exc.message, **exc.details}
                finally:
                    self.connection.execute("RELEASE repair_check")
            else:
                self.require_catalog(read_catalog(self.root))
            if not covered:
                raise CoordinationError("OUTSIDE_CLAIM", "This session has no claim covering the requested path.", path=path)
            self.touch(session_id)
            return {"allowed": True, "advisory": True, "path": path, "task_id": claim["task_id"],
                    "session_id": session_id, "catalog_current": catalog_error is None, "catalog_error": catalog_error}

    @staticmethod
    def require_text(value: str, label: str) -> str:
        if not isinstance(value, str) or not value.strip() or len(value) > 20000:
            raise CoordinationError("TEXT_REQUIRED", f"{label} must be nonblank and at most 20000 characters.")
        return value.strip()

    def finish(self, session_id: str, task_id: str, evidence: str) -> dict[str, Any]:
        evidence, tasks = self.require_text(evidence, "Evidence"), read_catalog(self.root)
        with self.transaction():
            self.require_catalog(tasks)
            self.owner(session_id, task_id)
            self.connection.execute(
                "UPDATE tasks SET status='completed',completed_at=?,completed_by=?,evidence=? WHERE id=?",
                (time.time(), session_id, evidence, task_id),
            )
            self.connection.execute("DELETE FROM claims WHERE task_id=?", (task_id,))
            self.touch(session_id)
            self.event("task_completed", session=session_id, task=task_id, evidence=evidence)
            return self.task_json(self.task_row(task_id))

    def release(self, session_id: str, task_id: str, reason: str) -> dict[str, Any]:
        reason = self.require_text(reason, "Reason")
        with self.transaction():
            self.owner(session_id, task_id)
            self.connection.execute("DELETE FROM claims WHERE task_id=?", (task_id,))
            self.touch(session_id)
            self.event("task_released", session=session_id, task=task_id, reason=reason)
            return self.task_json(self.task_row(task_id))

    def heartbeat(self, session_id: str) -> dict[str, Any]:
        with self.transaction():
            self.active_session(session_id)
            self.touch(session_id)
            return {"session": self.session_json(self.active_session(session_id))}

    def close(self, session_id: str) -> dict[str, Any]:
        with self.transaction():
            self.active_session(session_id)
            claim = self.connection.execute("SELECT task_id FROM claims WHERE session_id=?", (session_id,)).fetchone()
            if claim:
                raise CoordinationError("SESSION_HAS_CLAIM", "Finish or release the task before closing the session.", task=claim["task_id"])
            self.connection.execute("UPDATE sessions SET status='closed',retired_at=? WHERE id=?", (time.time(), session_id))
            self.event("session_closed", session=session_id)
            row = self.connection.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
            return {"session": self.session_json(row)}

    def recover(self, session_id: str, target_id: str, reason: str) -> dict[str, Any]:
        reason = self.require_text(reason, "Recovery reason")
        with self.transaction():
            actor = self.active_session(session_id)
            if actor["role"] != "coordinator":
                raise CoordinationError("ROLE_REQUIRED", "Recovery requires an active coordinator session.")
            self.active_session(target_id)
            released = [row["task_id"] for row in self.connection.execute("SELECT task_id FROM claims WHERE session_id=?", (target_id,))]
            self.connection.execute("DELETE FROM claims WHERE session_id=?", (target_id,))
            self.connection.execute("UPDATE sessions SET status='recovered',retired_at=? WHERE id=?", (time.time(), target_id))
            self.touch(session_id)
            self.event("session_recovered", session=session_id, target_session=target_id, released_tasks=released, reason=reason)
            return {"target_session_id": target_id, "released_tasks": released, "tasks_completed": False, "reason": reason}


class JsonArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise CoordinationError("ARGUMENT_INVALID", message)


def parser() -> argparse.ArgumentParser:
    result = JsonArgumentParser(description=__doc__)
    result.add_argument("--repo", default=".", help="Git checkout (default: current directory)")
    commands = result.add_subparsers(dest="command", required=True, parser_class=JsonArgumentParser)
    start = commands.add_parser("session", help="Create a session; only one task claim per role is allowed")
    start.add_argument("--role", required=True, choices=ROLES)
    commands.add_parser("status", help="Show tasks, sessions and stale reservations")
    for name in ("next", "heartbeat", "close"):
        command = commands.add_parser(name)
        command.add_argument("--session", required=True)
    for name in ("claim", "finish", "release"):
        command = commands.add_parser(name)
        command.add_argument("--session", required=True)
        command.add_argument("--task", required=True)
        if name == "finish":
            command.add_argument("--evidence", required=True)
        if name == "release":
            command.add_argument("--reason", required=True)
    check = commands.add_parser("check", help="Confirm own claim covers a path before editing")
    check.add_argument("--session", required=True)
    check.add_argument("--path", required=True)
    recovery = commands.add_parser("recover", help="Coordinator explicitly retires an abandoned session")
    recovery.add_argument("--session", required=True, help="Active coordinator session ID")
    recovery.add_argument("--target-session", required=True)
    recovery.add_argument("--reason", required=True)
    sync = commands.add_parser("sync-catalog", help="Coordinator explicitly accepts local catalog changes with digest CAS")
    sync.add_argument("--session", required=True, help="Active coordinator session ID")
    sync.add_argument("--reason", required=True)
    sync.add_argument("--expected-digest", required=True, help="status catalog.digest; initialize the registry with status first")
    return result


def main(argv: list[str] | None = None) -> int:
    coordinator = None
    try:
        args = parser().parse_args(argv)
        coordinator = Coordinator(args.repo)
        if args.command == "session":
            data = coordinator.session(args.role)
        elif args.command == "status":
            data = coordinator.status()
        elif args.command == "next":
            data = coordinator.next(args.session)
        elif args.command == "claim":
            data = coordinator.claim(args.session, args.task)
        elif args.command == "check":
            data = coordinator.check(args.session, args.path)
        elif args.command == "finish":
            data = coordinator.finish(args.session, args.task, args.evidence)
        elif args.command == "release":
            data = coordinator.release(args.session, args.task, args.reason)
        elif args.command == "heartbeat":
            data = coordinator.heartbeat(args.session)
        elif args.command == "close":
            data = coordinator.close(args.session)
        elif args.command == "sync-catalog":
            data = coordinator.accept_catalog(args.session, args.reason, args.expected_digest)
        else:
            data = coordinator.recover(args.session, args.target_session, args.reason)
        print(encoded({"ok": True, "command": args.command, **data}))
        return 0
    except CoordinationError as exc:
        print(encoded({"ok": False, "error": {"code": exc.code, "message": exc.message, **exc.details}}))
        return 1
    except sqlite3.Error as exc:
        code = "DATABASE_BUSY" if "locked" in str(exc).lower() else "DATABASE_ERROR"
        print(encoded({"ok": False, "error": {"code": code, "message": "Local coordination database operation failed; retry after inspection."}}))
        return 1
    except OSError:
        print(encoded({"ok": False, "error": {"code": "IO_ERROR", "message": "Cannot access local Git coordination files."}}))
        return 1
    finally:
        if coordinator is not None:
            coordinator.close_database()


if __name__ == "__main__":
    sys.exit(main())
