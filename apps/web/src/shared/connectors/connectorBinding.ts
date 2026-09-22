import type { ConnectionProperties, ConnectionProperty, ConnectorBinding as DomainConnectorBinding } from "@datam8/types";

export const CONNECTOR_ID_PREFIX = "__connector.id=";
export const CONNECTOR_VERSION_PREFIX = "__connector.version=";

export type ConnectorBinding = DomainConnectorBinding;

function asConnectionProperties(connectionProperties: unknown): ConnectionProperties {
  if (!Array.isArray(connectionProperties)) return [];
  return connectionProperties.filter((item): item is ConnectionProperty => !!item && typeof item === "object");
}

export function isReservedConnectionProperty(name: string): boolean {
  const n = (name || "").trim();
  return n.startsWith(CONNECTOR_ID_PREFIX) || n.startsWith(CONNECTOR_VERSION_PREFIX);
}

export function decodeConnectorBinding(connectionProperties: unknown): ConnectorBinding | null {
  const list = asConnectionProperties(connectionProperties);
  const ids: string[] = [];
  const versions: string[] = [];

  for (const p of list) {
    const rawName = p.name;
    if (typeof rawName !== "string" || !rawName.trim()) continue;
    const name = rawName.trim();
    if (name.startsWith(CONNECTOR_ID_PREFIX)) {
      const v = name.slice(CONNECTOR_ID_PREFIX.length).trim();
      if (v) ids.push(v);
      continue;
    }
    if (name.startsWith(CONNECTOR_VERSION_PREFIX)) {
      const v = name.slice(CONNECTOR_VERSION_PREFIX.length).trim();
      if (v) versions.push(v);
      continue;
    }
  }

  if (!ids.length && !versions.length) return null;
  if (ids.length !== 1) {
    throw new Error(`Invalid connector binding: expected exactly one ${CONNECTOR_ID_PREFIX}<id> entry`);
  }
  if (versions.length > 1) {
    throw new Error(`Invalid connector binding: expected at most one ${CONNECTOR_VERSION_PREFIX}<version> entry`);
  }
  return { connectorId: ids[0]!, connectorVersion: versions[0] ?? null };
}

export function encodeConnectorBinding(args: {
  connectionProperties: unknown;
  connectorId: string;
  connectorVersion?: string | null;
}): ConnectionProperties {
  const { connectionProperties, connectorId } = args;
  const connectorVersion = (args.connectorVersion || "").trim() || null;

  const cid = (connectorId || "").trim();
  if (!cid) throw new Error("connectorId is required");

  const list = asConnectionProperties(connectionProperties);
  const kept: ConnectionProperties = [];
  for (const p of list) {
    const rawName = p.name;
    if (typeof rawName === "string" && isReservedConnectionProperty(rawName)) continue;
    kept.push(p);
  }

  kept.push({
    name: `${CONNECTOR_ID_PREFIX}${cid}`,
    required: true,
    description: "Reserved: connector binding (do not render).",
  });
  if (connectorVersion) {
    kept.push({
      name: `${CONNECTOR_VERSION_PREFIX}${connectorVersion}`,
      required: false,
      description: "Reserved: connector version (do not render).",
    });
  }
  return kept;
}

export function clearConnectorBinding(connectionProperties: unknown): ConnectionProperties {
  const list = asConnectionProperties(connectionProperties);
  const kept: ConnectionProperties = [];
  for (const p of list) {
    const rawName = p.name;
    if (typeof rawName === "string" && isReservedConnectionProperty(rawName)) continue;
    kept.push(p);
  }
  return kept;
}
