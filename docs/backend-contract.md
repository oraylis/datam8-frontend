# Backend Integration (Frontend Consumer View)

The [Generator contract](../submodules/datam8-generator/docs/backend-contract.md)
is authoritative. This page covers frontend consumption and limitations, without
duplicating payload specifications. Use the Generator revision pinned by this
frontend checkout; matching version numbers alone do not establish compatibility.

## Runtime and flows

- Electron starts `python -m datam8 serve` on loopback with a token, parses readiness
  and exposes connection details through preload.
- Browser loads the startup-bound workspace through `/solution/full`. The dialog
  path is retained for UI state but does not select another server workspace.
- Editor updates use `/entities/*` and `/model/save`; Reload uses `/model/reload`.
- Browser generation uses synchronous `POST /model/generate`. Desktop delegates
  generation to the CLI through preload. There is no Jobs/SSE layer.
- Connector forms/discovery use `/plugins/*`; navigation/import/refresh use `/sources/*`;
  secrets use `/secrets/check` and `/secrets/set`.

See the canonical contract for envelopes, locators, source ownership, metadata
handles, inheritance and function details.

## Compatibility boundaries

The canonical document includes a **historical Neon parity surface**. Do not treat
`/generate`, `/fs/list`, `/connectors/*`, `/solution/inspect`, `/solution/new-project`,
`/validate` or migration parity routes as available based on historical docs.

- `FileSystemContext` still contains a `/fs/list` consumer; the current solution dialog
  uses a bound-workspace flow instead of that filesystem browser.
- New Project and migration controls are not guaranteed end-to-end flows against
  the pinned backend. Start the tutorial from a complete sample copy.
- Uploading `.dm8s` alone does not supply its referenced Base, Model, Plugins or templates.
- Function retrieval/update/move use the API; initial file creation/deletion need
  the constrained Electron file bridge.
- There is no separate solution-validation UI; Generate surfaces validation errors.

## Change policy

Assess contract impact. For HTTP behavior changes, update Generator's canonical
contract first, coordinate consumers and add real completion/state tests.
Documentation corrections describing existing behavior do not change the contract.
