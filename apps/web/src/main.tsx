import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@datam8/ui/theme";
import "@datam8/ui/styles.css";
import "./index.css";

let didLogAuthShimInstalled = false;

type DesktopRuntime = {
  isElectron?: boolean;
  token?: string;
  apiBase?: string;
  getBackendRuntime?: () => { apiBase?: string | null; token?: string | null } | null | undefined;
};

function installAuthFetchShim() {
  const desktop = (window as Window & { desktop?: DesktopRuntime }).desktop;
  if (!desktop?.isElectron) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const runtime = desktop.getBackendRuntime?.() ?? desktop;
    const token = typeof runtime?.token === "string" ? runtime.token.trim() : "";
    const apiBase = typeof runtime?.apiBase === "string" ? runtime.apiBase.trim().replace(/\/+$/, "") : "";
    if (!token || !apiBase) return originalFetch(input, init);

    const req = input instanceof Request ? input : null;
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : req?.url;
    if (!urlStr) return originalFetch(input, init);

    const url = new URL(urlStr, window.location.origin);
    const apiOrigin = new URL(apiBase).origin;
    const isBackend = urlStr.startsWith(apiBase) || url.origin === apiOrigin;
    if (!isBackend) return originalFetch(input, init);

    if (!didLogAuthShimInstalled) {
      didLogAuthShimInstalled = true;
      console.info(`[DataM8] Desktop mode. Injecting Authorization header for backend requests to ${apiBase}.`);
    }

    const headers = new Headers(init?.headers || req?.headers);
    if (!headers.has("authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetch(input, { ...(init || {}), headers });
  }) satisfies typeof window.fetch;
}

installAuthFetchShim();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="datam8-ui-theme-v2">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
