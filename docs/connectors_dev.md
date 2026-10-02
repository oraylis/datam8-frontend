# Connector Developer Notes

Keep backend plugin semantics in Generator and UI configuration/presentation here.
Read [frontend usage](connectors.md) and the
[canonical source contract](../submodules/datam8-generator/docs/backend-contract.md#source-import-and-refresh).

## Frontend responsibilities

- `connectorCatalog.ts`: `/plugins` discovery, catalog caching and capabilities.
- `DataSourceTypesEditor`: plugin binding, connection definitions and type mappings.
- `ConnectorUiSchemaForm`: plugin forms, connection tests and secret references.
- `sourcePreview.ts` and `useWizardSubmit.ts`: navigation, metadata, preview and import-description.
- `RefreshSchemasDialog`: complete/source-only comparison, review and application.

Do not add historical route aliases without a coordinated contract change.
Preserve source/mapping metadata through normalization and save. Use generated
schema types and typed envelopes for stable fields.

## Verification

Use self-contained fixtures for routine tests. Cover unsupported preview, empty
locations, unavailable secrets, metadata errors and refresh application. Cross-repo
changes need real requests and persisted-state assertions. Screenshots are not
proof of live connectivity unless the report records connection/import/refresh success.
