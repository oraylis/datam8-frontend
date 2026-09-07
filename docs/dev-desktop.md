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
- `DATAM8_PLUGIN_DIR`: plugin root for connector discovery


