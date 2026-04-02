# Connectors in Neon

Neon consumes connector endpoints directly from the backend root namespace:

- `GET /connectors`
- `GET /connectors/:id/ui-schema`
- `POST /connectors/:id/validate-connection`
- `POST /plugins/install` (wheel-only upload or URL+sha256)

Secrets are managed via:

- `PUT /secrets/runtime`
- `DELETE /secrets/runtime/key`

Desktop main process sets `DATAM8_PLUGIN_DIR` before backend start.
