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
and a read-only React Flow graph. Its button uses the theme accent while active,
with filled circular nodes and unfilled connecting paths;
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
incoming and outgoing relationships of the current entity as dashed connections
without data-flow arrows. Relationships between other entities are omitted even
when both endpoints are visible. Relationships never expand source traversal.
The current entity overlays its form, attribute, source and relationship drafts;
other entities use the loaded model state. This needs no additional HTTP route or
schema field.

Loaded metadata is indexed by reference and adjacency once per model/draft update;
direction, depth, layer and folder grouping changes query the index. The view
defaults to one level upstream and downstream; Direction and Depth (1–3) are the
only controls for source traversal. Entity nodes have no Explore/Collapse action.
Large neighborhoods (over 40 entities) summarize folders within each
level when at least four members share a folder. Show entities reveals up to 12
members at a time; Reset groups restores the folder summaries without changing
direction or depth.
Rendering is bounded at 80 nodes and 160 edges with a truncation notice. The focus
and its incident edges have priority; disconnected fragments are omitted. The
interactive view also limits edge density to twice the node count (at least 24,
at most 160 connections), so folder summaries cannot create an unrestricted mesh.
Missing or ambiguous internal references remain visible without navigation.
`layoutLineageGraph.ts` prepares an ELK layered, orthogonal layout with separate
ports per edge: sources connect east/west and relationships south/north. React Flow
renders ELK's actual bend points rather than independently calculating edge paths.
Node dimensions include schema expansion and port spacing. The initial viewport
includes routed edge extents. `useLineageLayout.ts` runs ELK in a Vite worker,
terminates superseded requests and ignores late results. `LineageLayoutRunner`
reuses the worker across completed requests, releases it after 60 seconds idle,
and caches 32 geometry results without drafts or navigation callbacks. Hovering or
focusing the mode button preloads the view and warms the worker. Cached layouts
render immediately; rapid changes are coalesced for 40 ms. During recalculation,
the previous graph and its matching schema geometry remain visible. A progress
hint appears only after 250 ms. Layout failure/timeout offers a retry; filters and
the editor toggle remain available during layout.
Opening an internal node uses the existing entity navigation and autosave gate.
Zoom, pan and filters do not modify model metadata or persist diagram positions.
Selecting an entity name highlights its incident connections and dims other paths.
The current node has a collapsible Schema without an attribute count. Selecting
an attribute highlights explicit source/relationship mappings in the graph;
no mapping detail panel is shown below it. These interactions are read-only and
do not infer SQL/Python lineage.
Self-contained routing fixtures cover branching, cycles, parallel edges, self loops,
expanded schemas and dense bounded views. Selection tests include a 10,000-entity
index; this is coverage of bounded exploration, not an unlimited-size guarantee.

## Build & Runtime Notes

- Dev: `npm run dev:desktop` expects the `submodules/datam8-generator/.venv` Python interpreter; an override must point to that environment's interpreter.
- Packaging: `npm run build:python-runtime` creates the runtime copied into desktop packages.
