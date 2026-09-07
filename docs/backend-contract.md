# Backend Contract (Frontend Consumer View)

Canonical source of truth is maintained in `submodules/datam8-generator/docs/backend-contract.md`.
For the v2 beta port migration the frontend is pinned to Generator commit
`1ebe33bb7341856559352497606d07841af1f0e9`; the implemented routes in that
commit are authoritative when the generator document differs.

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
- `POST /model/generate` (synchronous)
- editor/model/base/index/refactor/connectors/plugins/secrets routes under root paths
  - Single entity rename/move uses `POST /entities/move-single`.
  - Folder and subtree moves use `POST /entities/move`.
  - Entity deletion uses `DELETE /entities/{locator}`. A locator with an entity
    name deletes that item; a folder locator without entity name deletes the
    subtree. For model folder deletion the frontend sends
    `DELETE /entities/modelEntities/Raw/Sales/` for model children and
    `DELETE /entities/folders/Raw/Sales` for the root folder metadata, then
    saves once.
  - Property value deletion uses `DELETE /entities/propertyValues/<property>/<value>`;
    dependent usage cleanup is orchestrated by the frontend through follow-up
    entity patches before saving the model.
  - Model relationships may target an internal model entity (`targetLocation: number`) or an external data source (`dataSource` + string `targetLocation`); see canonical contract for the exact wire shape.
  - Secrets API: `POST /secrets/check`, `PUT /secrets/set`
  - Secret references are stored as `ref://<path>`
  - `POST /entities/rename` expects `{ "from": "<locator>", "to": "<new-name>" }` and updates the references supported by the Generator contract. Property Value locator changes are handled explicitly by the frontend where required.
  - Plugin list is `GET /plugins` without a trailing slash.
  - Plugin endpoints expect canonical `plugin_id` values (e.g. `builtin:SQLServer`); legacy short names are rejected by backend.
  - Functions are read/updated/moved through `GET|POST /functions/{modelEntityId}/{stepNo|name}` and `POST /functions/{modelEntityId}/{stepNo|name}/move`.
    Function responses use snake_case fields such as `source_code` and
    `source_file_path`; update/move requests accept camelCase aliases
    `sourceCode` and `newPath`.

## Response contract

- JSON responses use stable top-level object payloads per endpoint.
- `204 No Content` is used for operations that intentionally return no body (for example secret upsert/delete).

### Connector capability object

Connector/plugin payloads from `GET /plugins` use the generator's manifest shape:

```json
{
  "id": "builtin:SQLServer",
  "displayName": "SQL Server",
  "version": "0.0.1",
  "entryPoint": "datam8.plugins.builtins.sql_server:SqlServer",
  "capabilities": ["uiSchema", "validationConnection", "metadata", "previewData"]
}
```

### Source metadata additions

Frontend may receive optional metadata fields from source/plugin endpoints:
- Location list (`GET /sources/{id}/locations`): plugin-specific objects for schemas, tables, directories, containers, or blobs.
- Location metadata (`GET /sources/{id}/locations/metadata?source_location=...`): `items: SourceField[]`
- Location preview (`GET /sources/{id}/locations/preview?source_location=...&limit=...`): `items: Record<string, unknown>[]`
- The frontend treats `sourceLocation` as the canonical identifier across browsing, selection, metadata, preview, and schema refresh.
- The Brokerage SQL Server plugin implements the v2 locations and metadata
  contract directly; the Generator does not adapt legacy plugin signatures.

## Known API Gaps

- Validate: no `/validate` route is registered in the pinned Generator API.
- Function create: no server route exists; Electron creates the initial empty
  source file through its constrained solution file bridge.
- Function delete: no server route exists; Electron deletes the source file
  through the same constrained bridge.

### Typing policy

- Stable and workflow-critical fields are strongly typed on backend responses.
- Plugin-/connector-driven sections may remain dynamic objects.
- Dynamic sections are still wrapped in typed top-level endpoint envelopes.

## Removed

- `/jobs` and `/jobs/*`
- `/api/*`
