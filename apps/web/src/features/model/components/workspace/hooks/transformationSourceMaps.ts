const toIndex = (key: string): number | null => {
  const idx = Number(key);
  return Number.isInteger(idx) ? idx : null;
};

export function reindexRecordAfterRemove<T>(
  record: Record<number, T>,
  removedIndex: number,
): Record<number, T> {
  const next: Record<number, T> = {};
  for (const [key, value] of Object.entries(record)) {
    const idx = toIndex(key);
    if (idx === null || idx === removedIndex) continue;
    const target = idx > removedIndex ? idx - 1 : idx;
    next[target] = value;
  }
  return next;
}

export function reindexRecordAfterMove<T>(
  record: Record<number, T>,
  from: number,
  to: number,
): Record<number, T> {
  if (from === to) return { ...record };
  const next: Record<number, T> = {};
  for (const [key, value] of Object.entries(record)) {
    const idx = toIndex(key);
    if (idx === null) continue;

    let target = idx;
    if (idx === from) target = to;
    else if (from < to && idx > from && idx <= to) target = idx - 1;
    else if (from > to && idx >= to && idx < from) target = idx + 1;

    next[target] = value;
  }
  return next;
}
