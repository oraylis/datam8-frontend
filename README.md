# DataM8 Frontend

The DataM8 app lets you explore and edit solution metadata, inspect source
definitions and generate the outputs configured by your solution. This repository
owns the visual editor and desktop application: a React/Vite web app and an
Electron shell using the DataM8 Python backend.

## Start with your task

| I want to… | Begin here | First result |
| --- | --- | --- |
| Model data using the app | [Download the stable app](https://github.com/oraylis/datam8-frontend/releases/latest) and [verify/install it](docs/desktop-installation.md) | Open a complete solution copy without a source build or separate Python installation |
| Learn the editing workflow | [Illustrated user guide](docs/user-guide/README.md) | Edit a sample description, check save/reload and generate `docs` |
| Change the editor or desktop shell | [Local development](#local-development), then [contributor instructions](AGENTS.md) | Run the app from this checkout and verify a focused change |
| Integrate a backend or connector | [Backend integration](docs/backend-contract.md) and [connector developer notes](docs/connectors_dev.md) | Identify the supported contract and which component owns your change |

For a first product exercise, use the installed app and the sample guide. The
development tools below are for changing this repository. The app bundles its
backend; source connectivity and generated targets have their own prerequisites.
For product concepts and other components, see the
[central handbook](https://github.com/oraylis/datam8/blob/main/docs/index.md).

## Local development

These instructions describe this checkout and its pinned backend. Use release
artifacts for normal installation and the matching tag for release-specific
technical references. Follow [the contribution workflow](https://github.com/oraylis/datam8/blob/main/docs/contribution.md)
when preparing a change; [troubleshooting](docs/troubleshooting.md) covers setup
and persistence problems.

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
