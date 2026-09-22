import { describe, expect, it } from "vitest";
import { resolveQueuedPersistAfterSave } from "./autosaveScheduling";

describe("resolveQueuedPersistAfterSave", () => {
  it("does not reschedule when no save was queued while another save was in flight", () => {
    expect(resolveQueuedPersistAfterSave(false, "dropdown-change", 3, 2)).toEqual({
      shouldReschedule: false,
    });
  });

  it("does not reschedule a duplicate queued save for the same revision", () => {
    expect(resolveQueuedPersistAfterSave(true, "dropdown-change", 3, 3)).toEqual({
      shouldReschedule: false,
    });
  });

  it("keeps the draft dirty and reschedules when a newer revision arrived during the in-flight save", () => {
    expect(resolveQueuedPersistAfterSave(true, "dropdown-change", 4, 3)).toEqual({
      shouldReschedule: true,
      dirty: true,
      reason: "dropdown-change",
      revision: 4,
    });
  });
});
