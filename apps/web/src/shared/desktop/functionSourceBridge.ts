import { requestBackendApi } from "../api/backendClient";

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

export async function readFunctionSource(payload: FunctionSourcePayload): Promise<string> {
  const apiPath = functionRefPath(payload);
  if (apiPath) {
    const json = await requestBackendApi<{ item?: Record<string, unknown> }>(apiPath);
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
  const modelEntityId = `${payload.modelEntityId ?? ""}`.trim();
  const stepNo = Number(payload.stepNo);
  if (!modelEntityId || !Number.isInteger(stepNo) || stepNo < 1) {
    throw new Error("Function create requires a model entity ID and transformation step.");
  }
  if (!payload.name?.trim()) throw new Error("Function create requires a transformation name.");
  await requestBackendApi(`/functions/${encodeURIComponent(modelEntityId)}`, {
    method: "POST",
    body: {
      stepNo,
      name: payload.name,
      source: payload.source,
      sourceCode: "",
    },
  });
}

export async function saveFunctionSource(payload: FunctionSourcePayload & { content: string }): Promise<void> {
  const apiPath = functionRefPath(payload);
  if (apiPath) {
    await requestBackendApi(apiPath, { method: "POST", body: { sourceCode: payload.content } });
    return;
  }
  throw new Error("Function update requires a model entity ID and transformation step.");
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
    await requestBackendApi(`${apiPath}/move`, { method: "POST", body: { newPath: payload.toSource, force: true } });
    return;
  }
  throw new Error("Function move requires the Generator Function API.");
}

export async function deleteFunctionSource(payload: FunctionSourcePayload): Promise<void> {
  const apiPath = functionRefPath(payload);
  if (!apiPath) throw new Error("Function delete requires a model entity ID and transformation step.");
  await requestBackendApi(apiPath, { method: "DELETE" });
}
