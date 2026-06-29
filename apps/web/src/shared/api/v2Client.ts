import { apiBase } from "../../config";
import { folderPathFromRelPath, modelLocatorFromRelPath } from "../../features/model/locator-utils";

type JsonRecord = Record<string, unknown>;

function friendlyHttpError(status: number): string {
  if (status === 400) return "The request was invalid. Please check your input and try again.";
  if (status === 401 || status === 403) return "Access denied. Check your authentication settings.";
  if (status === 404) return "The requested resource was not found. Try reloading the solution.";
  if (status === 409) return "A conflict occurred — the item may have been modified elsewhere.";
  if (status === 422) return "The data could not be processed. Please check for validation errors.";
  if (status >= 500) return "The backend encountered an internal error. Please try again.";
  return "The request failed unexpectedly. Please try again.";
}

function normalizeErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const message = (payload as any).message;
    if (typeof message === "string" && message.trim()) return message;
    const detail = (payload as any).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

async function parseResponse(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload, friendlyHttpError(response.status)));
  }
  return payload;
}

async function createEntityInternal(locator: string, body: JsonRecord, opts?: { save?: boolean }): Promise<any> {
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

export async function getEntities(locator = "/"): Promise<any[]> {
  const normalized = locator.startsWith("/") ? locator : `/${locator}`;
  const response = await fetch(`${apiBase}/entities${normalized}`);
  const payload = await parseResponse(response);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function patchEntity(locator: string, patch: JsonRecord, opts?: { save?: boolean }): Promise<any> {
  return patchEntityInternal(locator, patch, opts ?? { save: true });
}

async function patchEntityInternal(locator: string, patch: JsonRecord, opts?: { save?: boolean }): Promise<any> {
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

export async function createEntity(locator: string, body: JsonRecord, opts?: { save?: boolean }): Promise<any> {
  return createEntityInternal(locator, body, opts ?? { save: true });
}

export async function deleteEntity(locator: string, opts?: { save?: boolean }): Promise<void> {
  await deleteEntityInternal(locator, opts ?? { save: true });
}

export async function moveEntities(fromLocator: string, toLocator: string): Promise<any[]> {
  const response = await fetch(`${apiBase}/entities/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromLocator, to: toLocator }),
  });
  const payload = await parseResponse(response);
  await saveModel();
  return Array.isArray(payload?.items) ? payload.items : [];
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
