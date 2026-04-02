# Connectors and Plugins

Data source connectivity is implemented through plugin classes (`src/datam8/plugins`).

## Built-in plugins

Registered in `src/datam8/plugins/__init__.py`:
- `builtin:CsvFile`
- `builtin:AzureDataLake`
- `builtin:SQLServer`

`SQLServer` requires optional dependency group `sql` (`connectorx`).

## Plugin manifests

Plugin metadata uses `datam8_model.plugin.PluginManifest` and includes:
- `id`
- `displayName`
- `version`
- `entryPoint` (`module.path:ClassName`)
- `capabilities`

## Loading model

`PluginManager` combines:
- built-in manifests (registered at runtime)
- solution manifests loaded from:
  - `config.solution_folder_path / solution.pluginsPath`

It loads plugin classes lazily on first use (`get_plugin`).

## API surface

Plugin metadata endpoints:
- `GET /plugins/`
- `POST /plugins/reload`
- `GET /plugins/{plugin_id}`
- `GET /plugins/{plugin_id}/ui-schema`
- `GET /plugins/{plugin_id}/data-type-mappings`
- `GET /plugins/{plugin_id}/connection-properties`

Source browsing/testing endpoints:
- `GET /sources/{data_source}/test`
- `GET /sources/{data_source}/schemas`
- `GET /sources/{data_source}/schemas/{schema}/tables`
- `GET /sources/{data_source}/schemas/{schema}/tables/{table}`
- `GET /sources/{data_source}/schemas/{schema}/tables/{table}/preview`
- `GET /sources/{data_source}/tables`
- `GET /sources/{data_source}/tables/{table}`
- `GET /sources/{data_source}/tables/{table}/preview`
- `GET /sources/{data_source}/usages`

Note: import endpoints exist but currently return `404` with "comming soon...".

## Secrets

Secrets are managed via the keyring-backed resolver (`datam8.secrets.SecretResolver`) and API:
- `POST /secrets/check`
- `PUT /secrets/set`

## CLI commands

- `datam8 plugins list|show|ui-schema`
- `datam8 sources list-schemas|list-tables|table-metadata|preview|import|test-connection`
- `datam8 secrets list|add|show|unset|clean`
