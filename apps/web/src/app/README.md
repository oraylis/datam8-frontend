# App Shell (Web)

Top-level UI composition for the web client.

## Files

- `AppShell.tsx` - shell-level actions (New/Open/Reload/Add Entity), theme toggle, sidebar + workspace wiring, tab bar, generator panel.
- `SolutionDialog.tsx` - server-side picker dialog for `.dm8s`.
- `NewProjectDialog.tsx` - retained two-step new-project UI. Its `/solution/new-project`
  consumer is not an implemented route in the pinned backend; do not claim an
  end-to-end supported flow from the component alone.
- `App.tsx` / `main.tsx` - entry wiring with providers (theme, solution/model/generator/file system contexts).
- `toaster.tsx` - toast host; `index.css` - global styles.

## Notes

- Entity/Base/Folder editors persist via autosave.
- Base saves can produce follow-up model actions that are executed immediately with success/error notifications.
- Reload and Add Entity are disabled until a solution is loaded; handlers also guard against running during solution loading.
- Sidebar resizing uses `useResizablePane`.
- AppShell stays in sync with SolutionContext (picker state, errors) and GeneratorContext (targets/log level/logs).

## Canonical Autosave Documentation

- Full behavior reference: [`docs/autosave.md`](../../../../docs/autosave.md)

## Extending

- When adding new ribbon actions, keep the shell thin; extract logic into hooks (for example save/reload handlers).
- Preserve keyboard shortcuts and dirty/tab state when refactoring.
