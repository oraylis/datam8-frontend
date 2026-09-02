# Computer-Use-Only Full Workflow Test

This is the non-CI acceptance run for the real visible app. It must use Computer Use actions only for UI interaction: click, type, scroll, keyboard, native dialogs, and screenshots. Do not use Playwright locators, DOM inspection, or browser automation APIs during this run.

## Preconditions

- `datam8-sample-solution` is available locally.
- The generator Python runtime is available through `DATAM8_PYTHON_PATH` or `submodules/datam8-generator/.venv`.
- Run against a disposable copy of the sample solution, never the original.

## Setup

1. Copy the sample solution directory to a temporary folder.
2. Start the dev app:
   - Preferred desktop run: `npm run dev:desktop`
   - Web fallback: start the backend for the copied `.dm8s`, then start the web dev server.
3. Open the visible app window.
4. Load the copied `.dm8s` through the visible UI. Use the native file picker when testing desktop; use the path input only for the web fallback.

## Required UI Flow

Record `PASS` or `FAIL` for each item and capture screenshots for the main states: opened solution, Base editor, Model editor, wizard, folder editor, validator/generator.

- Open solution: tree, Base tab, Model tab, Generator panel and global schema refresh action are visible.
- Base CRUD: add, edit, and delete one item in Attribute Types, Data Types, Data Sources, Data Source Types, Data Products, Zones, Properties, and Property Values.
- Property refactor: rename a Property and confirm assignments update; rename a Property Value; move a Property Value to another Property; delete the temporary Property Value and Property.
- Folder refactor: rename a Zone folder; create a Model folder; edit folder metadata; rename the folder; delete the temporary folder.
- Data Product refactor: rename a temporary Data Product and, if a module is present, rename a temporary Data Module.
- Model CRUD: create an entity with the wizard; add/edit an attribute; rename the entity; move it to another folder; duplicate it; delete the original and duplicate.
- Source/Connector flow: open Data Sources and Data Source Types; load connector metadata if available; open table/schema/preview UI from the wizard; run Refresh Schemas if the sample backend exposes a compatible source.
- Transformation flow: add or open a function transformation; open source code; edit and save source; rename the transformation; reorder it; delete it and confirm the source file behavior.
- Global actions: Reload, Generate, Validate only from the Generate split menu, and Refresh schemas.

## Required Checks

- No visible React runtime error or error overlay.
- No `Maximum update depth exceeded` in terminal or devtools output.
- Radix Select dropdowns open, select, and close normally.
- No broken native dialogs, stuck focus, or blocked keyboard navigation.
- Layout remains visually stable: no overlapping buttons, clipped labels, unreadable dialogs, or major design drift.
- After each mutating block, verify the copied solution files on disk reflect the expected state.
- Validate only and Generate complete with the expected success or a clearly explained backend validation result.

## Result Format

Create a short report with:

- Date/time and git branch.
- Copied solution path.
- App mode: desktop or web fallback.
- PASS/FAIL checklist.
- Screenshot paths.
- Terminal excerpts for errors only.
- Any workflow that could not run because the sample lacks the required connector/source data.
