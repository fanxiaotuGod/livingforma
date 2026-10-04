# Generated backend tools

Implemented by LF-225 · 2026-10-04 00:02 America/Vancouver. The source generator is implemented and verified offline through real Pi and the Backend QuickJS worker. Real Gemini quality, the complete browser workflow and production deployment remain coordinator acceptance under LF-227/LF-228.

## Entry points and single-request generation

`@livingforma/agent` exports `generateTool: GeneratedToolGenerator` and `generateSite: SiteGenerator`. Both require the existing injected durable ProviderBudgetStore even in development. Each invocation makes at most one Pi/Gemini provider request, with 6000 output tokens, the existing 60-second runtime deadline, no provider retries, one active run, verified free-tier gate and the existing 30/day and 5/minute reservation limits. The API may have a shorter route deadline. Cancellation never refunds a reserved request. There is no new ledger or paid fallback.

`generateTool` exposes one Pi tool, `submit_tool`, which creates an original tool candidate or selects an exact registered generated-tool version. It does not execute source, test, register, enable or publish. The generator is generic: requested arithmetic, text processing, aggregation or transformation is authored by the model rather than selected from production keyword templates.

`generateSite` exposes the existing single `submit_site` tool, now with optional `codeTools` and `toolBindings`. One completion contains the complete custom page plus any original backend source it needs. It does not spend an extra request to plan tools or to animate progress. Existing compatible metadata is preferred for reuse; reused tools are omitted from `codeTools`. Code/schema/capability changes require a new version.

## Model representation and host boundary

The model tool schema has original JavaScript `source`, metadata, declared read-only `capabilities`, and three bounded JSON strings: `inputSchemaJson`, `outputSchemaJson`, `testsJson`. This avoids recursive JSON-schema references in Gemini function parameters. The strings are parsed and validated into the shared, ordinary-object `GeneratedToolSpec`; host proposals use `Proposal.codeToolProposals`, not the string representation. Malformed JSON or malformed shared shape fails truthfully without an internal retry or fabricated candidate.

Source declares `function run(input, api)`, optionally async. Inputs and outputs are bounded JSON objects with declared schemas; the model supplies two to five synthetic fixture cases. Private records/defaults, real provider responses and credentials are not supplied for fixture generation. Only the Backend-owned mature QuickJS worker executes this guest code. No model source is imported/evaluated as Node code or sent to a host shell.

The prompt matches the accepted runtime:

- `api.readRecords({fields,limit})` returns `{id,version,values}[]`, with at most 100 records and only declared public fields of the current/proposed schema.
- `api.callConnector({toolId,toolVersion,input})` returns a connector result object. Only already-enabled exact versions of catalog read-only connectors are allowed; there is no generated-tool recursion, arbitrary URL or new provider spending.
- Broker fixtures use `records` and `connectorResults`; actual fixture execution is a host concern. Limits match the shared 4-second deadline, 32 MiB guest heap, 256 KiB stack, eight broker calls, 32 KiB source and 64 KiB JSON. These are not a promise of a hard total Node process RSS cap.

For site generation, well-shaped candidates with syntax, fixture or dependency problems remain available to the host for its one repair across page source, tool tests and browser checks. Local checks are advisory and never enable a tool. The Host rejects failed candidates, checks exact versions/capabilities, executes fixtures, and atomically registers tested candidates together with the Owner's explicit publication. The generator does not claim a candidate was tested merely because it is syntactically valid.

## Page bindings and discovery

Model context contains enabled generated manifests without source/tests, and enabled catalog metadata without endpoint/session/operational data. Explicit projection and strict parsing prevent accidental records, fixture values or credentials from being included. Current and repair definitions omit private field defaults again at the generator boundary; the Host restores trusted private metadata. Existing record schemas and generated component identity are preserved according to the shared evolution checks.

Every page tool action uses `toolBindings: {actionId,toolId,toolVersion,kind}`. The current generated-page action list retains tool.invoke actions. `lf.ready` exposes public binding metadata and `permissions.canUseTools`. `lf.runTool(id,version,input)` returns the envelope `{toolId,toolVersion,result,reused}`; generated code uses `response.result` separately from record state. Tools are Owner-only. Preview renders an honest disabled “Publish to run tool” control and still calls `lf.reportReady()`; tools are not invoked on startup or subscription updates.

## Actual progress and privacy

Only actual Pi `message_update` events for `submit_site` / `submit_tool` are inspected. A non-empty tool source snapshot with safe ID/name emits `tool.phase=writing`. Duplicate source snapshots are suppressed and updates are bounded. No tool source is put into frontend JavaScript progress fields, and no arbitrary model text, thinking, raw argument deltas, credentials or fixture contents enter progress. Host `testing/ready/failed` events come from real validation/execution, not generator assertions.

The installed Google Pi SDK commonly emits complete function-argument snapshots. This supports truthful outline/source → host tests → validated preview transitions; it does not establish character-by-character streaming or repeated UI morphs. No timer-created progress or extra model call is used to imply otherwise.

## Evidence and reproduction

`packages/agent/src/tool-generator.test.ts` adds 11 tests using real Pi with a clearly offline Google transport. Four distinct source/fixture sets—weighted values, word normalization, public-record aggregation and enabled-connector transformation—are parsed then tested by the actual Backend QuickJS worker. Broker data is synthetic; no connector request is sent. A combined page/tool case verifies exact bindings, real result `{total:9}`, stable saved schema and enabled-version reuse. A deliberately wrong algorithm fails actual fixture comparison, then a separately requested host repair passes; the two calls reserve exactly two fixture-budget entries.

Other coverage includes actual partial writing events, source-free metadata discovery, private-default removal, unknown versions, malformed JSON, exact read-only dependencies, absent/exhausted durable budget, cancellation and bounded sensitive-progress filtering. Test intent fixtures are not production templates.

Verified 2026-10-03 23:58 America/Vancouver:

- `pnpm exec vitest run packages/agent/src`: 107/107 passed across five files, including all 60-module, source-generation and media regressions.
- `pnpm typecheck`: passed across the repository.
- `git diff --check`: passed.

No real Gemini/ElevenLabs call, .env read, budget reset, new dependency, advanced bypass reproduction, Git publication or deployment was performed in LF-225. Root owns the real model/browser/deployment acceptance.


## LF-230 compatibility follow-up

2026-10-04: Site and standalone tool authoring now use the same provider-only compact function schema projection. It omits regex and length/item/range constraints in the decoding grammar while keeping the original strict Pi/Host validators, budget, one-call limit and complete structured shape. Real source generation was accepted after the projection; the coordinator's complete page candidate and in-app browser startup passed. This is ordinary request compatibility, not a relaxation of tool capabilities or proof that every generated algorithm is correct. New safe provider/candidate diagnostics and a caller-opted-in redacted site-candidate observer support precise failures without exposing thinking, raw private context or credentials. The standalone tool's exact-version/fixture/runtime behavior remains covered offline; coordinator owns real generated-tool acceptance. See the LF-230 role handoff and generated-sites follow-up for evidence and the honestly unknown run-3 candidate failure.
