export type AppMode = "browser" | "databricks" | "electron";
export type RuntimeAppMode = AppMode | "server";

function isElectronRuntime(): boolean {
  try {
    return (window as any)?.desktop?.isElectron === true;
  } catch {
    return false;
  }
}

const envMode =
  (import.meta.env.VITE_APP_MODE as RuntimeAppMode | undefined) ||
  (import.meta.env.VITE_DATAM8_MODE as RuntimeAppMode | undefined) ||
  ("server" as RuntimeAppMode);

function resolveDesktopApiBase(): string | null {
  try {
    const anyWindow = window as any;
    if (anyWindow?.desktop?.isElectron !== true) return null;
    const base = anyWindow?.desktop?.apiBase;
    return typeof base === "string" && base.trim() ? base : null;
  } catch {
    return null;
  }
}

const desktopApiBase = resolveDesktopApiBase();
const envApiBase = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim();

const defaultApiBase = isElectronRuntime()
  ? (desktopApiBase ?? "")
  : (import.meta.env.DEV ? "" : envApiBase);

export const apiBase = defaultApiBase;

const runtimeConfig: { mode: RuntimeAppMode } = {
  mode: isElectronRuntime() ? "electron" : envMode,
};

export const config = runtimeConfig;

export async function syncConfigFromServer(): Promise<typeof runtimeConfig> {
  try {
    const res = await fetch(`${apiBase}/config`);
    if (res.ok) {
      const data = await res.json();
      if (data?.mode === "browser" || data?.mode === "databricks" || data?.mode === "electron") {
        runtimeConfig.mode = data.mode;
      } else if (typeof data?.mode === "string") {
        runtimeConfig.mode = "server";
      }
    }
  } catch {
    // Ignore network errors and keep the current mode
  }
  return runtimeConfig;
}

export function isBrowserLike(mode: RuntimeAppMode = runtimeConfig.mode) {
  return mode === "browser" || mode === "databricks";
}

export function isElectronMode(mode: RuntimeAppMode = runtimeConfig.mode) {
  return mode === "electron";
}

export function shouldUseServerDialog(mode: RuntimeAppMode = runtimeConfig.mode) {
  return !isBrowserLike(mode) && !isElectronMode(mode);
}

