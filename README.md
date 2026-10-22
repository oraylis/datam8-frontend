# DataM8

DataM8 2.0 is a metadata editor: a React 19/Vite web app and an Electron desktop
shell backed by the Python DataM8 Generator.

## Start here

- **Using DataM8:** [illustrated sample-solution guide](docs/user-guide/README.md).
- **Contributing:** [AGENTS.md](AGENTS.md) and [documentation index](docs/index.md).
- **System:** [architecture](ARCHITECTURE.md) and [backend integration](docs/backend-contract.md).

## Local development

### Prerequisites

- Node.js **24** with npm (25+ unsupported).
- Python compatible with the checked-out Generator; see `requires-python` in its
  [project configuration](submodules/datam8-generator/pyproject.toml).
- `uv` to create the backend's virtual environment and install its dependencies.

### 1. Set up the repository

From the repository root, initialize all nested submodules and install dependencies.
Run this once after cloning:

```sh
git submodule update --init --recursive
npm ci
cd submodules/datam8-generator
uv sync --all-extras
cd ../..
```

### 2. Start the app

Choose **Desktop** or **Browser**. Run the commands below from the repository root.

#### Desktop

Use one terminal:

```sh
npm run dev:desktop
```

This starts the Electron app and the UI development server. Load a solution in
the app; Desktop starts and manages the backend automatically when needed.
See [Desktop development](docs/dev-desktop.md) for Python interpreter overrides.

#### Browser

Use two terminals: one for the backend and one for the UI development server.
Before starting, prepare a **working copy of a solution**, including its referenced
files and folders. Replace the example `.dm8s` path below with the path to that copy.

**Windows (PowerShell)**

Terminal 1 — start the backend and keep it running:

```powershell
& .\submodules\datam8-generator\.venv\Scripts\python.exe -m datam8 serve `
  --host 127.0.0.1 `
  --port 4318 `
  --solution 'C:\DataM8\working-copy\MySolution.dm8s'
```

Terminal 2 — start the UI and keep it running:

```powershell
$env:VITE_API_URL = 'http://127.0.0.1:4318'
npm run dev:web
```

**macOS / Linux (shell)**

Terminal 1 — start the backend and keep it running:

```sh
submodules/datam8-generator/.venv/bin/python -m datam8 serve \
  --host 127.0.0.1 \
  --port 4318 \
  --solution '/path/to/working-copy/MySolution.dm8s'
```

Terminal 2 — start the UI and keep it running:

```sh
VITE_API_URL=http://127.0.0.1:4318 npm run dev:web
```

Open **http://localhost:4320** in your browser, then use **Load** to read the
solution selected by `--solution`.

**Switching solutions:** Browser mode uses the solution selected when the backend
starts. Changing the path in the Load dialog does not switch solutions. To use
another solution, restart the backend in Terminal 1 with a different `--solution`
path, then load it again in the UI.

**Ports and authentication:** The UI runs on port `4320` and forwards API requests
to the backend at `VITE_API_URL` (port `4318` in these examples). If the variable
is unset, Vite defaults to `http://127.0.0.1:51092`. These browser commands run the
backend on loopback without a token; Desktop supplies a token automatically.

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

Packaging: `npm run build:desktop` builds for the current native host.
The workflow supplies the target to the single desktop `package` command.
See [installation and verification](docs/desktop-installation.md),
[release checks](docs/release.md), [troubleshooting](docs/troubleshooting.md)
and [opt-in screenshot maintenance](docs/user-guide/capture.md).
