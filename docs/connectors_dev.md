# Connector Developer Notes

Keep backend plugin semantics in Generator and UI configuration/presentation here.
Read [frontend usage](connectors.md) and the
[canonical source contract](../submodules/datam8-generator/docs/backend-contract.md#source-import-and-refresh).

Source navigation, import and preview must not branch on plugin IDs, type names,
authentication modes or address syntax. Use connection capabilities from the
backend, navigate the advertised container types, and pass handles unchanged.
Complete import descriptions are authoritative; retain their names, types,
relationships and transformations except for explicitly edited wizard values.
When the backend returns a null description, use the supplied metadata and configured
type mappings. Preserve Data Source mapping overrides when preparing wizard data.
Type matching follows the canonical source contract, without implicit target types
or plugin-resolver fallbacks. External bulk imports select objects from the plugin's
navigation results and pass their source locations unchanged. Binding copies plugin
mapping suggestions into the Data Source Type;
plugins without suggestions require manual configuration.

## Frontend responsibilities

- `connectorCatalog.ts`: `/plugins` discovery, catalog caching and capabilities.
- `DataSourceTypesEditor`: plugin binding, connection definitions and type mappings.
- `ConnectorUiSchemaForm`: plugin forms, connection tests and secret references.
- `sourceNavigation.ts`: navigation entries, traversal and metadata normalization.
- `useSourceCapabilities.ts`: connection-specific capabilities.
- `sourcePreview.ts` and `useWizardSubmit.ts`: preview and import-description.
- `RefreshSchemasDialog`: complete/source-only comparison, review and application.

Do not add historical route aliases without a coordinated contract change.
Preserve source/mapping metadata through normalization and save. Use generated
schema types and typed envelopes for stable fields.

## Verification

Use self-contained fixtures for routine tests. Cover unsupported preview, empty
locations, unavailable secrets, metadata errors and refresh application. Cross-repo
changes need real requests and persisted-state assertions. Screenshots are not
proof of live connectivity unless the report records connection/import/refresh success.
