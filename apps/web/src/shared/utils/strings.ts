export const toLower = (value?: string | null) => (value || "").toLowerCase();

export const humanize = (value: string): string =>
  value
    ?.replace(/[_\-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase()) || "";
