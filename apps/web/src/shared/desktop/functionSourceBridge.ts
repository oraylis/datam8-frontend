import { apiBase } from "../../config";
import { readBackendErrorMessage } from "../api/errorMessage";

type FunctionSourcePayload = {
  relPath: string;
  source: string;
  modelEntityId?: number | string;
  stepNo?: number | string;
  name?: string;
  entityName?: string;
  solutionPath?: string;
};

function hasDesktopBridge() {
  return !!window.desktop?.isElectron && !!window.desktop?.solution;
}

function functionRefPath(payload: Pick<FunctionSourcePayload, "modelEntityId" | "stepNo" | "name">): string | null {
  const modelEntityId = `${payload.modelEntityId ?? ""}`.trim();
  if (!modelEntityId) return null;
  const stepOrName = `${payload.stepNo ?? payload.name ?? ""}`.trim();
  if (!stepOrName) return null;
  return `/functions/${encodeURIComponent(modelEntityId)}/${encodeURIComponent(stepOrName)}`;
}

async function requestFunctionApi(
  path: string,
  init?: {
    method?: "GET" | "POST";
    body?: unknown;
    legacySource?: { relPath: string; source: string; content: string; entityName?: string; solutionPath?: string };
  },
): Promise<any> {
  const desktop = typeof window !== "undefined" ? window.desktop : undefined;
  const desktopRequest = desktop?.isElectron ? desktop.solution?.requestFunctionApi : undefined;
  if (desktopRequest) {
    return await desktopRequest({ path, method: init?.method, body: init?.body, legacySource: init?.legacySource });
  }
  const response = await fetch(`${apiBase}${path}`, {
    method: init?.method,
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(readBackendErrorMessage(body, `Function API request failed (${response.status})`));
  return body;
}

export async function readFunctionSource(payload: FunctionSourcePayload): Promise<string> {
  const apiPath = functionRefPath(payload);
  if (apiPath) {
    const json = await requestFunctionApi(apiPath);
    const item = (json as { item?: Record<string, unknown> }).item;
    if (typeof item?.sourceCode === "string") return item.sourceCode;
    if (typeof item?.source_code === "string") return item.source_code;
    return "";
  }

  if (hasDesktopBridge() && window.desktop?.solution?.readFunctionSource) {
    const result = await window.desktop.solution.readFunctionSource(payload);
    return typeof result?.content === "string" ? result.content : "";
  }

  return "";
}

export async function createFunctionSource(payload: FunctionSourcePayload): Promise<void> {
  if (hasDesktopBridge() && window.desktop?.solution?.saveFunctionSource) {
    await window.desktop.solution.saveFunctionSource({ ...payload, content: "" });
    return;
  }

  throw new Error("Function create currently requires the Electron file bridge.");
}

export async function saveFunctionSource(payload: FunctionSourcePayload & { content: string }): Promise<void> {
  const apiPath = functionRefPath(payload);
  if (apiPath) {
    await requestFunctionApi(apiPath, {
      method: "POST",
      body: { sourceCode: payload.content },
      legacySource: {
        relPath: payload.relPath,
        source: payload.source,
        content: payload.content,
        entityName: payload.entityName,
        solutionPath: payload.solutionPath,
      },
    });
    return;
  }

  if (hasDesktopBridge() && window.desktop?.solution?.saveFunctionSource) {
    await window.desktop.solution.saveFunctionSource(payload);
    return;
  }

  throw new Error("Function update requires the Generator Function API. Function create is an API gap in browser mode.");
}

export async function renameFunctionSource(payload: {
  relPath: string;
  fromSource: string;
  toSource: string;
  modelEntityId?: number | string;
  stepNo?: number | string;
  name?: string;
  entityName?: string;
  solutionPath?: string;
}): Promise<void> {
  const apiPath = functionRefPath(payload);
  if (apiPath) {
    await requestFunctionApi(`${apiPath}/move`, { method: "POST", body: { newPath: payload.toSource, force: true } });
    return;
  }

  if (hasDesktopBridge() && window.desktop?.solution?.renameFunctionSource) {
    await window.desktop.solution.renameFunctionSource(payload);
    return;
  }

  throw new Error("Function move requires the Generator Function API.");
}

export async function deleteFunctionSource(payload: FunctionSourcePayload): Promise<void> {
  if (hasDesktopBridge() && window.desktop?.solution?.deleteFunctionSource) {
    await window.desktop.solution.deleteFunctionSource(payload);
    return;
  }

  throw new Error("Function delete currently requires the Electron file bridge.");
}
