#!/usr/bin/env python3
"""Verify real stdio clients share local memory; uses no model or paid service."""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from importlib.metadata import version
import json
from pathlib import Path
import shutil
import subprocess
import uuid

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]
RUN = uuid.uuid4().hex
DIRECTORY = f"verification/smoke-{RUN}"
TEMP_NOTES = ROOT / "docs/memory" / DIRECTORY
REQUIRED = {"read_note", "search_notes", "write_note", "edit_note", "build_context", "recent_activity", "list_directory"}
REPORT = {"timestamp": datetime.now(timezone.utc).isoformat(), "basic_memory": version("basic-memory"), "checks": [], "success": False}


def passed(name):
    REPORT["checks"].append(name)
    print(f"PASS: {name}", flush=True)


@asynccontextmanager
async def client(log):
    params = StdioServerParameters(command="/bin/bash", args=[str(ROOT / "scripts/memory-server.sh")], cwd=ROOT)
    async with stdio_client(params, errlog=log) as streams:
        async with ClientSession(*streams, read_timeout_seconds=60) as session:
            await session.initialize()
            yield session


async def call(session, tool, args):
    result = await session.call_tool(tool, arguments={"project": "livingforma", **args})
    if result.is_error:
        raise RuntimeError(f"{tool} returned an MCP error: {result.model_dump_json()[:1200]}")
    return result.model_dump_json()


async def run(log):
    title_a, title_b = f"Smoke A {RUN}", f"Smoke B {RUN}"
    marker_a, marker_b = f"lfmemorya{RUN}", f"lfmemoryb{RUN}"
    async with client(log) as a:
        names = {tool.name for tool in (await a.list_tools()).tools}
        assert REQUIRED <= names, f"Missing tools: {REQUIRED - names}"
        passed("MCP initialize and all configured tools are available")
        async with client(log) as b:
            await asyncio.gather(
                call(a, "write_note", {"title": title_a, "directory": DIRECTORY, "content": f"# Client A\n\n{marker_a}\n", "overwrite": False}),
                call(b, "write_note", {"title": title_b, "directory": DIRECTORY, "content": f"# Client B\n\n{marker_b}\n", "overwrite": False}),
            )
            passed("Two separate server processes write distinct notes concurrently")
            read_a, read_b = await asyncio.gather(
                call(b, "read_note", {"identifier": title_a}),
                call(a, "read_note", {"identifier": title_b}),
            )
            assert marker_a in read_a and marker_b in read_b, "Cross-client read did not contain both markers"
            passed("Each client reads the other client's note")
            # File reads and full-text index visibility can complete at different times.
            for attempt in range(10):
                found = await call(b, "search_notes", {"query": marker_a, "search_type": "text"})
                if title_a in found:
                    break
                await asyncio.sleep(1)
            REPORT["search_attempts"] = attempt + 1
            if title_a not in found:
                REPORT["search_failure_result"] = found[:4000]
                raise AssertionError("Cross-client full-text search did not find the note within 10 attempts")
            passed("Cross-client keyword search finds newly written content within a bounded index wait")
    async with client(log) as c:
        result = await call(c, "read_note", {"identifier": title_a})
        assert marker_a in result, "Memory did not survive server restart"
        passed("Memory persists after both servers stop and a fresh server starts")
        context = await call(c, "read_note", {"identifier": "shared/project-context.md"})
        assert "LivingForma" in context, "Existing shared context not readable"
        passed("Existing project shared context is readable")


def main():
    (ROOT / ".local").mkdir(exist_ok=True)
    report_path = ROOT / ".local/memory-smoke-report.json"
    try:
        with (ROOT / ".local/memory-smoke-server.log").open("w") as log:
            asyncio.run(asyncio.wait_for(run(log), timeout=180))
        REPORT["success"] = True
    except BaseException as exc:
        REPORT["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        # Only delete the unique directory created by this run, after clients stop.
        if TEMP_NOTES.exists():
            shutil.rmtree(TEMP_NOTES)
        cleanup = subprocess.run(["bash", str(ROOT / "scripts/memory.sh"), "reindex", "--project", "livingforma", "--search"], cwd=ROOT, capture_output=True, text=True)
        REPORT["cleanup_reindex_ok"] = cleanup.returncode == 0
        if cleanup.returncode:
            REPORT["success"] = False
        report_path.write_text(json.dumps(REPORT, indent=2) + "\n")
        print(f"Report: {report_path}")
    if not REPORT["success"]:
        raise SystemExit("Smoke cleanup failed; inspect the report.")


if __name__ == "__main__":
    main()
