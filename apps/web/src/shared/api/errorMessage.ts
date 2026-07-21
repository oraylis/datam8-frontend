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

function cleanErrorLine(line: string): string {
  return `${line || ""}`
    .replace(/^\s*[|│]\s?/, "")
    .replace(/\s?[|│]\s*$/, "")
    .trim();
}

function isErrorLineNoise(line: string): boolean {
  if (!line) return true;
  if (/^[+\-─━═╭╮╰╯┌┐└┘│| ]+$/.test(line)) return true;
  if (/^Traceback \(most recent call last\)/i.test(line)) return true;
  if (/^in [_a-zA-Z0-9]+:\d+$/i.test(line)) return true;
  if (/^[> ]*\d+\s+/.test(line)) return true;
  if (/^[A-Z]:\\.*(?:\.py|site-packages|Lib\\)/i.test(line)) return true;
  return false;
}

function stripErrorWrapper(message: string): string {
  let next = message.trim();
  next = next.replace(/^Failed to open solution:\s*/i, "");
  next = next.replace(/^HTTPException:\s*\d+:\s*/i, "");
  next = next.replace(/^Error:\s*/i, "");
  const listMatch = next.match(/^\[\s*(['"])([\s\S]*)\1\s*\]$/);
  if (listMatch) next = listMatch[2];
  const quoteMatch = next.match(/^(['"])([\s\S]*)\1$/);
  if (quoteMatch) next = quoteMatch[2];
  return next.replace(/\\n/g, "\n").trim();
}

export function compactErrorMessage(message: unknown, fallback = "Operation failed."): string {
  const raw = `${message || ""}`.trim();
  if (!raw) return fallback;
  const lines = raw
    .split(/\r?\n/)
    .map(cleanErrorLine)
    .filter((line) => !isErrorLineNoise(line));
  const selected = lines.at(-1) || raw;
  return stripErrorWrapper(selected) || fallback;
}
