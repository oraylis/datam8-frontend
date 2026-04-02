import { apiBase } from "../../config";
import { readBackendErrorMessage } from "../api/errorMessage";

type FunctionSourcePayload = {
  relPath: string;
  source: string;
  entityName?: string;
  solutionPath?: string;
};

function hasDesktopBridge() {
  return !!window.desktop?.isElectron && !!window.desktop?.solution;
}

export async function readFunctionSource(payload: FunctionSourcePayload): Promise<string> {
  if (hasDesktopBridge() && window.desktop?.solution?.readFunctionSource) {
    const result = await window.desktop.solution.readFunctionSource(payload);
    return typeof result?.content === "string" ? result.content : "";
  }

  const response = await fetch(
    `${apiBase}/model/function/source?relPath=${encodeURIComponent(payload.relPath)}&source=${encodeURIComponent(payload.source)}&entityName=${encodeURIComponent(payload.entityName || "")}${
      payload.solutionPath ? `&solutionPath=${encodeURIComponent(payload.solutionPath)}` : ""
    }`,
  );
  if (!response.ok) return "";
  const json = await response.json().catch(() => ({}));
  return typeof json?.content === "string" ? json.content : "";
}

export async function saveFunctionSource(payload: FunctionSourcePayload & { content: string }): Promise<void> {
  if (hasDesktopBridge() && window.desktop?.solution?.saveFunctionSource) {
    await window.desktop.solution.saveFunctionSource(payload);
    return;
  }

  const response = await fetch(`${apiBase}/model/function/source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(readBackendErrorMessage(body, "Failed to save transformation source."));
  }
}

export async function renameFunctionSource(payload: {
  relPath: string;
  fromSource: string;
  toSource: string;
  entityName?: string;
  solutionPath?: string;
}): Promise<void> {
  if (hasDesktopBridge() && window.desktop?.solution?.renameFunctionSource) {
    await window.desktop.solution.renameFunctionSource(payload);
    return;
  }

  const response = await fetch(`${apiBase}/model/function/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(readBackendErrorMessage(body, "Failed to rename function source."));
  }
}

export async function deleteFunctionSource(payload: FunctionSourcePayload): Promise<void> {
  if (hasDesktopBridge() && window.desktop?.solution?.deleteFunctionSource) {
    await window.desktop.solution.deleteFunctionSource(payload);
    return;
  }

  const params = new URLSearchParams({
    path: payload.relPath,
    source: payload.source,
  });
  if (payload.solutionPath) params.set("solutionPath", payload.solutionPath);

  const response = await fetch(`${apiBase}/script/delete?${params.toString()}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = readBackendErrorMessage(body, "");
    const isMissingScript = response.status === 404 && /script not found/i.test(String(message));
    if (!isMissingScript) {
      throw new Error(readBackendErrorMessage(body, `Failed to delete function source (${response.status}).`));
    }
  }
}
