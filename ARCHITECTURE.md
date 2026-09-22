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
  - Generator panel: `features/generator/*` (runs synchronous `POST /generate` and displays returned messages).
  - Filesystem picker: `features/fs/FileSystemContext.tsx`.
- **Desktop (`apps/desktop`)**
  - Main process: `src/main.ts` spawns `datam8 serve --host 127.0.0.1 --port 0 --token <random>`, parses readiness JSON from stdout, verifies `/health`, then creates the BrowserWindow.
  - Preload: `src/preload.ts` exposes `{ apiBase, token }` + native dialogs + theme events to the renderer.
  - Packaging: electron-builder bundles a Python runtime under `resources/python-runtime`; production starts `python -m datam8`.
- **Backend (submodule)**
  - `submodules/datam8-generator` is the single source of truth for the `datam8` CLI, FastAPI server, and backend contract.

## Backend Lifecycle (Desktop-safe)
Frontend starts the backend once and keeps it long-lived:
- Spawn: `python -m datam8 serve --host 127.0.0.1 --port 0 --token <random>`
- Readiness: backend prints exactly one JSON line to stdout:
  - `{"type":"ready","baseUrl":"http://127.0.0.1:<PORT>","version":"<cliVersion>"}`
- All other logs go to stderr.

## Security Model
- Backend binds to `127.0.0.1` by default.
- Token-based auth for all non-health endpoints:
  - `Authorization: Bearer <token>`
- Unauthenticated: `GET /health`, `GET /version`

## Backend Calls
Frontend uses root endpoints. There is no `/api/*` namespace and no Jobs/SSE layer in the current contract.

- Solution load: `GET /solution/inspect`, `GET /solution/full`
- File-system picker: `GET /fs/list`
- Generate: synchronous `POST /generate`
- Validate: synchronous `POST /validate`
- Editor operations use root model/base/entity/refactor/plugin/secret endpoints.

## Data Flow (UI)
1) **Solution discovery**: Web uses `GET /fs/list` or desktop file picker to locate a `.dm8s`.
2) **Load**: Web calls `GET /solution/full`.
3) **Edit**: Web maintains per-tab drafts, then saves through root model/base/entity endpoints.
4) **Generate/Validate**: Web sends synchronous `POST /generate` or `POST /validate` and renders returned messages.

## Build & Runtime Notes
- Dev: `npm run dev:desktop` expects the `submodules/datam8-generator/.venv` Python interpreter, or `DATAM8_PYTHON_PATH` pointing to a compatible Python.
- Packaging: `npm run build:python-runtime` creates the runtime copied into desktop packages.
