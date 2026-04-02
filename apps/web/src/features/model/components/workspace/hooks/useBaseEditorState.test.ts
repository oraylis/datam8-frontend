import { describe, expect, it } from "vitest";
import { shouldAllowIncompleteBaseDraftTransition, type PersistReason } from "./useBaseEditorState";

describe("shouldAllowIncompleteBaseDraftTransition", () => {
  it("blocks tab switch when required fields are still incomplete", () => {
    expect(shouldAllowIncompleteBaseDraftTransition("tab-switch")).toBe(false);
  });

  it("allows autosave triggers to continue while draft is incomplete", () => {
    const reasons: PersistReason[] = ["text-blur", "dropdown-change", "add-item", "delete-item", "undo-delete"];
    reasons.forEach((reason) => {
      expect(shouldAllowIncompleteBaseDraftTransition(reason)).toBe(true);
    });
  });
});
