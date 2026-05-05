type ConnectionPropertyRef = { name?: unknown };

function allowedConnectionPropertyNames(connectionProperties: ConnectionPropertyRef[]) {
  return new Set(
    (connectionProperties || [])
      .map((entry) => (typeof entry?.name === "string" ? entry.name.trim() : ""))
      .filter(Boolean),
  );
}

export function pruneConnectionPropertiesForConnector(
  extendedProperties: unknown,
  connectionProperties: ConnectionPropertyRef[],
) {
  const source =
    extendedProperties && typeof extendedProperties === "object" && !Array.isArray(extendedProperties)
      ? (extendedProperties as Record<string, unknown>)
      : {};
  const allowed = allowedConnectionPropertyNames(connectionProperties);
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key)) next[key] = value;
  }

  return next;
}
