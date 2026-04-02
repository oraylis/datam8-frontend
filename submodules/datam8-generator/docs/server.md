# DataM8 Server (`datam8 serve`)

This document describes runtime behavior of the local FastAPI server.

For the canonical endpoint list and contract, see `docs/backend-contract.md`.

## Command

```sh
datam8 serve [options]
```

Main options:
- `--solution` / `--solution-path` / `-s`: `.dm8s` file or folder containing exactly one `.dm8s`
- `--token` / `-t`: optional bearer token for endpoint protection
- `--host`: default `127.0.0.1`
- `--port`: default `0` (OS picks a free port)
- `--openapi` / `-o`: enables `/docs` and `/openapi.json`
- `--log-level` / `-l`: `debug|info|warning|error|critical`

## Startup sequence

1. CLI configures solution path/log level.
2. Full model is loaded once (`factory.create_model()`).
3. Socket is pre-bound (`_bind`) so selected port is known.
4. Uvicorn server starts using that socket.
5. On startup event, readiness line is printed to stdout:

```text
API ready at `http://<host>:<actualPort>`, schemaVersion: <schemaVersion>
```

Implementation:
- `src/datam8/cmd/root.py` (`serve` command)
- `src/datam8/api/app.py` (`_bind`, `create_server`)

## Auth behavior

Auth middleware is enabled only when `--token` is provided.

- Exempt paths: `/health`, `/version`
- All other paths require `Authorization: Bearer <token>`
- Missing/invalid token returns HTTP `401` with `Datam8Error` envelope

## CORS behavior

Configured in `src/datam8/api/app.py`.

Defaults:
- Allowed origins:
  - `http://localhost:4320`
  - `http://127.0.0.1:4320`
  - `http://localhost:4321`
  - `http://127.0.0.1:4321`
  - `null`
- Allowed origin regex:
  - `^http://(localhost|127\.0\.0\.1):\d+$`

Overrides:
- `DATAM8_CORS_ORIGINS` (comma-separated)
- `DATAM8_CORS_ORIGIN_REGEX`

## OpenAPI docs

- Disabled by default.
- Enabled with `--openapi`.
- When enabled:
  - Swagger UI: `/docs`
  - OpenAPI JSON: `/openapi.json`

## Errors

Unhandled and domain errors are normalized to a JSON envelope with `code`, `message`, `details`, `hint`, and optional `traceId`.

See `src/datam8/errors.py` and exception handlers in `src/datam8/api/app.py`.
