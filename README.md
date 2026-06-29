# DataM8

DataM8 is the DataM8 2.0 workspace: a React/Vite web app and an Electron shell that starts the DataM8 backend and communicates over HTTP.

## Apps and Tech Stack
- `apps/web` - Vite + React 18 UI with `@datam8/ui`, tabbed workspace, generator panel.
- `apps/desktop` - Electron main/preload that starts backend and hosts the web app.
- `packages/ui` - shared UI kit.
- `packages/types` - shared type package.

## Repository Layout
- `apps/web/src/features` - solution loading, model/base workspace, generator, filesystem picker.
- `apps/desktop/src` - Electron process logic and preload bridge.
- `submodules/datam8-generator` - backend source of truth (`datam8` CLI + FastAPI).
- `packages/ui`, `packages/types` - shared packages consumed by apps.

Legacy cleanup:
- `packages/datam8_cli` was removed from this repository. Frontend uses `submodules/datam8-generator` as backend runtime.

## Prerequisites
- Node.js 20.x or 22.x LTS (repo uses npm workspaces; Node 25+ is unsupported).
- Python 3.12+ for local desktop dev/backend runs. (handled by `uv sync`)
- `uv` for preparing `submodules/datam8-generator/.venv`.

## Development
Install dependencies once:
```bash
npm install
```

Start web:
```bash
npm run dev:web
```

Start desktop:
```bash
cd submodules/datam8-generator
uv sync --all-extras
cd ../..
npm run dev:desktop
```

Key runtime env vars:
- `DATAM8_PYTHON_PATH` - dev-only override; must point to `submodules/datam8-generator/.venv` Python.
- `DATAM8_BACKEND_MODULE` - optional module override (default `datam8`).
- `VITE_API_URL`, `VITE_APP_MODE` - web runtime config.

## Build and Package
- Web build (electron mode): `npm run build:web:electron`
- Backend runtime artifacts: `npm run build:datam8-binaries`
- Desktop packages:
  - current OS: `npm run build:desktop`
  - explicit: `npm run build:desktop:win`, `npm run build:desktop:mac`, `npm run build:desktop:linux`

## API Contract
- Canonical backend contract: `submodules/datam8-generator/docs/backend-contract.md`
- Frontend mirror: `docs/backend-contract.md`
- Frontend uses root endpoints (no `/api/*`), for example:
  - `GET /config`
  - `GET /solution/inspect`, `GET /solution/full`, `POST /solution/new-project`
  - `GET /fs/list`
  - `POST /generate` (synchronous)

Removed:
- `/jobs` and `/jobs/*`
- `/api/*`

## Verification
- Typecheck: `npm run typecheck`
- Contract smoke: `npm run ci:gates`

## Troubleshooting
See `docs/troubleshooting.md`.


