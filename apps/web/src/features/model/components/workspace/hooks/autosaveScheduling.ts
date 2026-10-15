import { flushSync } from "react-dom";

// Imperative context switches must finish the editor's existing save and any
// replay scheduled by its React effect. No global request tracker or quiet timer.
export async function flushAutosave(
  pending: { current: Promise<boolean> | null },
  persist: () => Promise<boolean>,
  hasQueuedSave: () => boolean,
  flushState = () => flushSync(() => {}),
): Promise<boolean> {
  flushState();
  let saved: boolean;
  do {
    // Ask the editor to save even while a request is running: its existing
    // single-flight logic records whether the newer draft needs a replay.
    const requested = persist();
    saved = await (pending.current ?? requested);
    flushState();
  } while (saved && (pending.current || hasQueuedSave()));
  return saved;
}

export type QueuedPersistResolution<TReason extends string> =
  | { shouldReschedule: false }
  | {
      shouldReschedule: true;
      dirty: true;
      reason: TReason;
      revision: number;
    };

export const resolveQueuedPersistAfterSave = <TReason extends string>(
  queued: boolean,
  reason: TReason,
  revision: number,
  saveStartedRevision: number,
): QueuedPersistResolution<TReason> => {
  if (!queued) return { shouldReschedule: false };
  if (revision <= saveStartedRevision) return { shouldReschedule: false };
  return {
    shouldReschedule: true,
    dirty: true,
    reason,
    revision,
  };
};
