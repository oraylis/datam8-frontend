# DataM8

DataM8 2.0 is a metadata editor: a React 19/Vite web app and an Electron desktop
shell backed by the Python DataM8 Generator.

## Start here

- **Using DataM8:** [illustrated sample-solution guide](docs/user-guide/README.md).
- **Contributing:** [AGENTS.md](AGENTS.md) and [documentation index](docs/index.md).
- **System:** [architecture](ARCHITECTURE.md) and [backend integration](docs/backend-contract.md).

## Local development

Use Node **24** (25+ unsupported), Python compatible with the pinned Generator,
and `uv`. Initialize nested submodules and install locked dependencies:

```sh
git submodule update --init --recursive
npm ci
cd submodules/datam8-generator
uv sync --all-extras
cd ../..
npm run dev:desktop
```

Desktop starts the backend and UI. See [Desktop development](docs/dev-desktop.md)
for interpreter overrides. Browser development needs a backend bound to a working
copy of a solution, then Vite in another terminal:

```powershell
# Terminal 1, Windows, repo root

& .\submodules\datam8-generator\.venv\Scripts\python.exe -m datam8 serve --host 127.0.0.1 --port 4318 --solution C:\DataM8\sample\ORAYLISDatabricksSample.dm8s
# Terminal 2

$env:VITE_API_URL = 'http://127.0.0.1:4318'
npm run dev:web
```

```sh
# Terminal 1, macOS/Linux

submodules/datam8-generator/.venv/bin/python -m datam8 serve --host 127.0.0.1 --port 4318 --solution /path/to/copy/ORAYLISDatabricksSample.dm8s
# Terminal 2

VITE_API_URL=http://127.0.0.1:4318 npm run dev:web
```

Open `http://localhost:4320`. Vite proxies root API requests to `VITE_API_URL`; its
fallback is `http://127.0.0.1:51092`. The local browser example binds to loopback
without a token. Desktop always supplies a token. Browser **Load** reads the bound
solution; changing the dialog path does not switch backend workspaces.

## Repository layout

| Directory | Responsibility |
| --- | --- |
| `apps/web` | Editor, loading, autosave, connectors and generator |
| `apps/desktop` | Backend lifecycle, native dialogs, IPC and packaging |
| `packages/ui` | UI primitives and theme |
| `packages/types` | Hand-written shared types; web schema types are generated separately |
| `submodules/datam8-generator` | Pinned backend and nested schema submodule |
| `docs` | Development, consumer references, capture maintenance and links to the central handbook |

## Verification and builds

```sh
npm run docs:check
npm run typecheck
npm --workspace apps/web run test
npm run test:e2e
npm run ci:gates
npm run build:web:electron
```

Packaging: `npm run build:desktop`, or its `:win`, `:mac`, `:linux` variants.
See [release checks](docs/release.md), [troubleshooting](docs/troubleshooting.md)
and [opt-in screenshot maintenance](docs/user-guide/capture.md).
