# Backend Contract (Canonical)

This document is the canonical HTTP contract for `datam8-generator` as currently implemented.

All endpoints are rooted at `/` (no `/api/*` namespace).

## Startup and readiness

Neon/clients start the backend as a long-lived process:

```sh
datam8 serve --host 127.0.0.1 --port 0 --token <random>
```

When startup completes, the process prints a readiness line to stdout:

```text
API ready at `http://127.0.0.1:<PORT>`, schemaVersion: 2.0.0
```

## Auth contract

- `GET /health` and `GET /version` are always unauthenticated.
- If `--token` is provided, every other endpoint requires:
  - `Authorization: Bearer <token>`
- If `--token` is not provided, auth middleware is not enabled.

## Error contract

Application errors are returned as a JSON envelope:

```json
{
  "code": "validation_error",
  "message": "Invalid request.",
  "details": null,
  "hint": null,
  "traceId": "..."
}
```

Status mapping in `src/datam8/api/app.py`:
- `validation_error` -> `400`
- `not_found` -> `404`
- `conflict` / `locked` -> `409`
- `auth` -> `401`
- `permission` -> `403`
- `not_implemented` -> `501`
- fallback -> `500`

## Endpoint surface

### System

- `GET /health`
- `GET /version`
- `GET /config`

### Solution

- `GET /solution`
- `GET /solution/full`

### Model

- `POST /model/generate`
- `POST /model/save`
- `POST /model/reload`
- `GET /model/unsaved`
- `GET /model/function/source`
- `POST /model/function/source`
- `DELETE /model/function/source`
- `POST /model/function/rename`

### Entities

- `GET /entities/{locator:path}`
- `PATCH /entities/{locator:path}`
- `DELETE /entities/{locator:path}`
- `PUT /entities/{locator:path}`
- `PUT /entities/clone`
- `POST /entities/move`

### Sources

- `GET /sources/{data_source}/test`
- `GET /sources/{data_source}/schemas`
- `GET /sources/{data_source}/schemas/{schema}/tables`
- `GET /sources/{data_source}/schemas/{schema}/tables/{table}`
- `GET /sources/{data_source}/schemas/{schema}/tables/{table}/preview`
- `PUT /sources/{data_source}/schemas/{schema}/tables/{table}/import` (currently returns 404 "comming soon...")
- `GET /sources/{data_source}/tables`
- `GET /sources/{data_source}/tables/{table}`
- `GET /sources/{data_source}/tables/{table}/preview`
- `PUT /sources/{data_source}/tables/{table}/import` (currently returns 404 "comming soon...")
- `GET /sources/{data_source}/usages`

### Plugins

- `GET /plugins/`
- `POST /plugins/reload`
- `GET /plugins/{plugin_id}`
- `GET /plugins/{plugin_id}/ui-schema`
- `GET /plugins/{plugin_id}/data-type-mappings`
- `GET /plugins/{plugin_id}/connection-properties`

### Secrets

- `POST /secrets/check`
- `PUT /secrets/set`
  - Upsert semantics: setting an existing secret path overwrites the existing value.
  - Successful writes return `204 No Content`.
  - Secret refs use `ref://<path>` (for example `ref://datasources/AdventureWorks/password`).

## Response envelopes for collection/single-item routes

Many routes use typed wrappers from `src/datam8/api/routes/responses.py`:

- `MultiItemResponse<T>`:
  - `count: int`
  - `items: list[T]`
- `SingleItemResponse<T>`:
  - `item: T`

## Change policy

Contract changes must include:
- update of this document
- coordinated Neon + generator implementation change (if Neon-consumed)
- tests for changed behavior
