export type ValidateResponse = {
  status: string;
  solutionPath: string;
  messages?: string[];
};

export function buildValidateUrl(apiBase: string, solutionPath: string, logLevel?: string): string {
  const params = new URLSearchParams();
  params.set("path", solutionPath);

  const normalizedLogLevel = (logLevel || "").trim();
  if (normalizedLogLevel) {
    params.set("logLevel", normalizedLogLevel);
  }

  return `${apiBase}/validate?${params.toString()}`;
}

export function readValidateErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }

    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    const nestedMessage = (payload as { error?: { message?: unknown } }).error?.message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  return fallback;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function extractStrings(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value];

  if (Array.isArray(value)) {
    const lines: string[] = [];
    for (const item of value) {
      lines.push(...extractStrings(item));
    }
    return lines;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.message, obj.msg, obj.text, obj.line];
    const lines: string[] = [];
    for (const candidate of candidates) {
      lines.push(...extractStrings(candidate));
    }
    return lines;
  }

  return [];
}

function normalizeMessageLines(values: string[]): string[] {
  const lines: string[] = [];
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

  for (const value of values) {
    const split = value
      .split(/\r\n|\n|\r/g)
      .map((line) => line.replace(ansiRegex, "").trim())
      .filter((line) => line.length > 0);
    lines.push(...split);
  }

  return lines;
}

export function readValidateMessages(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;
  const details = obj.details && typeof obj.details === "object" ? (obj.details as Record<string, unknown>) : null;
  const rawLines = [
    ...toStringList(obj.messages),
    ...toStringList(details?.messages),
    ...extractStrings(obj.logs),
    ...extractStrings(details?.logs),
    ...extractStrings(obj.log),
    ...extractStrings(details?.log),
    ...extractStrings(obj.stdout),
    ...extractStrings(details?.stdout),
    ...extractStrings(obj.output),
    ...extractStrings(details?.output),
    ...extractStrings(obj.message),
  ];
  if (rawLines.length === 0) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const line of normalizeMessageLines(rawLines)) {
    if (!seen.has(line)) {
      seen.add(line);
      normalized.push(line);
    }
  }
  return normalized;
}
