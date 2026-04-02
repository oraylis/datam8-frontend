# Autosave in datam8-neon (Web)

This document is the canonical reference for autosave behavior in the web editor.

## Scope

Covered:
- Model entity editor autosave.
- Base editor autosave (form and JSON modes).
- Folder editor autosave.
- Base side effects that are executed via the `Apply actions` dialog.
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
- `AppShell` calls registered persist callbacks before context switches and handles base save side effects (`Apply actions`).

## Trigger matrix

Autosave reasons are internal trigger labels used for gating and scheduling:

| Trigger | Source | Entity | Base | Folder |
|---|---|---:|---:|---:|
| `text-blur` | `onBlurCapture` on text inputs and textareas | Yes | Yes | Yes |
| `dropdown-change` | `dm8:form-select-change` event | Yes | Yes | Yes |
| `add-item` | add/commit actions, checkbox/value-commit events | Yes | Yes | Yes |
| `delete-item` | delete actions | Yes | Yes | No |
| `undo-delete` | undo delete actions | Yes | Yes | No |
| `tab-switch` | tab or selection switch via `AppShell` | Yes | Yes | Yes |

Notes:
- Checkbox changes are routed through `dm8:checkbox-change` and currently map to `add-item`.
- Value commits are routed through `dm8:value-commit` and map to `add-item`.

## Persistence model

Each editor uses the same core pattern:

1. Mutations mark state dirty and increment a local change revision.
2. `persistAfterStateFlush(reason)` records a pending reason plus revision.
3. An effect waits until state is flushed (`changeRevision` reached), then calls `persistNow(reason)`.
4. `persistNow` enforces:
   - early return if not dirty,
   - single in-flight request (`persistInFlight`),
   - one queued replay (`persistQueued`) if changes arrive while saving.

This avoids overlapping saves while still persisting the latest state.

## Validation gates and skip behavior

### Entity editor (`useEntityState`)

- For reasons other than `tab-switch`, save is skipped if the draft has incomplete linkage:
  - relationships missing zone or target entity,
  - internal sources without valid `sourceLocation`,
  - external sources missing data source or source location.
- `tab-switch` forces an attempted save (still validated inside submit).

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

## Base side effects: Apply actions

Some base saves create follow-up actions to keep model structure consistent.

Current action types:
- Folder rename actions (zones, data products/modules).
- Zone folder tree delete actions.
- Property refactor actions across entities.

Detection sources:
- Zone rename/delete diff.
- Data product/module rename diff.
- Property/property-value rename/delete diff.

## Apply actions dialog behavior

When a base save produces follow-up actions, `AppShell` opens a modal dialog:

- Dialog is decision-driven and blocked from accidental close (`ESC`/outside interaction are prevented while active).
- Buttons:
  - `Apply`: execute follow-up actions sequentially.
  - `Cancel`: undo the triggering base change by restoring the previous base content.

Failure handling:
- Each failed action is retained in the prompt state.
- Success/failure toasts summarize outcomes.

## Zone delete semantics

Zone delete follow-up actions remove local model tree content for the zone:

- Action path is normalized from `Model/<Zone>` to local folder scope.
- Deletes:
  - all model entity files under the folder subtree,
  - all folder metadata entries under the subtree.
- UI state is updated consistently (tabs, selection, expanded paths, dirty folder paths).

## Delete toast suppression when apply dialog exists

For base types that immediately enter the apply-actions flow (`zones`, `dataProducts`, `properties`), local "Deleted + Undo" toast notifications are suppressed to avoid double decision paths.

## Context-switch and close behavior

`AppShell` calls editor persist callbacks before switching active editor context (tab/entity/base/folder selection changes).

If tabs remain dirty due to save errors:
- closing a tab asks for confirmation (`Pending Sync`),
- closing all tabs asks for confirmation with count.

Reload checks combined dirty state (editor tabs + folder dirty paths) and asks for confirmation before reloading.

## Patch-based base autosave path

`onPatchBaseEntity` in `AppShell` supports cross-editor base mutations (for example from entity-side operations):

- It updates base state optimistically.
- Schedules immediate async save (`setTimeout(..., 0)`).
- Uses per-relPath in-flight and queued guards similar to editor hooks.

This path bypasses form-level base editor validation and is intended for controlled programmatic updates.

## Developer checklist for autosave changes

When adding a new editable control:

1. Ensure the change marks editor state dirty.
2. Emit or wire one of the known trigger reasons.
3. Verify the change participates in `persistAfterStateFlush`.
4. Confirm behavior in both normal save and save-error/retry scenarios.
5. If base side effects are introduced, extend apply-actions detection and dialog messaging.
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

