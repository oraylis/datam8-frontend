import { apiBase } from "../../../../config";
import { readBackendErrorMessage } from "../../../../shared/api/errorMessage";

type JsonRecord = Record<string, unknown>;

export type SourcePreviewTableRef = {
  schema?: string;
  name: string;
  sourceLocation?: string;
};

export type SourcePreviewResult = {
  rows: JsonRecord[];
  columns: string[];
};

type MultiItemResponse = {
  items?: unknown;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function buildSourcePreviewEndpoint(dataSource: string, table: SourcePreviewTableRef, limit = 10): string {
  const encodedDataSource = encodeURIComponent(dataSource);
  const params = new URLSearchParams();
  params.set("source_location", table.sourceLocation || table.name);
  params.set("limit", String(limit));
  return `${apiBase}/sources/${encodedDataSource}/locations/preview?${params.toString()}`;
}

export function buildSourceMetadataEndpoint(dataSource: string, sourceLocation: string): string {
  const params = new URLSearchParams();
  params.set("source_location", sourceLocation);
  return `${apiBase}/sources/${encodeURIComponent(dataSource)}/locations/metadata?${params.toString()}`;
}

export function buildSourceLocationsEndpoint(dataSource: string, sourceLocation?: string): string {
  const params = new URLSearchParams();
  const trimmed = `${sourceLocation || ""}`.trim();
  if (trimmed) params.set("source_location", trimmed);
  const query = params.toString();
  return `${apiBase}/sources/${encodeURIComponent(dataSource)}/locations${query ? `?${query}` : ""}`;
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
