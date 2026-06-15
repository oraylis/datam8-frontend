# Backend Contract (Frontend Consumer View)

Canonical source of truth is maintained in `submodules/datam8-generator/docs/backend-contract.md`.

## Startup

Frontend starts the backend as:

```bash
python -m datam8 serve --host 127.0.0.1 --port 0 --token <token>
```

Readiness line on stdout:

```json
{"type":"ready","baseUrl":"http://127.0.0.1:<PORT>","version":"<cliVersion>"}
```

## Auth

- Unauthenticated: `GET /health`, `GET /version`
- All other endpoints require `Authorization: Bearer <token>`

## Endpoint namespaces used by Frontend

Frontend uses root endpoints (no `/api/*` namespace):

- `GET /config`
- `GET /solution/inspect`, `GET /solution/full`, `POST /solution/new-project`
  - `POST /solution/new-project` requires at least one generator target and supports ZIP template upload either as multipart (`payload` + target zip fields) or as JSON `targetArchives` (`{ "<targetIndex>": "<base64ZipBytes>" }`) per the canonical generator contract.
- `GET /fs/list`
- `POST /generate` (synchronous, returns `messages` log lines)
- `POST /validate` (synchronous, returns `messages` log lines)
- editor/model/base/index/refactor/connectors/plugins/secrets routes under root paths
  - Secrets API: `POST /secrets/check`, `PUT /secrets/set`
  - Secret references are stored as `ref://<path>`
  - Plugin install is wheel-only via `POST /plugins/install`
    - Binary upload: `Content-Type: application/octet-stream` + `x-file-name: <name>.whl`
    - URL install: JSON `{ "url": "https://...whl", "sha256": "<64-hex>" }`
  - Plugin endpoints expect canonical `plugin_id` values (e.g. `builtin:SQLServer`); legacy short names are rejected by backend.
  - `GET /connectors` includes `dataTypeMapping` on connector summaries.

## Response contract

- JSON responses use stable top-level object payloads per endpoint.
- `204 No Content` is used for operations that intentionally return no body (for example secret upsert/delete).

### Connector capability object

Connector/plugin payloads use normalized capability objects (no `string[]`):

```json
{
  "uiSchema": true,
  "validateConnection": true,
  "metadata": { "listTables": true, "getTableMetadata": true },
  "runtimeQuery": { "sql": false, "dataFrame": false }
}
```

### Source metadata additions

Frontend may receive optional metadata fields from source/plugin endpoints:
- Table list (`GET /sources/.../tables`): `description?: string`, `properties?: Array<{ property: string; value: string }>`, `sourceOverride?: { dataSource?: string; sourceLocation?: string }`
- Table columns (`GET /sources/.../tables/{table}`): `description?: string`, `properties?: Array<{ property: string; value: string }>`

### Typing policy

- Stable and workflow-critical fields are strongly typed on backend responses.
- Plugin-/connector-driven sections may remain dynamic objects.
- Dynamic sections are still wrapped in typed top-level endpoint envelopes.

## Removed

- `/jobs` and `/jobs/*`
- `/api/*`

