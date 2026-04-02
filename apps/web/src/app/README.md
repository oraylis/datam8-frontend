# App Shell (Web)

Top-level UI composition for the web client.

## Files
- `AppShell.tsx` - ribbon (New/Open/Reload/Add Entity), theme toggle, sidebar + workspace wiring, tab bar, generator panel.
- `SolutionDialog.tsx` - server-side picker dialog for `.dm8s`.
- `NewProjectDialog.tsx` - two-step wizard for creating solutions (`Solution` then `Targets`) via `/solution/new-project`, with required save directory (`<savePath>/<solutionName>/<solutionName>.dm8s`) and per-target ZIP template upload (multipart in web mode, base64 JSON archive transport in desktop mode).
- `App.tsx` / `main.tsx` - entry wiring with providers (theme, solution/model/generator/file system contexts).
- `toaster.tsx` - toast host; `index.css` - global styles.

## Notes
- Entity/Base/Folder editors persist via autosave.
- Base saves can produce follow-up model actions handled in the `Apply actions` dialog (`Apply` or `Cancel` with undo of the triggering base change).
- Sidebar resizing uses `useResizablePane`.
- AppShell stays in sync with SolutionContext (picker state, errors) and GeneratorContext (targets/log level/logs).

## Canonical Autosave Documentation
- Full behavior reference: [`docs/autosave.md`](../../../../docs/autosave.md)

## Extending
- When adding new ribbon actions, keep the shell thin; extract logic into hooks (for example save/reload handlers).
- Preserve keyboard shortcuts and dirty/tab state when refactoring.
