# Troubleshooting

## Electron retries `http://localhost:4320` with `ERR_CONNECTION_REFUSED`

Symptom:
- Desktop startup loops with messages like:
  - `Failed to load URL: http://localhost:4320/ ... ERR_CONNECTION_REFUSED`
  - `Retrying in 1s...`

Common causes:
- Web dev server failed to start due to missing Rollup native optional dependency (`@rollup/rollup-<platform>`).
- Unsupported Node.js version (this repo supports Node 24 LTS; Node 25+ is unsupported).
- Port `4320` is already in use (Vite runs with `strictPort`).

Fix:
- Run `npm run ci:ensure-rollup-native`.
- Verify web starts on the expected port with `npm run dev:web`.
- Start desktop again with `npm run dev:desktop`.

## Backend does not start

- `npm run dev:desktop` requires `submodules/datam8-generator/.venv`.
- Prepare dependencies once:
  - `cd submodules/datam8-generator`
  - `uv sync`
- If `DATAM8_PYTHON_PATH` is set, it must point to the same `.venv` interpreter.
- Verify with:
  - `submodules/datam8-generator/.venv/Scripts/python.exe -m datam8 --help` (Windows)
  - `submodules/datam8-generator/.venv/bin/python3 -m datam8 --help` (macOS/Linux)

## API requests fail in dev

- Verify `VITE_API_URL` points to the running backend (or proxy is configured).
- Check CORS/logs and test `GET /config` directly.

## Generation fails

- Validate solution path and target in the request body.
- Check backend stderr for detailed validation/generation errors.

## Autosave fails or does not trigger

### Symptom: `Save failed` banner is visible

Checks:
- Click `Retry now` in the banner.
- Expand details (`Show details`) and inspect the validation/API error text.
- Confirm required fields for the current editor are present.

Expected behavior:
- If the draft becomes clean again (for example by removing an invalid item), the save error banner resets automatically without reloading.

### Symptom: Changes are not persisted while editing

Common causes:
- In entity/base form mode, non-tab triggers can be skipped while required linkage/required fields are incomplete.
- Save is in flight and a queued save is waiting for current request completion.

Checks:
- Trigger a tab switch to force a `tab-switch` persist attempt.
- Ensure required fields are completed:
  - Entity: relationship zone/target, source linkage.
  - Base: required fields in current base type.

### Symptom: Base save triggers follow-up actions automatically

Why:
- Some base saves require follow-up model operations (`zones`, `dataProducts`, `properties`).

What to do:
- Wait for the automatic follow-up run to finish.
- Check for `Apply action failed` notifications if one or more actions fail.

Notes:
- Zone delete follow-up actions remove the full local zone subtree.

### Symptom: Dirty tab warning (`Pending Sync`) on close

Why:
- Tab dirty state usually indicates unresolved save errors.

What to do:
- Retry save first.
- If needed, close anyway after confirmation.

For full behavior details, see [`docs/autosave.md`](./autosave.md).
