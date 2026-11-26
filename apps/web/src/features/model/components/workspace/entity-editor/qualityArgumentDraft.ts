export type ArgumentType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "array"
  | "object";
export type ArgumentEntry = {
  id: string;
  name: string;
  type: ArgumentType;
  value: string;
  children: ArgumentEntry[];
};

export function argumentEntry(
  name: string,
  value: unknown = "",
): ArgumentEntry {
  const type: ArgumentType =
    value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value === "object"
          ? "object"
          : typeof value === "boolean"
            ? "boolean"
            : typeof value === "number"
              ? "number"
              : "string";
  return {
    id: crypto.randomUUID(),
    name,
    type,
    value:
      type === "string"
        ? String(value)
        : type === "number" || type === "boolean"
          ? String(value)
          : "",
    children:
      type === "array"
        ? (value as unknown[]).map((item, i) => argumentEntry(String(i), item))
        : type === "object"
          ? argumentEntries(value as Record<string, unknown>)
          : [],
  };
}

export function argumentEntries(
  value: Record<string, unknown>,
): ArgumentEntry[] {
  return Object.entries(value).map(([name, item]) => argumentEntry(name, item));
}

export function newArgument(
  entries: ArgumentEntry[],
  array = false,
): ArgumentEntry {
  let name = "argument";
  for (let i = 2; entries.some((entry) => entry.name === name); i++)
    name = `argument_${i}`;
  return argumentEntry(array ? String(entries.length) : name);
}

export function changeArgumentType(
  entry: ArgumentEntry,
  type: ArgumentType,
): ArgumentEntry {
  if (entry.type === type) return entry;
  return {
    ...entry,
    type,
    value: type === "boolean" ? "false" : type === "number" ? "0" : "",
    children: [],
  };
}

export function argumentEntriesJson(
  entries: ArgumentEntry[],
  array = false,
): string {
  if (
    !array &&
    new Set(entries.map((entry) => entry.name)).size !== entries.length
  )
    throw new Error("Argument names must be unique within each object.");
  const values = entries.map((entry) => {
    let value: string;
    switch (entry.type) {
      case "array":
        value = argumentEntriesJson(entry.children, true);
        break;
      case "object":
        value = argumentEntriesJson(entry.children);
        break;
      case "null":
        value = "null";
        break;
      case "boolean":
        value = entry.value === "true" ? "true" : "false";
        break;
      case "number":
        if (
          !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(
            entry.value.trim(),
          )
        )
          throw new Error(
            `Enter a valid number for ${entry.name || "this argument"}.`,
          );
        value = entry.value.trim();
        break;
      default:
        value = JSON.stringify(entry.value);
    }
    return array ? value : `${JSON.stringify(entry.name)}: ${value}`;
  });
  return array ? `[${values.join(", ")}]` : `{${values.join(", ")}}`;
}
