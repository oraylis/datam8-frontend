import { useSyncExternalStore } from "react";
import { apiBase } from "../../config";
import { readBackendErrorMessage } from "../api/errorMessage";

export type ConnectorSummary = {
  id: string;
  displayName: string;
  version: string;
  capabilities?: {
    uiSchema?: boolean;
    validateConnection?: boolean;
    metadata?: { listTables?: boolean; getTableMetadata?: boolean };
    runtimeQuery?: { sql?: boolean; dataFrame?: boolean };
  } | null;
  dataTypeMapping: Array<{ sourceType: string; targetType: string }>;
};

export type ConnectorCatalogState = {
  status: "idle" | "loading" | "ready" | "error";
  connectors: ConnectorSummary[];
  error?: string;
};

type JsonRecord = Record<string, unknown>;
type RawConnector = JsonRecord & {
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  version?: unknown;
  capabilities?: unknown;
  dataTypeMapping?: unknown;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

let state: ConnectorCatalogState = {
  status: "idle",
  connectors: [],
};

const subscribers = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function emit() {
  for (const cb of subscribers) cb();
}

function setState(next: ConnectorCatalogState) {
  state = next;
  emit();
}

function parseDataTypeMapping(raw: unknown): Array<{ sourceType: string; targetType: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ sourceType: string; targetType: string }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isJsonRecord(item)) continue;
    const sourceType = `${item.sourceType || ""}`.trim();
    const targetType = `${item.targetType || ""}`.trim();
    if (!sourceType || !targetType) continue;
    const key = sourceType.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sourceType, targetType });
  }
  return out;
}

function parseCapabilities(raw: unknown): ConnectorSummary["capabilities"] {
  if (Array.isArray(raw)) {
    const caps = new Set(raw.map((item) => `${item || ""}`.trim()));
    return {
      uiSchema: caps.has("uiSchema"),
      validateConnection: caps.has("validationConnection") || caps.has("validateConnection"),
      metadata: caps.has("metadata")
        ? {
            listTables: true,
            getTableMetadata: true,
          }
        : undefined,
    };
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as ConnectorSummary["capabilities"];
  }

  return null;
}

async function fetchConnectors(): Promise<void> {
  setState({ status: "loading", connectors: state.connectors });
  try {
    const res = await fetch(`${apiBase}/plugins/`);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(readBackendErrorMessage(payload, `Failed to load connectors (${res.status})`));
    }
    const data = await res.json().catch(() => ({}));
    const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const connectors: ConnectorSummary[] = Array.isArray(rawItems)
      ? rawItems
          .filter((c): c is RawConnector => isJsonRecord(c))
          .map((c) => ({
            id: String(c.id || ""),
            displayName: String(c.displayName || c.name || c.id || ""),
            version: String(c.version || ""),
            capabilities: parseCapabilities(c?.capabilities),
            dataTypeMapping: parseDataTypeMapping(c?.dataTypeMapping),
          }))
          .filter((c: ConnectorSummary) => !!c.id)
      : [];
    setState({ status: "ready", connectors });
  } catch (err: any) {
    console.error("[DataM8] Failed to load connector catalog:", err);
    setState({ status: "error", connectors: [], error: err?.message || "Failed to load connectors" });
  }
}

export function getConnectorCatalogState(): ConnectorCatalogState {
  return state;
}

export function getConnectors(): ConnectorSummary[] {
  return state.connectors;
}

export async function ensureLoaded(): Promise<void> {
  if (state.status === "ready") return;
  if (!inFlight) {
    inFlight = fetchConnectors().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function refresh(): Promise<void> {
  inFlight = fetchConnectors().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function subscribeConnectorCatalog(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function useConnectorCatalog<T>(selector: (s: ConnectorCatalogState) => T): T {
  return useSyncExternalStore(
    subscribeConnectorCatalog,
    () => selector(state),
    () => selector(state),
  );
}
