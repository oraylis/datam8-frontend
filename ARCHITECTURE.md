# DataM8 Architecture (HTTP Root Endpoints)

## High-Level View

```
[Electron shell] ── spawns `python -m datam8 serve` (FastAPI) ──(HTTP, token-auth)──▶ [Backend]
        │
        │ (passes baseUrl + token via additionalArguments + preload)
        ▼
[Web UI (React/Vite)] ── calls root backend endpoints (no /api/* namespace)
```

## Modules & Responsibilities

- **Web (`apps/web`)**
  - Layout + ribbon + tabs: `src/app/AppShell.tsx`, `features/model/ModelEditorContext.tsx`.
  - Workspace composition: `features/model/components/Workspace.tsx` → entity editor (`workspace/entity-editor/*`), base editor (`workspace/base-editor/*`), new entity wizard (`CreateModelEntityWizard.tsx`).
  - Solution loading: `features/solution/*` (desktop path, file upload, server list).
  - Generator panel: `features/generator/*` (browser uses synchronous `POST /model/generate`; desktop delegates through preload to the CLI).
  - Retained legacy filesystem context: `features/fs/FileSystemContext.tsx`; the active dialog does not browse the server filesystem.
- **Desktop (`apps/desktop`)**
  - Main process: `src/main.ts` spawns `datam8 serve --host 127.0.0.1 --port 4318 --token <random>`, parses readiness JSON from stdout, verifies `/health` when a solution is opened. The window can start before a solution/backend is loaded.
  - Preload: `src/preload.ts` exposes `{ apiBase, token }` + native dialogs + theme events to the renderer.
  - Packaging: electron-builder bundles a Python runtime under `resources/python-runtime`; production starts `python -m datam8`.
- **Backend (submodule)**
  - `submodules/datam8-generator` is the single source of truth for the `datam8` CLI, FastAPI server, and backend contract.

## Backend Lifecycle (Desktop-safe)

Frontend starts the backend for the selected solution and replaces it when switching solutions:
- Spawn: `python -u -m datam8 serve --host 127.0.0.1 --port 4318 --token <random>`
- Readiness: backend prints exactly one JSON line to stdout:
  - `{"type":"ready","baseUrl":"http://127.0.0.1:<PORT>","version":"<cliVersion>"}`
- All other logs go to stderr.
- HTTP health is checked only after the launched process reports readiness. An
  unrelated listener on the backend port is never stopped or adopted as the backend.

## Security Model

- Backend binds to `127.0.0.1` by default.
- Token-based auth for all non-health endpoints:
  - `Authorization: Bearer <token>`
- Unauthenticated: `GET /health`, `GET /version`

## Backend Calls

Frontend uses root endpoints. There is no `/api/*` namespace and no Jobs/SSE layer in the current contract.

- Solution load: browser uses `GET /solution/full`; desktop loads through its IPC bridge.
- The retained filesystem context references `/fs/list`; this is not an implemented picker in the pinned backend.
- Generate: browser uses synchronous `POST /model/generate`; desktop uses the CLI bridge.
- Validation errors are surfaced by generation; there is no separate validation UI.
- Editor operations use root model/base/entity/refactor/plugin/secret endpoints.

## Data Flow (UI)

1) **Solution selection**: Desktop uses a native picker and restarts/binds its backend to the selected solution. Browser uses the solution bound at backend startup; its dialog path does not switch workspaces.
2) **Load**: Browser calls `GET /solution/full`; desktop uses its constrained bridge.
3) **Edit**: Web maintains per-tab drafts, then saves through root model/base/entity endpoints.
4) **Generate**: Browser sends synchronous `POST /model/generate`; desktop delegates to the CLI. The UI renders completion or validation/generation errors.

The [consumer constraints](docs/backend-contract.md) distinguish implemented routes
from historical parity entries. Do not infer route availability from old docs.

## Entity Lineage

The single Lineage icon beside the entity name toggles between the section editor
and a read-only React Flow graph. It is filled with the theme accent while active;
another click restores the previous section and its navigation. The entity
header/properties, sidebar and workspace tabs remain visible.
Inline Direction / Depth controls are anchored inside the flow at the top right; the
interactive Sources / Relationships legend is anchored inside the flow at the
bottom right, above attribution and clear of the zoom controls. The active
mode icon has an accessible label, pressed state and action tooltip.
View switches use the existing autosave gate.
`features/model/lineage/buildLineageGraph.ts` derives design-time data flow from
loaded `sources[].sourceLocation` references and external data source/location
pairs. A separate, independently switchable relationship layer shows direct
incoming and outgoing relationships around the visible source graph as dashed
connections without data-flow arrows. Relationships never expand source traversal.
The current entity overlays its form, attribute, source and relationship drafts;
other entities use the loaded model state. This needs no additional HTTP route or
schema field.

The view defaults to one level upstream and downstream, offers direction and
depth (1–3) filters, and caps rendering at 80 nodes with a truncation notice.
Missing or ambiguous internal references remain visible without navigation.
A simple breadth-first column layout handles cycles without a layout dependency.
Opening an internal node uses the existing entity navigation and autosave gate.
Zoom, pan and filters do not modify model metadata or persist diagram positions.
The current node has a collapsible Schema without an attribute count. Selecting
an attribute highlights explicit source/relationship mappings and lists their
endpoints. These interactions are read-only and do not infer SQL/Python lineage.

## Build & Runtime Notes

- Dev: `npm run dev:desktop` expects the `submodules/datam8-generator/.venv` Python interpreter; an override must point to that environment's interpreter.
- Packaging: `npm run build:python-runtime` creates the runtime copied into desktop packages.
