# Desktop Development

Frontend starts a local FastAPI backend process via Python module execution.

## Backend start contract

```bash
python -m datam8 serve --host 127.0.0.1 --port 0 --token <random>
```

Readiness line:

```json
{"type":"ready","baseUrl":"http://127.0.0.1:<PORT>","version":"<cliVersion>"}
```

Renderer uses root endpoints (`/config`, `/solution/*`, `/model/*`, `/model/generate`, ...), no `/api/*` and no `/jobs`.

## Runtime configuration

- `npm run dev:desktop` requires the interpreter from `submodules/datam8-generator/.venv`.
- Prepare local backend dependencies with:
  - `cd submodules/datam8-generator`
  - `uv sync`
- `DATAM8_PYTHON_PATH`: optional override, but must still point to that `.venv` interpreter
- `DATAM8_BACKEND_MODULE`: optional module name (default `datam8`)
- Connector discovery uses the loaded solution's `pluginsPath`; see
  [connectors](connectors.md). The former `DATAM8_PLUGIN_DIR` discovery guidance is historical.

Windows interpreter override (from repo root):

```powershell
$env:DATAM8_PYTHON_PATH = (Resolve-Path .\submodules\datam8-generator\.venv\Scripts\python.exe).Path
npm run dev:desktop
```

macOS/Linux:

```sh
DATAM8_PYTHON_PATH="$PWD/submodules/datam8-generator/.venv/bin/python" npm run dev:desktop
```

The development launcher requires that submodule virtual environment. Packaged
runtime resolution is a separate concern. See [browser setup](../README.md#local-development)
for the startup-bound web workflow and [user guide](user-guide/README.md) for usage.


