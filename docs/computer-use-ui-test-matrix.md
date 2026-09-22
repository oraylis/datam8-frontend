# Computer-Use UI Test Matrix

Tested against a temporary copy of the Brokerage solution with the frontend on
the v2 beta API and Generator commit
`1ebe33bb7341856559352497606d07841af1f0e9`. No Playwright UI tests were used.

| API route | UI action and test data | Visible result | Reload/persistence | Result |
| --- | --- | --- | --- | --- |
| `GET /health` | Start the local backend and open DataM8 | Application loaded | N/A | PASS |
| `GET /config` | Open the web UI | Runtime configuration was accepted | N/A | PASS |
| `GET /solution/full` | Load the temporary Brokerage `.dm8s` | Model tree showed `020_gold/edwh_dm_dom_brokerage`, `debitor`, and `distribution_channel_cluster` | N/A | PASS |
| `GET /plugins` | Open **Data Source Types** | Connector picker listed SQL Server and the other installed plugins | N/A | PASS |
| `GET /plugins/{id}/ui-schema` | Open the SQL Server data-source type | SQL Server form rendered | N/A | PASS |
| `GET /plugins/{id}/connection-properties` | Inspect the SQL Server form | Connection/auth fields rendered | N/A | PASS |
| `GET /plugins/{id}/data-type-mappings` | Open SQL Server type mappings | Mapping count and mapping UI rendered | N/A | PASS |
| `POST /plugins/reload` | Use the application Reload action | Solution and plugin-backed UI reloaded | N/A | PASS |
| `PATCH /entities/{locator}` | Edit `debitor` display name to `debitor_ui_test` | `Saved` notification | Reload restored the saved edit | PASS |
| `POST /entities/rename` | Rename `DataProduct1` to `DataProduct_UI_Test` and back | Both saves showed `Saved` | Final reload state showed `DataProduct1` | PASS |
| `POST /model/reload` | Click top-level Reload after edits | Tree and open tabs remained usable | Saved model state was visible | PASS |
| `POST /model/generate` | Click **Generate** for target `databricks` | `Generation succeeded` and output path shown | Generated output path was reported | PASS |
| `DELETE /entities/{locator}` | Delete `debitor` from the model tree | `Saved`; the entity disappeared from the tree | `debitor.json` was absent after reload | PASS |
| `DELETE /entities/{locator}` | Delete Property Value `write_mode/merge` | `Saved`; `merge` disappeared from Property Values | No `merge` value file or usage remained in the temporary copy | PASS |
| `DELETE /entities/{locator}` | Delete folder `020_gold/edwh_dm_dom_brokerage` with two entities | `Saved`; folder and both entities disappeared from the tree | Entity files and `.properties.json` were absent after reload | PASS after frontend fix |
| `PUT /entities/clone` | Duplicate `debitor` from the entity context menu | `debitor_copy` appeared and `Saved` was shown | `debitor_copy.json` was present after reload | PASS |
| `POST /entities/move` / `POST /entities/move-single` | Entity context menu and `Ctrl+M` | No move dialog/action became available through Computer Use | Route not reached | TEST GAP: UI action unavailable |
| `DELETE /entities/{locator}` | Delete only base item `DataProduct1` | UI reported `At least one item is required and cannot be removed` | Item remained | BLOCKED by UI invariant |
| `DELETE /entities/{locator}` | Delete `debitor` from the model tree | `Saved`; the entity disappeared from the tree | `debitor.json` was absent after reload | PASS |
| `DELETE /entities/{locator}` | Delete Property Value `write_mode/merge` | `Saved`; `merge` disappeared from Property Values | No `merge` value file or usage remained in the temporary copy | PASS |
| `DELETE /entities/{locator}` | Delete folder `020_gold/edwh_dm_dom_brokerage` with two entities | `Saved`; folder and both entities disappeared from the tree | Entity files and `.properties.json` were absent after reload | PASS after frontend fix |
| `PUT /entities/clone` | Duplicate `debitor` from the entity context menu | `debitor_copy` appeared and `Saved` was shown | `debitor_copy.json` was present after reload | PASS |
| `POST /entities/move` / `POST /entities/move-single` | Entity context menu and `Ctrl+M` | No move dialog/action became available through Computer Use | Route not reached | TEST GAP: UI action unavailable |
| `GET /sources/{source}/test` | Validate `edwh-drillisch-prod` with WinVaultKeyring | `Connection settings are valid` | Secret reference remained available | PASS |
| `GET /sources/{source}/locations` | Import-from-source wizard, load locations, open `dm_dom_brokerage` | Schema entries and child tables rendered; `debitor` and `distribution_channel_cluster` were selectable | N/A | PASS after frontend fix |
| `GET /sources/{source}/locations/metadata` | Select `dm_dom_brokerage.debitor` in the import wizard | Metadata loaded and attributes rendered | N/A | PASS |
| `PUT /sources/{source}/import` | Import `debitor` into `020_gold/edwh_dm_dom_brokerage/import_test` | Import completed and opened the new entity | Reload showed `import_test/debitor.json` in the Model tree | PASS after frontend fix |
| `PUT /entities/{locator}` | Manual-creation wizard opened and accepted entity/folder input | Final create action did not close the wizard or show a save notification | N/A | FAIL: follow-up investigation required |
| `GET /functions/{modelEntityId}/{step}` | Open `debitor` Transformations and expand `Step1` in a temporary function fixture | Source editor rendered | N/A | PASS |
| `POST /functions/{modelEntityId}/{step}` | Edit the source and blur the editor | `Saved` notification | Source content persisted in the temporary solution | PASS |
| `POST /functions/{modelEntityId}/{step}/move` | Rename `Step1` to `StepFinal` | Source label changed and no error was shown | `StepFinal.py` and updated transformation metadata were present | PASS after frontend ordering fix |
| Function create/delete | Change a builtin step to function, or remove the last function step | Browser UI reports that Electron file bridge is required; native Electron surface was unavailable in Computer Use | No API route exists for create/delete in the pinned generator | TEST GAP: Electron-only bridge |
| Secret check/set | Validate a source with its configured secret through WinVaultKeyring | Secret reference was available and connection validation succeeded | N/A | PASS on Windows |

## Base Entity Coverage

The Base scope was opened through the UI for every available category:

| Base category | UI coverage | Result |
| --- | --- | --- |
| Properties | Existing item rename/display-name edit; new `property_ui` created, renamed, edited, saved, and deleted | PASS |
| Property Values | Existing value delete and usage cleanup | PASS |
| Zones | Add `Zone1`, rename, change target/folder attributes, delete, save | PASS |
| Data Types | Existing description/attribute edit and mapping controls inspected | PASS; create/delete not exposed in this run |
| Data Source Types | Existing description edit and mapping controls inspected | PASS; create/delete not exposed in this run |
| Data Products | Rename `DataProduct1`, edit module display name, save/reload | PASS |
| Attribute Types | Existing description edit and type/unit/precision controls inspected | PASS; create/delete not exposed in this run |
| Data Sources | Add `DataSource1`, rename, edit description, delete, save | PASS |

The UI correctly blocks deleting the only `DataProduct1` because at least one
data product is required. For the other categories, the UI exposes either a
complete lifecycle or only an editor for existing definitions; the matrix does
not claim create/delete coverage where no such action was available. The
Windows desktop path now explicitly selects `WinVaultKeyring`; source
connection validation succeeded in this run. The browser-only test harness used
an authenticated local proxy for UI validation. The source import wizard now
uses the v2 locations and metadata routes and successfully imported `debitor`.

Destructive scenarios were executed only after action-time confirmation and only
against temporary solution copies. Each completed scenario verified the filesystem after
`POST /model/save` and again after reload.

The following routes remain outside this UI-only matrix because the product has
no corresponding UI action: `/version`, `GET /entities`, `GET /model/unsaved`,
plugin detail, function list routes, `/sources/compare`, and
`/sources/{source}/usages`.
