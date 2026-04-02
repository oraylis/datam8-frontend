# DataM8 Neon Architecture (HTTP + Jobs)

## High-Level View
```
[Electron shell] ── spawns bundled `datam8 serve` (FastAPI) ──(HTTP/SSE, token-auth)──▶ [Backend]
        │
        │ (passes baseUrl + token via additionalArguments + preload)
        ▼
[Web UI (React/Vite)] ── calls /api/* + /jobs/* ── subscribes /jobs/:id/events (SSE)
```

## Modules & Responsibilities
- **Web (`apps/web`)**
  - Layout + ribbon + tabs: `src/app/AppShell.tsx`, `features/model/ModelEditorContext.tsx`.
  - Workspace composition: `features/model/components/Workspace.tsx` → entity editor (`workspace/entity-editor/*`), base editor (`workspace/base-editor/*`), new entity wizard (`CreateModelEntityWizard.tsx`).
  - Solution loading: `features/solution/*` (desktop path, file upload, server list).
  - Generator panel: `features/generator/*` (starts `generate` Job, streams logs via SSE).
  - Filesystem picker: `features/fs/FileSystemContext.tsx`.
- **Desktop (`apps/desktop`)**
  - Main process: `src/main.ts` spawns `datam8 serve --host 127.0.0.1 --port 0 --token <random>`, parses readiness JSON from stdout, verifies `/health`, then creates the BrowserWindow.
  - Preload: `src/preload.ts` exposes `{ apiBase, token }` + native dialogs + theme events to the renderer.
  - Packaging: electron-builder bundles the `datam8` binary into `resources/bin/<platform>/datam8(.exe)`.
- **Backend (submodule)**
  - `submodules/datam8-generator` is the single source of truth for the `datam8` CLI, FastAPI server, and Job system.

## Backend Lifecycle (Desktop-safe)
Neon starts the backend once and keeps it long-lived:
- Spawn: `datam8 serve --host 127.0.0.1 --port 0 --token <random>`
- Readiness: backend prints exactly one JSON line to stdout:
  - `{"type":"ready","baseUrl":"http://127.0.0.1:<PORT>","version":"<cliVersion>"}`
- All other logs go to stderr.

## Security Model
- Backend binds to `127.0.0.1` by default.
- Token-based auth for all non-health endpoints:
  - `Authorization: Bearer <token>`
- Unauthenticated: `GET /health`, `GET /version`

## Long Tasks (Jobs)
Anything that can take > ~1s is a Job:
- Create: `POST /jobs` `{ "type": "<jobType>", "params": { ... } }`
- Inspect: `GET /jobs/:id`
- Cancel: `POST /jobs/:id/cancel` (best-effort)
- Stream: `GET /jobs/:id/events` (SSE: status/log/progress/result/error)

## Data Flow (UI)
1) **Solution discovery**: Web uses `/api/fs/list` or desktop file picker to locate a `.dm8s`.
2) **Load**: Web calls `/api/solution/full` and `/api/*` entity endpoints (legacy surface retained for parity).
3) **Edit**: Web maintains per-tab drafts, then saves via `/api/model/entities` and `/api/base/entities`.
4) **Index**: long-running index work is started as `POST /jobs` with `{ type: "index" }`.
5) **Generate**: generator runs as `POST /jobs` with `{ type: "generate" }` and streams logs via SSE.

## Build & Runtime Notes
- Dev: `npm run dev:desktop` expects a `datam8` binary (override with `DATAM8_CLI_PATH`).
- Packaging: electron-builder bundles `submodules/datam8-generator/dist/bin/<platform>/datam8(.exe)` into `resources/bin/<platform>/`.
