# Connector Dev Notes

Backend endpoints used by the UI (root namespace):

- `GET /connectors`
- `GET /connectors/:id/ui-schema`
- `POST /connectors/:id/validate-connection`
- `POST /datasources/:id/list-tables`
- `POST /datasources/:id/table-metadata`
- `POST /http/datasources/:id/virtual-table-metadata`
- `POST /plugins/install` (wheel-only upload or URL+sha256)
- `PUT /secrets/runtime`
- `DELETE /secrets/runtime/key`

Desktop relies on `DATAM8_PLUGIN_DIR` for connector discovery; plugin artifacts are managed outside this repo.
