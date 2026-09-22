# Desktop Shell

Electron wrapper that ships the built web UI and starts the backend via Python module execution (`python -m datam8 serve`).

## Processes
- `main.ts` - single-instance lock, spawns `python -m datam8 serve --host 127.0.0.1 --port 0 --token <random>`, parses readiness JSON from stdout, verifies `/health`, loads web UI (`../web/dist/index.html` in prod or `http://localhost:4320` in dev).
- `preload.ts` - IPC bridge exposing:
  - `desktop.apiBase` / `desktop.token` - backend connection details for the renderer.
  - `desktop.solution.pickOpenPath()` / `pickSavePath()` - native file dialogs for `.dm8s`.
  - `desktop.solution.onOpenPath(cb)` - file-association/open events.
  - `desktop.theme.current()` / `desktop.theme.onThemeChanged(cb)` - theme bridge.

## Runtime resolution

- Preferred override: `DATAM8_PYTHON_PATH=<python-executable>`
- Optional module override: `DATAM8_BACKEND_MODULE=<module>` (default `datam8`)
- Dev convenience: if available, `submodules/datam8-generator/src` is added to `PYTHONPATH` automatically.

## Packaging

`electron-builder` bundles web UI and desktop resources. Backend runtime dependencies are expected to be provided via Python runtime/module packaging (not `datam8.exe`).

## Extension Points

- Add renderer-facing APIs in `preload.ts` (expose via `contextBridge`).
- Add main-process logic (e.g., deep links, auto-update) in `main.ts`.
- Keep secrets out of logs; avoid blocking calls on the main thread.
