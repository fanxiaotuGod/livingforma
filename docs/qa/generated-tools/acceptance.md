# Independent generated-tool acceptance

LF-223, 2026-10-04 America/Vancouver. [11/11 results](results.json), [reusable actual HTTP/QuickJS script](../../../tests/e2e/generated-tools.ts). Full page/bridge evidence and boundaries are in [the combined acceptance](../generated-sites/acceptance.md).

Verified: Owner/Origin/CSRF registration gates; actual fixtures without premature registry enablement; wrong expected output rejection; immutable exact source/version; real fresh-input computation; completed request replay with unchanged invocation/audit count; input/binding/definition/role gates; v1/v2 coexistence and distinct outputs; metadata-only exact reuse; private-field capability rejection; registry, session, replay and business records retained through physical server/database restart; interrupted pending reservation truthfully failed without automatic execution; disabled/logged-out calls denied.

The service-quote source computed **16.9** in v1 and **17.4** in v2 for the same actual input. Three completed audit rows survived restart unchanged; replay added none. New version registration retained the old source. Actual broker aggregation and browser invocation are additionally verified by the 8-scenario website script.

Source generation is an explicit offline fixture. The pending restart state is deliberately inserted crash-state data, not a claim that a live remote request was killed. Neither tool fixtures nor QA call external connectors or providers. Whole-process RSS, horizontal exactly-once behavior and real cloud deployment are outside this evidence.
