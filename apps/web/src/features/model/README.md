# Model Workspace (Web)

Feature area for browsing and editing model/base entities with tabbed editors.

## Entry Points
- `ModelEditorContext.tsx` - tabs, selection, collapsed groups, dirty tracking.
- `components/Workspace.tsx` - switches between entity editor and base editor; wires save/dirty callbacks.
- `components/Sidebar.tsx` - tree navigation, base list, multi-select, duplicate/delete/move actions.
- `components/CreateModelEntityWizard.tsx` - multi-step entity creation wizard.

## Entity Editor
- Location: `components/workspace/entity-editor/*`.
- Sections: overview, attributes, sources, relationships, transformations.
- State hook: `useEntityState` (drafts, validation gates, autosave scheduling, retry/error state).

## Base Editor
- Location: `components/workspace/base-editor/*`.
- State hook: `useBaseEditorState` (form/JSON modes, selection memory, validation gates, autosave scheduling).
- Additional side effects are triggered from base saves and executed immediately by `AppShell`.

## Folder Editor
- Location: `components/workspace/folder-editor/FolderEditor.tsx`.
- Uses the same autosave pattern (dirty detection, queued persistence, retryable error state).

## Shared Types and Helpers
- `model-types.ts` - `ModelEntity`, `BaseEntity`, tab types, property option types.
- `model-utils.ts` - base type detection, inherited props merge, tree utilities.
- `workspace/lib/validation.ts` - base/entity validation rules.
- `shared/ui/useSaveFailureToast.tsx` - centralized top-right save-failure notifications with retry action.

## Autosave Summary
- Trigger sources include text blur, select/checkbox/value commit events, add/delete actions, and tab switches.
- Non-tab triggers can skip persistence while required linkage/fields are incomplete.
- Failed saves keep dirty indicators; returning to a clean state resets local error status.
- For base types with follow-up actions (`zones`, `properties`), delete toasts are suppressed to avoid overlapping notifications.
- Folder rename actions are triggered from `FolderEditor` when the folder name is changed and run immediately.

## Canonical Autosave Documentation
- Full behavior reference: [`docs/autosave.md`](../../../../../docs/autosave.md)

## Extending
- Keep domain behavior in feature hooks (`useEntityState`, `useBaseEditorState`, `FolderEditor`) rather than UI-only components.
- When adding editable fields, wire them into dirty tracking and a supported autosave trigger reason.
- If base changes introduce model follow-up operations, extend base-save effect detection and follow-up action notifications.
