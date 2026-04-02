type JsonRecord = Record<string, unknown>;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readDetail(detail: unknown): string | null {
  const direct = asNonEmptyString(detail);
  if (direct) return direct;

  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (item && typeof item === "object") {
        const msg = asNonEmptyString((item as JsonRecord).msg);
        if (msg) return msg;
      }
      const asString = asNonEmptyString(item);
      if (asString) return asString;
    }
  }

  return null;
}

export function readBackendErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const obj = payload as JsonRecord;

  const message = asNonEmptyString(obj.message);
  if (message) return message;

  const detail = readDetail(obj.detail);
  if (detail) return detail;

  return fallback;
}
