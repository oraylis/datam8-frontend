# Changelog

## v2.0.0-beta.6

### Highlights

- Migrated the frontend to the current v2 root API endpoints.
- Improved source metadata loading, schema refresh, relationships, model CRUD, and editor performance.
- Improved backend error handling and desktop runtime behavior.

### Breaking change: plugin structure

Plugin discovery now requires a configured `solution.pluginsPath`.

- Connector plugins must be stored below `pluginsPath/connectors/<connector_id>/plugin.json`.
- The manifest must use the current structure, including the connector `type`, `id`, `displayName`, `version`, `entryPoint`, and `capabilities` fields.
- The `entryPoint` must use the `<module>:<ClassName>` format.
- Existing solutions and plugin packages using the previous layout or missing `pluginsPath` must be migrated before they can be used with Beta 6.

### Fixes

- Preserved plugin-defined source properties and descriptions during import and save.
- Added more reliable caching and bounded concurrency for source locations and metadata.
- Improved schema refresh progress and error reporting.

## Unreleased

- Desktop: Windows NSIS installer now allows choosing the installation directory.
- Desktop: DevTools are disabled in packaged builds by default. To allow DevTools for support/debugging, set `DATAM8_ALLOW_DEVTOOLS=1` before launching the packaged app.

## beta changes

### model

* add missing SourceOverride and property fields
  - caused properties/descriptions added by plugins to be silently dropped

### backend / cli

* errors thrown in api mode were not properly caught and handled by fast api
* add databricks-sdk as a new extra dependency group

### frontend

* ability to define user settings per solution in an extra `.user-settings.json` file
* generated interfaces based on existing datam8 model
  - preparation for easier working with backend reponses
  - new dependency & simple script to generate them from the json schema
* added wrapper types that mimic the pydantic models returned by the backends api
* updated dependencies

* _UI:_
  - `view/about` to display the current version
  - `view/Toogle Dev Tools` to display the Chrome Developer Tools for debugging
    * is now always available
  - `view/force reload` is now always availabe
  - add notifications when model or entities are saved

* _error handling:_
  - global error boundary to catch errors incl. handlers
  - rewrote silent errors to display them to the user
  - add explicit error handling for console output

* _source import:_
  - properties set by plugins where not properly propagated and saved to the model
  - source column properties are copied to attributes during import
  - add missing attributes defined in model
  - adapted change detection for new properties and description attributes
  - add loading spinner while adopting source schema

* _bugs:_
  - `refresh` now also reset/reloads available plugins
  - generator & validator errors where not correctly displayed to the user
  - table search text field not editable in some cases

