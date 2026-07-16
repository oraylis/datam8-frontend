import { apiBase } from "../../../../config";
import { readBackendErrorMessage } from "../../../../shared/api/errorMessage";

type JsonRecord = Record<string, unknown>;

export type SourcePreviewTableRef = {
  schema?: string;
  name: string;
};

export type SourcePreviewResult = {
  rows: JsonRecord[];
  columns: string[];
};

const SQLSERVER_ODCS_AUTH_MODES = new Set([
  "bitbucket_app_password",
  "bitbucket_bearer_token",
  "bitbucket_server_bearer_token",
]);

export function canPreviewDataSource(
  dataSource: {
    connectorId?: string | null;
    connector?: { id?: string | null } | null;
    extendedProperties?: Record<string, unknown>;
  } | null | undefined,
  connector: { capabilities?: { previewData?: boolean } | null } | null | undefined,
): boolean {
  if (connector?.capabilities?.previewData !== true) return false;
  const connectorId = `${dataSource?.connectorId || dataSource?.connector?.id || ""}`.trim().toLowerCase();
  const authMode = `${dataSource?.extendedProperties?.authMode || ""}`.trim();
  if (connectorId === "sqlserver" && SQLSERVER_ODCS_AUTH_MODES.has(authMode)) return false;
  return true;
}

type MultiItemResponse = {
  items?: unknown;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function buildSourcePreviewEndpoint(dataSource: string, table: SourcePreviewTableRef, limit = 10): string {
  const encodedDataSource = encodeURIComponent(dataSource);
  const encodedTable = encodeURIComponent(table.name);
  const limitPart = `?limit=${encodeURIComponent(String(limit))}`;
  if (table.schema?.trim()) {
    return `${apiBase}/sources/${encodedDataSource}/schemas/${encodeURIComponent(table.schema)}/tables/${encodedTable}/preview${limitPart}`;
  }
  return `${apiBase}/sources/${encodedDataSource}/tables/${encodedTable}/preview${limitPart}`;
}

export function normalizePreviewRows(payload: unknown): JsonRecord[] {
  const rawItems = (payload as MultiItemResponse | undefined)?.items;
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [];
  return items.filter(isJsonRecord);
}

export function derivePreviewColumns(rows: JsonRecord[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push(key);
    });
  });
  return ordered;
}

export async function fetchSourcePreview(
  dataSource: string,
  table: SourcePreviewTableRef,
  limit = 10,
): Promise<SourcePreviewResult> {
  const endpoint = buildSourcePreviewEndpoint(dataSource, table, limit);
  const response = await fetch(endpoint);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(readBackendErrorMessage(payload, "Failed to load preview data"));
  }

  const rows = normalizePreviewRows(payload);
  return { rows, columns: derivePreviewColumns(rows) };
}
