# Model Workspace (Web)

Feature area for browsing and editing model/base entities with tabbed editors.

## Entry Points

- `ModelEditorContext.tsx` - tabs, selection, collapsed groups, dirty tracking.
- `components/Workspace.tsx` - switches between entity editor and base editor; wires save/dirty callbacks.
- `components/Sidebar.tsx` - tree navigation, base list, multi-select, duplicate/delete/move actions.
- `components/CreateModelEntityWizard.tsx` - multi-step entity creation wizard.

## Entity Editor

- Location: `components/workspace/entity-editor/*`.
- Sections: overview, attributes, sources, relationships, transformations, quality.
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
- `shared/ui/useSaveFailureToast.tsx` - retained helper for scoped error/retry messages;
  currently not wired into editor rendering. Editor saves use a transient sidebar status.

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

## Quality editing

The Quality section uses generated schema types and the existing entity autosave
queue. Rule dialogs keep incomplete input local until confirmation. Quality
settings and rules participate in tab drafts and dirty detection. Invalid quality
blocks persistence; generation flushes editor saves first. Backend validation is
canonical; see the [contract](../../../../../submodules/datam8-generator/docs/backend-contract.md#entity-quality-requirements).

The rule dialog derives its definition type from `expression` or `function`.
SQL keeps the existing text editor; native definitions have a function name and
an arguments JSON object editor. Invalid JSON stays in the local dialog draft.
Switching definition types persists only the selected variant. Function names
and argument semantics are validated by DQX at runtime, without a frontend
catalogue or function-specific forms. See the sample's
[Quality reference](https://github.com/oraylis/datam8-sample-solution/blob/feature/quality-framework/generate/databricks-lake/quality.md)
for SQL and native examples, including aggregate monitoring.

The argument editor blocks nonfinite numbers, integers outside JavaScript's safe
integer range and decimal input that would round to a different JSON value. Such
values remain in the dialog with an error instead of being saved as a rounded
number or null. The backend schema keeps its general JSON argument contract.
