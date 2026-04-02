# Testing

The project uses `pytest`.

## Current test architecture

Test modules currently present:
- `test_010_model.py` + `test_010_model_cases.py`
- `test_020_helper.py` + `test_020_helper_cases.py`
- `test_030_factory.py` + `test_030_factory_cases.py`
- `test_040_migration.py` + `test_040_migration_cases.py`
- `test_040_connector_binding_cases.py`
- `test_090_cli.py` + `test_090_cli_cases.py`

Shared fixtures/setup live in `tests/conftest.py`.

## Solution-path requirement

Most model-centric tests require a valid `.dm8s` solution path.

Provide it by CLI option:

```sh
uv run pytest --solution-path "<absolute-path-to-solution.dm8s>"
```

Or environment variable:

```sh
# PowerShell
$env:DATAM8_SOLUTION_PATH = "C:\path\to\ORAYLISDatabricksSample.dm8s"
uv run pytest
```

```sh
# bash
export DATAM8_SOLUTION_PATH="/abs/path/ORAYLISDatabricksSample.dm8s"
uv run pytest
```

CI uses `oraylis/datam8-sample-solution` (`feature/v2`) and sets `DATAM8_SOLUTION_PATH` accordingly.

## Run tests locally

```sh
uv sync --extra api --extra sql
uv run pytest --solution-path "<absolute-path-to-solution.dm8s>"
```

## Quality gates

Run these before finishing changes:

```sh
uv tool run pyright src
uv tool run ruff check src
```

## Notes

- If no solution path is configured, solution-dependent tests may fail or skip depending on fixture usage.
- Keep shared bootstrap/path/env logic in `tests/conftest.py` instead of duplicating it in individual tests.
