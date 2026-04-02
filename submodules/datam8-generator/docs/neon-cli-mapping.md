# Neon CLI Mapping and API/CLI Parity

Stand: 2026-03-31

This file documents the currently available generator surface from code inspection in this repository.

## Current CLI groups (`datam8`)

Top-level commands (from `uv run datam8 --help`):
- `list`
- `list-by-property`
- `show`
- `validate`
- `generate`
- `init`
- `serve`
- `sources`
- `plugins`
- `secrets`
- `migrate`

Subcommands:
- `sources`: `list-tables`, `list-schemas`, `preview`, `import`, `table-metadata`, `test-connection`
- `plugins`: `list`, `show`, `ui-schema`
- `secrets`: `list`, `add`, `show`, `unset`, `clean`
- `migrate`: `v1-to-v2`

## Current HTTP API groups

Routes are mounted in `src/datam8/api/routes` and exposed at root path.

- System: `/health`, `/version`, `/config`
- Solution: `/solution`, `/solution/full`
- Model: `/model/*` (generate/save/reload/unsaved/function source ops)
- Entities: `/entities/*` (CRUD + clone + move)
- Sources: `/sources/*` (test/schema/table/preview/usages)
- Plugins: `/plugins/*`
- Secrets: `/secrets/*`

See `docs/backend-contract.md` for the full endpoint list.

## Source-of-truth pointers

- CLI registration: `src/datam8/app.py`
- CLI command implementations: `src/datam8/cmd/*.py`
- API app and middleware: `src/datam8/api/app.py`
- API routes: `src/datam8/api/routes/*.py`
