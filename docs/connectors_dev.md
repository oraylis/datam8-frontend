# Connector Developer Notes

Keep Python plugin development and backend semantics in Generator; UI consumption
belongs here. This page describes the DataM8 2.0.0 integration. Read [frontend usage](connectors.md),
[the plugin reference](../submodules/datam8-generator/docs/connectors.md),
[the runnable example](../submodules/datam8-generator/docs/plugin-example.md) and
[the canonical source contract](../submodules/datam8-generator/docs/backend-contract.md#source-import-and-refresh).

## Consume plugins generically

Source navigation, import and preview must not branch on plugin IDs, type names,
authentication modes or address syntax. Render the supplied connection schema, use
connection-specific capabilities and pass opaque handles unchanged.

Binding copies the plugin's connection definitions, auth modes and suggested type
mappings into the Data Source Type. These are saved configuration, not a runtime
call to a plugin resolver. A plugin returning no suggestions needs manually
configured mappings; do not insert an artificial default mapping.

For navigation, expand advertised containers and select the listed objects.
External bulk import has no manual source-location/Add Object input. Metadata's
object name supplies the suggested technical name; do not parse it from the handle.
Respect supplied source overrides. Manual configuration of an entity's sources
is a separate editor workflow.

Preview is enabled by the configured connection's capabilities. A plugin can
support metadata while lacking preview or the required query endpoint. Do not infer
preview availability from its ID or authentication method.

## Import paths and persistence

| Backend result | Frontend responsibility |
| --- | --- |
| Non-null import-description entity | Preserve mapped data types, attribute types, display names, sources, relationships and transformations; apply only explicitly edited wizard values and target name/ID |
| Null import-description entity | Build the entity from supplied metadata and saved mappings; use the existing `Regular` Attribute Type |
| Import-description error | Surface the error; do not silently switch to metadata import to bypass it |

The metadata path uses the canonical matching rules: Data Source overrides before
Data Source Type mappings, full type before base type within each level,
case/outer-whitespace normalization, and duplicate/missing mappings as errors.
Preserve Data Source overrides when preparing wizard data. No implicit target
type acceptance, plugin-resolver fallback or replacement with `string` is allowed.

Metadata describes source types and separate dimensions; source mappings retain
them. The frontend must not retranslate a complete backend description. The
metadata-only path does not run the backend's exactly-one default Attribute Type
selection. The solution must contain the Attribute Types its resulting attributes
reference, including `Regular` for that path.

Refresh scans and reviews backend comparison results. Complete refresh and
sources-only have different ownership rules; do not reconstruct a backend result
using plugin-specific logic. Preserve source/mapping metadata through normalization
and save, including distinct metadata and physical read locations. Use generated
schema types and typed envelopes for stable fields.

## Frontend responsibilities

- `connectorCatalog.ts`: plugin discovery, catalog caching and declared capabilities.
- `DataSourceTypesEditor`: binding, connection definitions and saved type mappings.
- `ConnectorUiSchemaForm`: generated forms, connection tests and secret references.
- `sourceNavigation.ts`: entries, traversal and metadata normalization.
- `useSourceCapabilities.ts`: configured-connection capabilities.
- `sourcePreview.ts` and `useWizardSubmit.ts`: preview and import-description consumption.
- `RefreshSchemasDialog`: complete/source-only comparison, review and application.

Do not add historical route aliases without a coordinated contract change.
HTTP payload and plugin method specifications remain canonical in Generator.

## Verification

Use self-contained fixtures for routine tests. Cover empty locations, unsupported
preview, missing secrets, metadata/import errors, both import-description results,
saved mapping overrides and refresh application. Cross-repository behavior changes
need real requests and persisted-state assertions.

Screenshots do not prove live connectivity or refresh application unless the report
records those operations. Documentation-only corrections do not upgrade historical
capture or packaged desktop evidence.
