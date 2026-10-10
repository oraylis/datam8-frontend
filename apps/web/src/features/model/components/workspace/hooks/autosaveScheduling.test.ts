import { describe, expect, it } from "vitest";
import { flushAutosave, resolveQueuedPersistAfterSave } from "./autosaveScheduling";

describe("flushAutosave", () => {
  it("waits for the running save and its queued newer revision without a quiet-time heuristic", async () => {
    let firstDone!: (value: boolean) => void;
    let nextDone!: (value: boolean) => void;
    let replay = false;
    const pending = { current: new Promise<boolean>(resolve => { firstDone = resolve; }) as Promise<boolean> | null };
    const flushState = () => {
      if (replay) {
        replay = false;
        pending.current = new Promise<boolean>(resolve => { nextDone = resolve; });
      }
    };
    let completed = false;
    const flushing = flushAutosave(pending, async () => true, () => replay, flushState).then(saved => { completed = true; return saved; });
    pending.current = null;
    replay = true;
    firstDone(true);
    await Promise.resolve();
    expect(completed).toBe(false);
    pending.current = null;
    nextDone(true);
    expect(await flushing).toBe(true);
  });

  it("saves a pending draft and reports failure without retrying automatically", async () => {
    let attempts = 0;
    expect(await flushAutosave({ current: null }, async () => { attempts++; return false; }, () => false, () => {})).toBe(false);
    expect(attempts).toBe(1);
  });

  it("drains a queued revision even before its React effect starts a request", async () => {
    let finish!: (value: boolean) => void;
    const pending = { current: new Promise<boolean>(resolve => { finish = resolve; }) as Promise<boolean> | null };
    void pending.current!.then(() => { pending.current = null; });
    let queued = false, saved = "first";
    const flushing = flushAutosave(pending, async () => {
      if (pending.current) { queued = true; return false; }
      queued = false; saved = "latest"; return true;
    }, () => queued, () => {});
    finish(true);
    expect(await flushing).toBe(true);
    expect(saved).toBe("latest");
  });
});

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
