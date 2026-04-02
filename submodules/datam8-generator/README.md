# ORAYLIS DataM8 Generator

`datam8-generator` is the canonical DataM8 v2 backend.

It provides:
- the `datam8` CLI
- the local FastAPI backend started with `datam8 serve`
- synchronous generation/validation/model operations

Neon starts this backend as a local process and talks to it over HTTP on root paths (no `/api/*` prefix).

## Repository role in v2

- `datam8-model`: schema source of truth
- `datam8-generator`: backend implementation (this repo)
- `datam8-neon`: desktop/web UI using this backend
- `datam8-sample-solution`: reference solution used in tests/CI

## Key docs

- Canonical backend HTTP contract: `docs/backend-contract.md`
- Runtime/server behavior: `docs/server.md`
- Connector/plugin behavior: `docs/connectors.md`
- CLI and API surface mapping notes: `docs/neon-cli-mapping.md`
- Testing guide: `tests/README.md`
- Contributor guardrails: `AGENTS.md`

## Requirements

- Python 3.12+
- `uv` (https://docs.astral.sh/uv/getting-started/installation/)

## Setup

```sh
uv sync --extra api --extra sql
```

Why extras are needed:
- `api`: installs `fastapi` + `uvicorn` required by `datam8 serve`
- `sql`: installs `connectorx` required by the built-in SQL Server plugin

### Clone

The repository uses the `datam8-model` git submodule as schema source during model-code generation.

```sh
git clone --recurse-submodules https://github.com/oraylis/datam8-generator.git
cd datam8-generator
git submodule update --init --recursive
```

## Quick usage

### CLI help

```sh
uv run datam8 --help
uv run datam8 sources --help
uv run datam8 plugins --help
uv run datam8 secrets --help
uv run datam8 migrate --help
```

### Start backend

```sh
uv run datam8 serve \
  --host 127.0.0.1 \
  --port 0 \
  --token <token> \
  --solution-path "<path-to-solution.dm8s>"
```

Use `--openapi` to expose `/docs` and `/openapi.json`.

## Main code entry points

- CLI root: `src/datam8/app.py`
- Root commands (`list`, `show`, `validate`, `generate`, `init`, `serve`): `src/datam8/cmd/root.py`
- Sources commands: `src/datam8/cmd/sources.py`
- Plugins commands: `src/datam8/cmd/plugin.py`
- Secrets commands: `src/datam8/cmd/secret.py`
- Migration commands: `src/datam8/cmd/migrate.py`
- API app + middleware: `src/datam8/api/app.py`
- API routes: `src/datam8/api/routes/*.py`

## Testing

Model-centric tests require a solution path.

```sh
uv run pytest --solution-path "<path-to-solution.dm8s>"
```

See `tests/README.md` for details.

## Quality gates

Run before finishing changes:

```sh
uv tool run pyright src
uv tool run ruff check src

## License headers

```sh
uv run python scripts/add_license_headers.py --dry-run
uv run python scripts/add_license_headers.py
```
