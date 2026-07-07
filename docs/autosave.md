# Autosave in datam8 (Web)

This document is the canonical reference for autosave behavior in the web editor.

## Scope

Covered:
- Model entity editor autosave.
- Base editor autosave (form and JSON modes).
- Folder editor autosave.
- Base side effects that are executed immediately after save.
- Save error handling and retry flow.

Not covered:
- Backend generation semantics.
- Desktop process startup and packaging behavior.

## High-level architecture

Autosave is coordinated by editor-local state hooks plus `AppShell` integration:

- `useEntityState` handles entity draft state, dirty detection, validation gates, and persistence scheduling.
- `useBaseEditorState` handles base draft state, validation gates, selection state, and persistence scheduling.
- `FolderEditor` has equivalent local autosave orchestration for folder metadata.
- `Workspace` registers `tab-switch` persistence callbacks to `AppShell`.
- `AppShell` calls registered persist callbacks before context switches and handles base save side effects.

## Trigger matrix

Autosave reasons are internal trigger labels used by editor commands:

| Trigger | Source | Entity | Base | Folder |
|---|---|---:|---:|---:|
| `text-blur` | parent `onBlurCapture` for directly bound text inputs and textareas | Yes | Yes | Yes |
| `dropdown-change` | explicit command from select/checkbox handlers | Yes | Yes | Yes |
| `add-item` | explicit command from add/reorder/property-list handlers | Yes | Yes | Yes |
| `delete-item` | delete actions | Yes | Yes | Yes |
| `undo-delete` | undo delete actions | Yes | Yes | No |
| `tab-switch` | tab or selection switch via `AppShell` | Yes | Yes | Yes |

Notes:
- `FormSelect` and `Checkbox` do not dispatch autosave events. The owning editor handler must call the matching command.
- Text fields that own a local draft and commit themselves, such as validated rename fields, are marked with `data-explicit-autosave="true"` so the parent blur handler does not save twice.

## Editor commands

Workspace editors follow one command model:

- `editText`: update central editor state and mark dirty. Save happens once through the parent blur handler with `text-blur`.
- `commitAction`: update central editor state, mark dirty, and schedule save after React state flush. Use this for selects, checkboxes, add/remove/reorder, `PropertyChips`, and `PropertyList`.
- `commitDraft`: validate a local draft, write it to central editor state, and schedule save after React state flush. Use this only when intermediate values are invalid or have side effects, for example attribute rename with `refactorNames`.
- `saveNow`: run an explicit save for tab switches, retry, and app-level persist callbacks.

## Persistence model

Each editor uses the same core pattern:

1. Mutations mark state dirty and increment a local change revision.
2. `persistAfterStateFlush(reason)` records a pending reason plus revision.
3. An effect waits until state is flushed (`changeRevision` reached), then calls `persistNow(reason)`.
4. `persistNow` enforces:
   - early return if not dirty,
   - single in-flight request (`persistInFlight`),
   - one queued replay only when a newer change revision arrived while saving.

This avoids overlapping saves while still persisting the latest state.

## Validation gates and skip behavior

### Entity editor (`useEntityState`)

- Relationship and source creation/editing happens in dialogs and commits only valid data into editor state.
- Relationships require a target entity and at least one complete source/target mapping before dialog save.
- Internal sources require a target entity; external sources require a data source and source location.
- Save payload normalization still filters incomplete legacy linkage rows defensively, but normal UI flows do not create them.

### Base editor (`useBaseEditorState`)

- For reasons other than `tab-switch`, save is skipped if required base fields are incomplete in form mode.
- `tab-switch` forces an attempted save (still validated in submit pipeline).

### Folder editor

- No required-field skip gate before `persistNow`; save attempt runs when dirty.

## Dirty flags and tab indicators

Dirty state is primarily a sync/error indicator:

- On successful save, tab dirty is cleared.
- On failed save, tab dirty is set so users can see unresolved sync errors.
- If state becomes clean again (for example by undoing/removing an invalid change), local save error state is reset to idle and the error alert disappears.

This behavior applies to entity, base, and folder editors.

## Save error UX

All editors render `SaveErrorAlert` when in error state.

Behavior:
- Alert title: `Save failed`.
- Primary action: `Retry now` (calls `persistNow("tab-switch")`).
- Error details are collapsible (`Show details` / `Hide details`).
- Default is collapsed.

## Base side effects: follow-up actions

Some base saves create follow-up actions to keep model structure consistent.

Current action types:
- Folder rename actions (zones, data products/modules).
- Zone folder tree delete actions.
- Property refactor actions across entities.

Detection sources:
- Zone rename/delete diff.
- Data product/module rename diff.
- Property/property-value rename/delete diff.

## Follow-up action execution behavior

When a base save produces follow-up actions, `AppShell` executes them immediately and sequentially.

Failure handling:
- Each failed action shows `Apply action failed`.
- A summary error shows when one or more actions fail.
- A summary info notification confirms applied actions.

## Zone delete semantics

Zone delete follow-up actions remove local model tree content for the zone:

- Action path is normalized from `Model/<Zone>` to local folder scope.
- Deletes:
  - all model entity files under the folder subtree,
  - all folder metadata entries under the subtree.
- UI state is updated consistently (tabs, selection, expanded paths, dirty folder paths).

## Delete toast suppression when follow-up actions exist

For base types with follow-up actions (`zones`, `dataProducts`, `properties`), local "Deleted + Undo" toast notifications are suppressed to avoid overlapping notifications.

## Context-switch and close behavior

`AppShell` calls editor persist callbacks before switching active editor context (tab/entity/base/folder selection changes).

If tabs remain dirty due to save errors:
- closing a tab asks for confirmation (`Pending Sync`),
- closing all tabs asks for confirmation with count.

Reload is disabled until a solution is loaded. When available, it checks combined dirty state (editor tabs + folder dirty paths) and asks for confirmation before reloading.

## Patch-based base autosave path

`onPatchBaseEntity` in `AppShell` supports cross-editor base mutations (for example from entity-side operations):

- It updates base state optimistically.
- Schedules immediate async save (`setTimeout(..., 0)`).
- Uses per-relPath in-flight and queued guards similar to editor hooks.

This path bypasses form-level base editor validation and is intended for controlled programmatic updates.

## Developer checklist for autosave changes

When adding a new editable control:

1. Text input or textarea: bind directly to editor state, mark dirty in `onChange`, and rely on parent blur.
2. Select, checkbox, add/remove/reorder, `PropertyChips`, or `PropertyList`: update editor state and call the local commit action with the correct reason.
3. Local draft with validation or side effects: validate, commit to editor state, and schedule save from the draft commit handler. Mark the input with `data-explicit-autosave="true"` if it can also bubble to parent blur.
4. Confirm behavior in both normal save and save-error/retry scenarios.
5. If base side effects are introduced, extend follow-up action detection and notification messaging.
6. Update this document and summary READMEs.

## Related files

- `apps/web/src/features/model/components/workspace/hooks/useEntityState.ts`
- `apps/web/src/features/model/components/workspace/hooks/useBaseEditorState.ts`
- `apps/web/src/features/model/components/workspace/folder-editor/FolderEditor.tsx`
- `apps/web/src/features/model/components/workspace/common/SaveErrorAlert.tsx`
- `apps/web/src/features/model/refactor/baseSaveEffects.ts`
- `apps/web/src/app/AppShell.tsx`

## Related tests

- `apps/web/src/features/model/components/workspace/hooks/useEntityState.test.ts`
- `apps/web/src/features/model/components/workspace/common/SaveErrorAlert.test.ts`
- `apps/web/src/features/model/refactor/baseSaveEffects.test.ts`

