# Plugin Spec (v1)

Plugins are loaded by `datam8 serve` from `DATAM8_PLUGIN_DIR`.

Frontend uses plugin management endpoints under root paths:

- `GET /plugins`
- `POST /plugins/reload`
- `POST /plugins/install`
- `POST /plugins/uninstall`
- `POST /plugins/enable`
- `POST /plugins/disable`


