import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@datam8/ui/theme";
import "@datam8/ui/styles.css";
import "./index.css";
import { AppToaster } from "./toaster";

let didLogAuthShimInstalled = false;

function installAuthFetchShim() {
  const anyWindow = window as any;
  const desktop = anyWindow?.desktop;
  if (!desktop?.isElectron) return;

  const token = typeof desktop?.token === "string" ? desktop.token.trim() : "";
  const apiBase = typeof desktop?.apiBase === "string" ? desktop.apiBase.trim() : "";
  if (!token || !apiBase) return;

  const apiOrigin = new URL(apiBase).origin;

  if (!didLogAuthShimInstalled) {
    didLogAuthShimInstalled = true;
    console.info(`[DataM8] Desktop mode. Injecting Authorization header for backend requests to ${apiBase}.`);
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : req?.url;
    if (!urlStr) return originalFetch(input as any, init);

    const url = new URL(urlStr, window.location.origin);
    const isBackend = urlStr.startsWith(apiBase) || url.origin === apiOrigin;
    if (!isBackend) return originalFetch(input as any, init);

    const headers = new Headers(init?.headers || req?.headers);
    if (!headers.has("authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetch(input as any, { ...(init || {}), headers });
  }) as any;
}

installAuthFetchShim();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="datam8-ui-theme-v2">
      <App />
      <AppToaster />
    </ThemeProvider>
  </React.StrictMode>,
);
