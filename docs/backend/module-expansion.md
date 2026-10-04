# Module presentation persistence

Implemented and verified for LF-203 on 2026-10-03, America/Vancouver. This documents the backend used by the 60-type module expansion; it does not certify frontend rendering or mobile layout.

## Request and response

`POST /api/spaces/:slug/presentation` accepts the shared `presentationRequestSchema`:

```json
{
  "requestId": "890b815b-b4a0-4eb0-bb78-372f85243bf2",
  "baseDefinitionVersion": 1,
  "layout": "dashboard",
  "components": [
    {
      "id": "focus",
      "type": "pomodoro",
      "version": 1,
      "size": {"columns": 4, "minHeight": 240},
      "config": {"durationSeconds": 1500}
    }
  ]
}
```

The response is a `Snapshot`, without a proposal wrapper. `components` replaces the complete component array, with 1–24 instances. `layout` is optional and retains its prior value when omitted. The shared schema bounds sizes/configuration, rejects unknown keys, and permits only registered types, variants, field bindings and action types. Each manifest defines its allowed configuration keys; configuration contains scalar presentation values, not field references or executable code.

The endpoint requires the existing signed-in Owner session, exact Origin and CSRF token. Participants receive 403 and anonymous callers receive 401. A private space remains undiscoverable to nonmembers (404). A blank space returns `SPACE_UNCONFIGURED` (409); its first definition still comes through the ordinary creation/planning flow.

## Transaction and concurrency

The server locks the space row and checks ownership, durable request replay, the current definition version, full definition/evolution validation, and enabled tool references. It then increments `definitionVersion`, updates the presentation summary, persists one `definition.published` event and remembers the request in the same transaction. Invalid changes roll everything back and do not consume the request ID.

The entity schema (including schemaVersion), actions, space metadata, records, record versions/timestamps and stateVersion are preserved. Presentation saves do not perform schema backfills or call the planner, a model provider, a tool test, or a tool invocation. Tool-result components may reference only an existing enabled tool in the same space at the exact registered version; saving never enables a tool.

Replay fingerprints include the operation name and parsed request. Identical concurrent requests publish once. A repeat returns the current authoritative snapshot, even after subsequent publications, without restoring an old layout. Reusing a request ID with another payload returns `REQUEST_ID_CONFLICT` (409). Distinct concurrent requests based on the same version have one winner; the other returns `DEFINITION_CONFLICT` (409). Clients must refresh and reconcile their draft rather than overwrite the winning revision.

The event follows the existing durable SSE protocol. Other clients fetch their own authorized snapshot after `definition.published`; the event contains versions/cursors only, not business data or configuration.

## Public projection

Projection uses the registered manifest for each component, and applies to all 60 types without a type-name allowlist. Tools remain Owner-only. Private field values, schema fields, action references, sort bindings and emphasis bindings are removed for visitors/participants. A component whose explicit groupBy, dateField or valueField is private is omitted, preventing an accidental fallback to another visible field. Fields-based collections retain their visible fields; a component with exclusively private field bindings is omitted. Safe size/configuration values survive projection.

No-field local utilities remain visible when the space has a public schema. The existing zero-public-fields/zero-visible-components rule still returns an empty public view. Backend public projection does not grant permission to use the camera or any other Owner-only capability.

## Verification

- `apps/api/src/presentation.test.ts`: 10 isolated Fastify/PGlite tests cover persistence and unchanged records/schema/actions, role/Origin/CSRF enforcement, concurrent/stale edits, durable replay and conflicting IDs, malformed definitions, tool enablement/version checks, blank/private spaces, anonymous SSE publication, projection across all 60 catalog entries, and physical disk database close/reopen.
- Presentation + existing API + delayed-authorization regression suites: 35/35 tests passed. The final projection regression rerun passed 10/10.
- Scoped TypeScript checking of app/domain/presentation tests passed; API production bundle and `git diff --check` passed.
- Root TypeScript checking was attempted during parallel work and stopped on a transient frontend analytics syntax error; final repository integration checking belongs to the coordinator.
- All database tests used isolated local PGlite. No cloud database, provider, paid resource, deployment, commit or push was used.
