#!/usr/bin/env python3
"""Integration tests in disposable Git repositories; never claim live tasks."""

from __future__ import annotations

import importlib.util
import json
import multiprocessing
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest


sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name("coordination.py").resolve()
SPEC = importlib.util.spec_from_file_location("coordination", SCRIPT)
assert SPEC and SPEC.loader
coordination = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(coordination)


def task(task_id: str, role: str, paths: list[str], deps: list[str] | None = None, **metadata):
    return {"id": task_id, "role": role, "title": task_id, "paths": paths, "depends_on": deps or [], **metadata}


def run_cli(repo: Path | str, *arguments: str):
    environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    process = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo", str(repo), *arguments],
        text=True, capture_output=True, env=environment, timeout=20,
    )
    try:
        output = json.loads(process.stdout)
    except ValueError as exc:
        raise AssertionError(f"Expected JSON, exit={process.returncode}, stderr={process.stderr}") from exc
    return process.returncode, output


def race_claim(repo: str, session_id: str, barrier, results) -> None:
    barrier.wait(timeout=15)
    results.put(run_cli(repo, "claim", "--session", session_id, "--task", "F1"))


class CoordinationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="livingforma-coordination-test-")
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        self.git("init", "-b", "main")
        self.catalog = [task("F1", "frontend", ["apps/web/"], acceptance=["passes"], notes="test", extra={"x": 1})]
        self.write_catalog()
        self.manager = coordination.Coordinator(self.repo)

    def tearDown(self):
        self.manager.close_database()
        self.temp.cleanup()

    def git(self, *arguments: str, repo: Path | None = None):
        result = subprocess.run(["git", "-C", str(repo or self.repo), *arguments],
                                text=True, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def write_catalog(self):
        # Every normal fixture has a real, independent catalog-maintenance task.
        if not any(item["id"] == "C0" for item in self.catalog):
            self.catalog.append(task("C0", "coordinator", [".codex/coordination.json"]))
        (self.repo / ".codex").mkdir(exist_ok=True)
        (self.repo / ".codex/coordination.json").write_text(
            json.dumps({"version": 1, "tasks": self.catalog}), encoding="utf-8",
        )

    def session(self, role: str) -> str:
        return self.manager.session(role)["session"]["id"]

    def accept_catalog(self, session: str | None = None, reason: str = "Deliberate test catalog edit"):
        accepted = self.manager.catalog_json()
        if accepted is None:
            self.manager.status()
            accepted = self.manager.catalog_json()
        session = session or self.session("coordinator")
        existing = self.manager.connection.execute("SELECT task_id FROM claims WHERE session_id=?", (session,)).fetchone()
        temporary_claim = existing is None
        if temporary_claim:
            # Fixtures often stage their candidate before invoking this helper.
            # Acquire the reservation from the unchanged accepted snapshot, then
            # restore that candidate. Production agents claim before editing.
            candidate = (self.repo / ".codex/coordination.json").read_text()
            stored = [json.loads(row["spec"]) for row in self.manager.connection.execute("SELECT spec FROM tasks WHERE present=1 ORDER BY position")]
            (self.repo / ".codex/coordination.json").write_text(json.dumps({"version": 1, "tasks": stored}))
            try:
                self.manager.claim(session, "C0")
            finally:
                (self.repo / ".codex/coordination.json").write_text(candidate)
        try:
            return self.manager.accept_catalog(session, reason, accepted["digest"])
        finally:
            if temporary_claim:
                self.manager.release(session, "C0", "Temporary fixture publication finished")

    @staticmethod
    def product_tasks(status):
        return [row for row in status["tasks"] if row["task"]["id"] != "C0"]

    def error(self, code: str, method, *args):
        with self.assertRaises(coordination.CoordinationError) as raised:
            method(*args)
        self.assertEqual(raised.exception.code, code)
        return raised.exception

    def test_multiprocess_same_task_race_has_exactly_one_winner(self):
        session = self.session("frontend")
        # Each child invokes a distinct interpreter/SQLite connection.
        self.manager.status()
        context = multiprocessing.get_context("spawn")
        barrier, results = context.Barrier(2), context.Queue()
        children = [context.Process(target=race_claim, args=(str(self.repo), session, barrier, results)) for _ in range(2)]
        for child in children:
            child.start()
        outcomes = [results.get(timeout=25) for _ in children]
        for child in children:
            child.join(timeout=25)
            self.assertFalse(child.is_alive())
            self.assertEqual(child.exitcode, 0)
        self.assertEqual(sum(code == 0 for code, _ in outcomes), 1, outcomes)
        loser = next(result for code, result in outcomes if code != 0)
        self.assertEqual(loser["error"]["code"], "TASK_CLAIMED")
        self.assertEqual(self.manager.connection.execute("SELECT count(*) FROM claims").fetchone()[0], 1)

    def test_next_respects_catalog_order_dependencies_and_metadata(self):
        self.catalog = [task("F2", "frontend", ["second/"], ["F1"]),
                        task("F1", "frontend", ["first/"], acceptance=["real evidence"], notes="read me", extra={"x": 1})]
        self.write_catalog()
        session = self.session("frontend")
        self.error("DEPENDENCIES_PENDING", self.manager.claim, session, "F2")
        first = self.manager.next(session)
        self.assertEqual(first["task"]["id"], "F1")
        self.assertEqual(first["task"]["extra"], {"x": 1})
        self.assertEqual(first["task"]["acceptance"], ["real evidence"])
        self.manager.finish(session, "F1", "targeted checks passed")
        self.assertEqual(self.manager.next(session)["task"]["id"], "F2")
        self.manager.finish(session, "F2", "successor checks passed")
        self.assertFalse(self.manager.next(session)["available"])

    def test_overlapping_ancestor_exact_and_case_alias_paths_are_rejected(self):
        for path in ("apps/web/page.ts", "apps/", "APPS/WEB/"):
            with self.subTest(path=path):
                self.catalog = [task("F1", "frontend", ["apps/web/"]), task("B1", "backend", [path]),
                                task("Q1", "qa", ["apps/web2/"])]
                self.write_catalog()
                self.accept_catalog()
                front, back, qa = (self.session(role) for role in ("frontend", "backend", "qa"))
                self.manager.claim(front, "F1")
                self.error("PATH_CONFLICT", self.manager.claim, back, "B1")
                self.manager.claim(qa, "Q1")
                self.manager.release(qa, "Q1", "next case")
                self.manager.release(front, "F1", "next case")
                for session in (front, back, qa):
                    self.manager.close(session)

    def test_same_role_idle_sessions_allow_only_one_task_writer(self):
        self.catalog.append(task("F2", "frontend", ["unrelated/"]))
        self.write_catalog()
        one, two = self.session("frontend"), self.session("frontend")
        self.manager.claim(one, "F1")
        self.error("ROLE_CLAIMED", self.manager.claim, two, "F2")
        self.error("SESSION_HAS_CLAIM", self.manager.next, one)
        self.assertFalse(self.manager.next(two)["available"])
        self.manager.release(one, "F1", "handoff")
        self.manager.claim(two, "F2")

    def test_session_ownership_and_check_directory_prefix(self):
        self.catalog = [task("F1", "frontend", ["apps/web/", "exact.ts"])]
        self.write_catalog()
        owner, other = self.session("frontend"), self.session("backend")
        self.manager.claim(owner, "F1")
        self.assertTrue(self.manager.check(owner, "apps/web/src/page.ts")["allowed"])
        self.assertTrue(self.manager.check(owner, "apps/web")["allowed"])
        self.assertTrue(self.manager.check(owner, "exact.ts")["allowed"])
        self.error("OUTSIDE_CLAIM", self.manager.check, owner, "exact.ts/child")
        self.error("OUTSIDE_CLAIM", self.manager.check, owner, "apps/web2/page.ts")
        self.error("OUTSIDE_CLAIM", self.manager.check, other, "apps/web/page.ts")
        self.error("NOT_OWNER", self.manager.finish, other, "F1", "false evidence")
        self.error("NOT_OWNER", self.manager.release, other, "F1", "takeover")
        self.error("TEXT_REQUIRED", self.manager.finish, owner, "F1", " ")
        self.error("SESSION_HAS_CLAIM", self.manager.close, owner)
        self.assertEqual(self.manager.status()["tasks"][0]["status"], "claimed")

    def test_close_retirement_and_restart_persistence(self):
        session = self.session("frontend")
        self.manager.claim(session, "F1")
        result = self.manager.finish(session, "F1", "verified restart and API contract")
        self.assertEqual(result["status"], "completed")
        self.manager.close(session)
        self.error("SESSION_CLOSED", self.manager.heartbeat, session)
        fresh = coordination.Coordinator(self.repo)
        try:
            status = fresh.status()
            self.assertEqual(status["tasks"][0]["evidence"], "verified restart and API contract")
            self.assertEqual(status["sessions"][0]["status"], "closed")
            idle = fresh.session("frontend")["session"]["id"]
            self.error("TASK_COMPLETE", fresh.claim, idle, "F1")
        finally:
            fresh.close_database()

    def test_stale_display_never_expires_claim_and_heartbeat_refreshes(self):
        owner = self.session("frontend")
        self.manager.claim(owner, "F1")
        self.manager.connection.execute("UPDATE sessions SET heartbeat_at=? WHERE id=?", (time.time() - 3600, owner))
        status = self.manager.status()
        self.assertTrue(status["sessions"][0]["stale"])
        self.assertEqual(status["tasks"][0]["status"], "claimed")
        self.assertFalse(status["automatic_expiry"])
        other = self.session("frontend")
        self.error("TASK_CLAIMED", self.manager.claim, other, "F1")
        self.assertFalse(self.manager.heartbeat(owner)["session"]["stale"])

    def test_coordinator_recovery_releases_does_not_complete(self):
        owner, worker, coordinator = self.session("frontend"), self.session("qa"), self.session("coordinator")
        self.manager.claim(owner, "F1")
        self.error("ROLE_REQUIRED", self.manager.recover, worker, owner, "abandoned")
        self.error("TEXT_REQUIRED", self.manager.recover, coordinator, owner, " ")
        recovery = self.manager.recover(coordinator, owner, "Verified previous chat has stopped")
        self.assertEqual(recovery["released_tasks"], ["F1"])
        self.assertFalse(recovery["tasks_completed"])
        self.error("SESSION_CLOSED", self.manager.claim, owner, "F1")
        new_owner = self.session("frontend")
        self.assertEqual(self.manager.claim(new_owner, "F1")["status"], "claimed")

    def test_new_idle_coordinator_can_recover_crashed_coordinator(self):
        self.catalog = [task("C1", "coordinator", ["docs/shared/"])]
        self.write_catalog()
        old, new = self.session("coordinator"), self.session("coordinator")
        self.manager.claim(old, "C1")
        self.manager.recover(new, old, "Confirmed old coordinator is no longer running")
        self.assertEqual(self.manager.claim(new, "C1")["task"]["id"], "C1")

    def test_unsafe_paths_and_symlinks_are_rejected(self):
        bad = ["/tmp/escape", "../escape", "a/../escape", "./a", "a//b", "a\\b", "C:/escape", ".git/config", "a/*"]
        for path in bad:
            with self.subTest(path=path):
                self.catalog = [task("F1", "frontend", [path])]
                self.write_catalog()
                self.error("PATH_INVALID", self.manager.claim, self.session("frontend"), "F1")
        outside = Path(self.temp.name) / "outside"
        outside.mkdir()
        (self.repo / "link").symlink_to(outside, target_is_directory=True)
        (self.repo / "dangling").symlink_to(outside / "missing")
        for path in ("link/file", "link/", "dangling"):
            self.catalog = [task("F1", "frontend", [path])]
            self.write_catalog()
            self.error("PATH_INVALID", self.manager.claim, self.session("frontend"), "F1")

    def test_check_rejects_symlink_added_after_claim(self):
        owner = self.session("frontend")
        self.manager.claim(owner, "F1")
        directory = self.repo / "apps/web"
        directory.mkdir(parents=True)
        (directory / "link").symlink_to(Path(self.temp.name), target_is_directory=True)
        self.error("PATH_INVALID", self.manager.check, owner, "apps/web/link/outside")

    def test_unsafe_active_catalog_edits_rollback_and_recovery_remains_available(self):
        owner, coordinator = self.session("frontend"), self.session("coordinator")
        self.manager.claim(owner, "F1")
        original = self.manager.connection.execute("SELECT spec FROM tasks WHERE id='F1'").fetchone()[0]
        self.catalog[0]["paths"] = ["changed/"]
        self.catalog.append(task("B1", "backend", ["backend/"]))
        self.write_catalog()
        self.error("CATALOG_STALE", self.manager.claim, self.session("backend"), "B1")
        self.error("CATALOG_CONFLICT", self.accept_catalog, coordinator)
        self.assertEqual(self.manager.connection.execute("SELECT spec FROM tasks WHERE id='F1'").fetchone()[0], original)
        self.assertEqual(self.manager.connection.execute("SELECT count(*) FROM tasks").fetchone()[0], 2)
        status = self.manager.status()
        self.assertEqual(status["catalog_error"]["code"], "CATALOG_STALE")
        self.assertEqual(status["tasks"][0]["status"], "claimed")
        # Even a malformed catalog must not trap an abandoned claimant forever.
        (self.repo / ".codex/coordination.json").write_text("broken")
        self.manager.recover(coordinator, owner, "Stopped old session; repair catalog separately")
        self.write_catalog()
        self.accept_catalog(coordinator)
        self.assertEqual(self.manager.status()["tasks"][0]["task"]["paths"], ["changed/"])

    def test_active_catalog_removal_role_dependency_change_rejected(self):
        for variant in ("removed", "role", "deps"):
            with self.subTest(variant=variant):
                self.catalog = [task("F1", "frontend", ["web/"]), task("B1", "backend", ["api/"])]
                self.write_catalog()
                self.accept_catalog()
                owner, coordinator = self.session("frontend"), self.session("coordinator")
                self.manager.claim(owner, "F1")
                if variant == "removed":
                    self.catalog.pop(0)
                elif variant == "role":
                    self.catalog[0]["role"] = "qa"
                else:
                    self.catalog[0]["depends_on"] = ["B1"]
                self.write_catalog()
                self.error("CATALOG_STALE", self.manager.check, owner, "web/file")
                self.error("CATALOG_CONFLICT", self.accept_catalog, coordinator)
                self.manager.recover(coordinator, owner, "test cleanup after stopped owner")
                self.accept_catalog(coordinator)
                self.manager.close(coordinator)
                self.manager.status()

    def test_display_metadata_updates_safe_while_claimed(self):
        owner = self.session("frontend")
        self.manager.claim(owner, "F1")
        self.catalog[0].update(title="Updated title", notes="updated", extra={"x": 2})
        self.write_catalog()
        self.assertEqual(self.manager.status()["catalog_error"]["code"], "CATALOG_STALE")
        self.accept_catalog()
        result = self.manager.status()["tasks"][0]
        self.assertEqual(result["status"], "claimed")
        self.assertEqual(result["task"]["extra"], {"x": 2})
        self.manager.finish(owner, "F1", "unchanged criterion verified")

    def test_catalog_revisions_invalidate_completed_descendants_and_protect_active_deps(self):
        self.catalog = [task("F1", "frontend", ["web/"]), task("B1", "backend", ["api/"], ["F1"])]
        self.write_catalog()
        front, back = self.session("frontend"), self.session("backend")
        self.manager.claim(front, "F1")
        self.manager.finish(front, "F1", "first version")
        self.manager.claim(back, "B1")
        self.catalog[0]["paths"] = ["new-web/"]
        self.write_catalog()
        self.error("CATALOG_STALE", self.manager.finish, back, "B1", "stale dependency")
        self.error("CATALOG_CONFLICT", self.accept_catalog)
        self.catalog[0]["paths"] = ["web/"]
        self.write_catalog()
        self.manager.finish(back, "B1", "original dependency verified")
        self.catalog[0]["paths"] = ["new-web/"]
        self.write_catalog()
        self.accept_catalog()
        self.assertEqual([row["status"] for row in self.product_tasks(self.manager.status())], ["available", "available"])
        self.error("DEPENDENCIES_PENDING", self.manager.claim, back, "B1")

    def test_active_acceptance_changes_rejected_without_losing_claim(self):
        owner = self.session("frontend")
        self.manager.claim(owner, "F1")
        accepted = self.manager.catalog_json()
        self.catalog[0]["acceptance"] = ["new required behavior"]
        self.write_catalog()
        self.error("CATALOG_STALE", self.manager.check, owner, "apps/web/page.ts")
        self.error("CATALOG_CONFLICT", self.accept_catalog)
        self.assertEqual(self.manager.catalog_json(), accepted)
        task_status = self.manager.status()["tasks"][0]
        self.assertEqual(task_status["status"], "claimed")
        self.assertEqual(task_status["task"]["acceptance"], ["passes"])

    def test_old_worktree_cannot_overwrite_new_acceptance_or_completion(self):
        self.catalog = [task("F1", "frontend", ["web/"], acceptance=["version one"]),
                        task("B1", "backend", ["api/"], ["F1"], acceptance=["uses verified frontend"])]
        self.write_catalog()
        self.git("add", ".codex/coordination.json")
        self.git("-c", "user.name=Coordination Test", "-c", "user.email=test@example.invalid", "commit", "-m", "old catalog")
        sibling = Path(self.temp.name) / "old-worktree"
        self.git("worktree", "add", "-b", "old", str(sibling))
        front, back, actor = (self.session(role) for role in ("frontend", "backend", "coordinator"))
        for session, task_id in ((front, "F1"), (back, "B1")):
            self.manager.claim(session, task_id)
            self.manager.finish(session, task_id, "version one evidence")
        self.manager.claim(actor, "C0")
        original_digest = self.manager.catalog_json()["digest"]
        self.catalog[0]["acceptance"] = ["version two additional requirement"]
        self.write_catalog()
        self.error("CATALOG_STALE", self.manager.next, front)
        self.assertEqual([row["status"] for row in self.product_tasks(self.manager.status())], ["completed", "completed"])
        publication = self.accept_catalog(actor, "Accept additional version two criterion")
        self.assertEqual(publication["catalog"]["revision"], 2)
        self.assertEqual([row["status"] for row in self.product_tasks(self.manager.status())], ["available", "available"])
        for session, task_id in ((front, "F1"), (back, "B1")):
            self.manager.claim(session, task_id)
            self.manager.finish(session, task_id, "version two requirements verified")
        current = self.manager.status()
        old = coordination.Coordinator(sibling)
        try:
            stale_status = old.status()
            self.assertEqual(stale_status["catalog_error"]["code"], "CATALOG_STALE")
            self.assertEqual(stale_status["catalog"]["digest"], current["catalog"]["digest"])
            self.assertEqual(stale_status["local_catalog_digest"], original_digest)
            self.error("CATALOG_STALE", old.claim, front, "F1")
            self.error("CATALOG_STALE", old.next, back)
            self.error("CATALOG_CAS_FAILED", old.accept_catalog, actor, "Outdated expected digest", original_digest)
            after = self.manager.status()
            self.assertEqual(after["catalog"], current["catalog"])
            self.assertEqual(after["tasks"], current["tasks"])
            self.assertEqual(after["tasks"][0]["task"]["acceptance"], ["version two additional requirement"])
            self.assertEqual(after["tasks"][0]["evidence"], "version two requirements verified")
        finally:
            old.close_database()

    def test_explicit_sync_requires_coordinator_reason_and_digest_cas_and_records_audit(self):
        original = self.manager.status()["catalog"]
        worker, actor = self.session("frontend"), self.session("coordinator")
        self.manager.claim(actor, "C0")
        self.catalog[0]["notes"] = "deliberately updated guidance"
        self.write_catalog()
        self.error("ROLE_REQUIRED", self.manager.accept_catalog, worker, "worker attempts sync", original["digest"])
        self.error("TEXT_REQUIRED", self.manager.accept_catalog, actor, " ", original["digest"])
        self.error("CATALOG_CAS_FAILED", self.manager.accept_catalog, actor, "wrong digest", "wrong")
        self.assertEqual(self.manager.catalog_json(), original)
        code, result = run_cli(self.repo, "sync-catalog", "--session", actor,
                               "--expected-digest", original["digest"], "--reason", "Reviewed updated guidance")
        self.assertEqual(code, 0)
        self.assertTrue(result["accepted"])
        self.assertEqual(result["previous_digest"], original["digest"])
        self.assertEqual(result["catalog"]["revision"], 2)
        self.assertEqual(result["catalog"]["accepted_by"], actor)
        self.assertIsNone(self.manager.status()["catalog_error"])
        row = self.manager.connection.execute("SELECT * FROM events WHERE kind='catalog_synced' ORDER BY id DESC LIMIT 1").fetchone()
        self.assertEqual(row["session_id"], actor)
        audit = json.loads(row["details"])
        self.assertEqual(audit["reason"], "Reviewed updated guidance")
        self.assertEqual(audit["previous_digest"], original["digest"])
        self.assertEqual(audit["digest"], result["catalog"]["digest"])
        self.assertEqual(audit["revision"], 2)

    def test_catalog_sync_requires_owned_catalog_scope_and_consistent_reservation(self):
        self.catalog = [task("F1", "frontend", ["web/"]), task("C1", "coordinator", ["docs/other/"])]
        self.write_catalog()
        accepted = self.manager.status()["catalog"]
        actor = self.session("coordinator")
        self.error("CATALOG_CLAIM_REQUIRED", self.manager.accept_catalog, actor, "Idle attempt", accepted["digest"])
        self.manager.claim(actor, "C1")
        self.error("CATALOG_CLAIM_REQUIRED", self.manager.accept_catalog, actor, "Wrong scope attempt", accepted["digest"])
        self.manager.release(actor, "C1", "Need catalog maintenance scope")
        self.manager.claim(actor, "C0")
        reservation = self.manager.connection.execute("SELECT * FROM claims WHERE session_id=?", (actor,)).fetchone()
        self.manager.connection.execute("UPDATE claims SET critical='incorrect' WHERE session_id=?", (actor,))
        self.error("CLAIM_MISMATCH", self.manager.accept_catalog, actor, "Inconsistent fingerprint", accepted["digest"])
        self.manager.connection.execute("UPDATE claims SET critical=? WHERE session_id=?", (reservation["critical"], actor))
        self.manager.connection.execute("UPDATE claims SET paths='[\"other/\"]' WHERE session_id=?", (actor,))
        self.error("CLAIM_MISMATCH", self.manager.accept_catalog, actor, "Inconsistent paths", accepted["digest"])
        self.manager.connection.execute("UPDATE claims SET paths=? WHERE session_id=?", (reservation["paths"], actor))
        self.manager.connection.execute("UPDATE tasks SET critical='incorrect' WHERE id='C0'")
        self.manager.connection.execute("UPDATE claims SET critical='incorrect' WHERE session_id=?", (actor,))
        self.error("CLAIM_MISMATCH", self.manager.accept_catalog, actor, "Task fingerprint not derived from registry", accepted["digest"])
        self.manager.connection.execute("UPDATE tasks SET critical=? WHERE id='C0'", (reservation["critical"],))
        self.manager.connection.execute("UPDATE claims SET critical=? WHERE session_id=?", (reservation["critical"], actor))
        self.assertEqual(self.manager.catalog_json(), accepted)
        idle = self.session("coordinator")
        self.error("CATALOG_CLAIM_REQUIRED", self.manager.accept_catalog, idle, "Other owner's claim is not mine", accepted["digest"])
        self.catalog[0]["notes"] = "reviewed under reserved catalog scope"
        self.write_catalog()
        publication = self.manager.accept_catalog(actor, "Accepted with consistent own reservation", accepted["digest"])
        self.assertTrue(publication["accepted"])
        self.assertEqual(publication["catalog"]["revision"], 2)

    def test_uninitialized_explicit_sync_rejected_then_status_and_claim_bootstrap(self):
        actor = self.session("coordinator")
        self.error("CATALOG_UNINITIALIZED", self.manager.accept_catalog, actor, "No registry yet", "uninitialized")
        self.assertIsNone(self.manager.catalog_json())
        self.assertEqual(self.manager.connection.execute("SELECT count(*) FROM tasks").fetchone()[0], 0)
        accepted = self.manager.status()["catalog"]
        self.assertEqual(accepted["revision"], 1)
        self.error("CATALOG_CLAIM_REQUIRED", self.manager.accept_catalog, actor, "Still idle", accepted["digest"])
        self.manager.claim(actor, "C0")
        result = self.manager.accept_catalog(actor, "Reserved explicit publication", accepted["digest"])
        self.assertTrue(result["accepted"])
        self.assertEqual(result["catalog"]["accepted_by"], actor)
        self.assertEqual(result["catalog"]["revision"], 1)

    def test_first_catalog_owner_claim_can_initialize_empty_database_atomically(self):
        actor = self.session("coordinator")
        self.assertIsNone(self.manager.catalog_json())
        reserved = self.manager.claim(actor, "C0")
        self.assertEqual(reserved["status"], "claimed")
        self.assertEqual(reserved["task"]["paths"], [".codex/coordination.json"])
        accepted = self.manager.catalog_json()
        self.assertEqual(accepted["revision"], 1)
        result = self.manager.accept_catalog(actor, "First owner verifies initial catalog", accepted["digest"])
        self.assertTrue(result["accepted"])

    def test_sessions_and_recovery_work_before_catalog_initialization(self):
        (self.repo / ".codex/coordination.json").unlink()
        old, new = self.session("coordinator"), self.session("coordinator")
        self.assertIsNone(self.manager.catalog_json())
        self.manager.recover(new, old, "Stopped empty coordinator despite missing catalog")
        status = self.manager.status()
        self.assertIsNone(status["catalog"])
        self.assertEqual(status["catalog_error"]["code"], "CATALOG_INVALID")
        self.write_catalog()
        initialized = self.manager.status()["catalog"]
        self.assertEqual(initialized["revision"], 1)
        self.assertEqual(self.manager.status()["catalog"], initialized)
        count = self.manager.connection.execute("SELECT count(*) FROM events WHERE kind='catalog_initialized'").fetchone()[0]
        self.assertEqual(count, 1)
        self.manager.close(new)

    def test_owner_release_works_with_stale_or_malformed_catalog(self):
        owner, other = self.session("frontend"), self.session("backend")
        self.manager.claim(owner, "F1")
        accepted = self.manager.catalog_json()
        self.catalog[0]["acceptance"] = ["additional requirement"]
        self.write_catalog()
        self.error("NOT_OWNER", self.manager.release, other, "F1", "not my task")
        released = self.manager.release(owner, "F1", "Release before changed criteria are accepted")
        self.assertEqual(released["status"], "available")
        self.assertEqual(released["task"]["acceptance"], ["passes"])
        self.assertIsNone(released["evidence"])
        self.assertEqual(self.manager.catalog_json(), accepted)
        # Releasing unblocks deliberate catalog sync without reverting the file
        # or misrepresenting a live session as abandoned.
        self.accept_catalog()
        self.manager.claim(owner, "F1")
        (self.repo / ".codex/coordination.json").write_text("malformed")
        self.error("NOT_OWNER", self.manager.release, other, "F1", "still not my task")
        self.error("CATALOG_INVALID", self.manager.finish, owner, "F1", "must not finish")
        released = self.manager.release(owner, "F1", "Release while coordinator repairs malformed file")
        self.assertEqual(released["status"], "available")
        self.assertEqual(released["task"]["acceptance"], ["additional requirement"])
        self.assertEqual(self.manager.connection.execute("SELECT count(*) FROM events WHERE kind='task_released' AND task_id='F1'").fetchone()[0], 2)

    def test_catalog_owner_coordinator_can_check_exact_catalog_for_repair(self):
        self.catalog = [task("C1", "coordinator", [".codex/", "docs/shared/"]),
                        task("F1", "frontend", ["web/"])]
        self.write_catalog()
        actor, worker, outsider = self.session("coordinator"), self.session("frontend"), self.session("coordinator")
        self.manager.claim(actor, "C1")
        self.manager.claim(worker, "F1")
        accepted = self.manager.catalog_json()
        self.catalog[1]["title"] = "Changed display text"
        self.write_catalog()
        check = self.manager.check(actor, ".codex/coordination.json")
        self.assertTrue(check["allowed"])
        self.assertFalse(check["catalog_current"])
        self.assertEqual(check["catalog_error"]["code"], "CATALOG_STALE")
        self.error("CATALOG_STALE", self.manager.check, actor, ".codex/agents/frontend.toml")
        self.error("CATALOG_STALE", self.manager.check, actor, "docs/shared/note.md")
        self.error("CATALOG_STALE", self.manager.check, worker, ".codex/coordination.json")
        self.error("CATALOG_STALE", self.manager.check, outsider, ".codex/coordination.json")
        self.assertEqual(self.manager.catalog_json(), accepted)
        (self.repo / ".codex/coordination.json").write_text("malformed")
        repair = self.manager.check(actor, ".codex/coordination.json")
        self.assertTrue(repair["allowed"])
        self.assertFalse(repair["catalog_current"])
        self.assertEqual(repair["catalog_error"]["code"], "CATALOG_INVALID")
        self.error("CATALOG_INVALID", self.manager.check, worker, "web/file.ts")
        self.error("CATALOG_INVALID", self.manager.check, outsider, ".codex/coordination.json")
        self.write_catalog()
        self.accept_catalog(actor)
        self.assertTrue(self.manager.check(actor, ".codex/coordination.json")["catalog_current"])

    def test_worker_catalog_claim_does_not_allow_repair_validation_bypass(self):
        self.catalog = [task("F1", "frontend", [".codex/coordination.json"])]
        self.write_catalog()
        worker = self.session("frontend")
        self.manager.claim(worker, "F1")
        (self.repo / ".codex/coordination.json").write_text("malformed")
        self.error("CATALOG_INVALID", self.manager.check, worker, ".codex/coordination.json")
        self.manager.release(worker, "F1", "Coordinator must repair catalog")

    def test_legacy_database_migration_uses_stored_catalog_not_old_checkout(self):
        owner = self.session("frontend")
        self.manager.claim(owner, "F1")
        self.manager.finish(owner, "F1", "first criteria verified")
        self.catalog[0]["acceptance"] = ["latest criteria"]
        self.write_catalog()
        self.accept_catalog()
        self.manager.claim(owner, "F1")
        self.manager.finish(owner, "F1", "latest criteria verified")
        latest_spec = self.manager.status()["tasks"]
        # Reproduce the earlier script's persisted task state without digest metadata.
        self.manager.connection.execute("DELETE FROM catalog_state")
        self.manager.connection.execute("UPDATE tasks SET critical='legacy-critical-without-acceptance'")
        self.catalog[0]["acceptance"] = ["passes"]
        self.write_catalog()
        upgraded = coordination.Coordinator(self.repo)
        try:
            status = upgraded.status()
            self.assertEqual(status["catalog_error"]["code"], "CATALOG_STALE")
            self.assertEqual(status["tasks"], latest_spec)
            self.assertEqual(status["catalog"]["revision"], 1)
            self.assertIn("Migrated stored catalog", status["catalog"]["reason"])
            self.error("CATALOG_STALE", upgraded.claim, owner, "F1")
        finally:
            upgraded.close_database()

    def test_failed_transactions_have_no_partial_writes(self):
        owner = self.session("frontend")
        self.manager.status()
        previous = self.manager.connection.execute("SELECT heartbeat_at FROM sessions WHERE id=?", (owner,)).fetchone()[0]
        with self.assertRaises(sqlite3.IntegrityError):
            with self.manager.transaction():
                self.manager.touch(owner)
                self.manager.event("must_rollback", session=owner)
                self.manager.connection.execute("INSERT INTO claims VALUES ('missing',?,'[]','x',0)", (owner,))
        self.assertEqual(self.manager.connection.execute("SELECT heartbeat_at FROM sessions WHERE id=?", (owner,)).fetchone()[0], previous)
        self.assertEqual(self.manager.connection.execute("SELECT count(*) FROM events WHERE kind='must_rollback'").fetchone()[0], 0)
        self.assertEqual(self.manager.connection.execute("SELECT count(*) FROM claims").fetchone()[0], 0)
        # A later transaction still succeeds after rollback.
        self.assertTrue(self.manager.claim(owner, "F1")["available"])

    def test_invalid_catalog_dependency_cycle_and_duplicate_id(self):
        variants = [
            [task("F1", "frontend", ["web/"], ["missing"])],
            [task("F1", "frontend", ["web/"], ["B1"]), task("B1", "backend", ["api/"], ["F1"])],
            [task("F1", "frontend", ["web/"]), task("F1", "backend", ["api/"])],
        ]
        for catalog in variants:
            self.catalog = catalog
            self.write_catalog()
            self.error("CATALOG_INVALID", self.manager.next, self.session("frontend"))

    def test_git_worktrees_share_state_but_independent_clone_does_not(self):
        self.git("add", ".codex/coordination.json")
        self.git("-c", "user.name=Coordination Test", "-c", "user.email=test@example.invalid", "commit", "-m", "test catalog")
        sibling = Path(self.temp.name) / "sibling"
        self.git("worktree", "add", "-b", "sibling", str(sibling))
        owner = self.session("frontend")
        self.manager.claim(owner, "F1")
        other = coordination.Coordinator(sibling)
        try:
            self.assertEqual(other.database, self.manager.database)
            idle = other.session("frontend")["session"]["id"]
            self.error("TASK_CLAIMED", other.claim, idle, "F1")
            self.assertTrue(other.check(owner, "apps/web/page.ts")["allowed"])
        finally:
            other.close_database()
        clone = Path(self.temp.name) / "clone"
        self.git("clone", str(self.repo), str(clone))
        separate = coordination.Coordinator(clone)
        try:
            self.assertNotEqual(separate.database, self.manager.database)
            fresh = separate.session("frontend")["session"]["id"]
            self.assertTrue(separate.claim(fresh, "F1")["available"])
        finally:
            separate.close_database()

    def test_cli_success_and_argument_errors_are_json(self):
        code, output = run_cli(self.repo, "session", "--role", "frontend")
        self.assertEqual(code, 0)
        self.assertTrue(output["ok"])
        session = output["session"]["id"]
        code, output = run_cli(self.repo, "next", "--session", session)
        self.assertEqual(code, 0)
        self.assertEqual(output["task"]["id"], "F1")
        code, output = run_cli(self.repo, "check", "--session", session, "--path", "../outside")
        self.assertNotEqual(code, 0)
        self.assertEqual(output["error"]["code"], "PATH_INVALID")
        code, output = run_cli(self.repo, "finish", "--session", session)
        self.assertNotEqual(code, 0)
        self.assertEqual(output["error"]["code"], "ARGUMENT_INVALID")


if __name__ == "__main__":
    unittest.main(verbosity=2)
