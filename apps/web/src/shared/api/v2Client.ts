import { apiBase } from "../../config";
import { folderPathFromRelPath, modelLocatorFromRelPath } from "../../features/model/locator-utils";

type JsonRecord = Record<string, unknown>;
type EntityResponseItem = JsonRecord;
type EntityResponsePayload = {
  item?: EntityResponseItem;
  items?: EntityResponseItem[];
  message?: string;
  detail?: string;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeErrorMessage(payload: unknown, fallback: string): string {
  if (isJsonRecord(payload)) {
    const message = payload.message;
    if (typeof message === "string" && message.trim()) return message;
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

async function parseResponse(response: Response): Promise<EntityResponsePayload> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload, `HTTP ${response.status}`));
  }
  return isJsonRecord(payload) ? payload : {};
}

async function createEntityInternal(locator: string, body: JsonRecord, opts?: { save?: boolean }): Promise<EntityResponseItem | undefined> {
  const normalized = locator.startsWith("/") ? locator : `/${locator}`;
  const response = await fetch(`${apiBase}/entities${normalized}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseResponse(response);
  if (opts?.save !== false) {
    await saveModel();
  }
  return payload?.item;
}

async function deleteEntityInternal(locator: string, opts?: { save?: boolean }): Promise<void> {
  const normalized = locator.startsWith("/") ? locator : `/${locator}`;
  const response = await fetch(`${apiBase}/entities${normalized}`, { method: "DELETE" });
  await parseResponse(response);
  if (opts?.save !== false) {
    await saveModel();
  }
}

export async function getEntities(locator = "/"): Promise<EntityResponseItem[]> {
  const normalized = locator.startsWith("/") ? locator : `/${locator}`;
  const response = await fetch(`${apiBase}/entities${normalized}`);
  const payload = await parseResponse(response);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function patchEntity(locator: string, patch: JsonRecord, opts?: { save?: boolean }): Promise<EntityResponseItem | undefined> {
  return patchEntityInternal(locator, patch, opts ?? { save: true });
}

async function patchEntityInternal(locator: string, patch: JsonRecord, opts?: { save?: boolean }): Promise<EntityResponseItem | undefined> {
  const normalized = locator.startsWith("/") ? locator : `/${locator}`;
  const response = await fetch(`${apiBase}/entities${normalized}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = await parseResponse(response);
  if (opts?.save !== false) {
    await saveModel();
  }
  return payload?.item;
}

export async function createEntity(locator: string, body: JsonRecord, opts?: { save?: boolean }): Promise<EntityResponseItem | undefined> {
  return createEntityInternal(locator, body, opts ?? { save: true });
}

export async function deleteEntity(locator: string, opts?: { save?: boolean }): Promise<void> {
  await deleteEntityInternal(locator, opts ?? { save: true });
}

export async function moveEntities(fromLocator: string, toLocator: string): Promise<EntityResponseItem[]> {
  const response = await fetch(`${apiBase}/entities/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromLocator, to: toLocator }),
  });
  const payload = await parseResponse(response);
  await saveModel();
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function renameEntity(
  fromLocator: string,
  toLocator: string,
  content: JsonRecord,
  opts?: { save?: boolean },
): Promise<EntityResponseItem | undefined> {
  const response = await fetch(`${apiBase}/entities/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromLocator, to: toLocator, content }),
  });
  const payload = await parseResponse(response);
  if (opts?.save !== false) {
    await saveModel();
  }
  return payload?.item;
}

export async function saveModel(locator?: string): Promise<void> {
  const response = await fetch(`${apiBase}/model/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(locator ? { locator } : {}),
  });
  await parseResponse(response);
}

export async function saveModelEntityByRelPath(relPath: string, content: JsonRecord): Promise<void> {
  const locator = modelLocatorFromRelPath(relPath);
  try {
    await patchEntity(locator, content);
  } catch {
    await createEntity(locator, content);
  }
}

export async function createModelEntityByRelPath(relPath: string, content: JsonRecord): Promise<void> {
  const locator = modelLocatorFromRelPath(relPath);
  await createEntity(locator, content);
}

export async function deleteModelEntityByRelPath(relPath: string): Promise<void> {
  const locator = modelLocatorFromRelPath(relPath);
  await deleteEntity(locator);
}

export function folderLocatorFromFolderRelPath(relPath: string, modelPath: string): string {
  const folderPath = folderPathFromRelPath(relPath, modelPath);
  return folderPath ? `/folders/${folderPath}` : "/folders";
}
