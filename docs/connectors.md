# Connectors in the Frontend

See the [user workflow](user-guide/sources.md) for operating the editor.
These connector details describe DataM8 2.0.0 and its backend integration.

- **Data Source Types** may set an explicit `pluginId` to bind connection definitions
  and type mappings to a plugin.
  The picker reads `/plugins` and its detail subpaths. Binding copies plugin
  definitions and mapping suggestions into saved configuration; no suggestions
  means the necessary mappings must be configured manually.
- **Data Sources** contain concrete `extendedProperties` and secret references such
  as `ref://datasources/AdventureWorks/password`.
- Connection tests, navigation, metadata, import and schema comparison use `/sources/*`.
  Navigation passes listed handles unchanged, and preview follows connection-specific
  capabilities. External bulk import selects listed objects rather than manually
  adding a source location.
- Secret checks/writes use `/secrets/check` and `/secrets/set`. Keep credentials out of
  committed examples and screenshots.
- Discovery uses `solution.pluginsPath`. `DATAM8_PLUGIN_DIR` and the old `/connectors/*`
  and runtime-secret endpoints describe historical behavior.

Refer to the [canonical source contract](../submodules/datam8-generator/docs/backend-contract.md#source-import-and-refresh)
and [Generator plugin guide](../submodules/datam8-generator/docs/connectors.md)
for semantics and interfaces; see [developer notes](connectors_dev.md) for UI pointers.
