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
