import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@datam8/ui/theme";
import { toast } from "@datam8/ui";
import "@datam8/ui/styles.css";
import "./index.css";

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

// Global handlers: surface truly unhandled errors as toasts so nothing is silently dropped.
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "An unexpected error occurred";
  // Suppress AbortError — these are expected from cancelled fetch requests.
  if (message === "AbortError" || /aborted/i.test(message)) return;
  console.error("[DataM8] Unhandled rejection:", reason);
  toast({ variant: "destructive", title: "Unhandled error", description: message });
});

window.addEventListener("error", (event) => {
  if (!event.error) return;
  const message = event.error instanceof Error ? event.error.message : String(event.error);
  console.error("[DataM8] Runtime error:", event.error);
  toast({ variant: "destructive", title: "Runtime error", description: message });
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="datam8-ui-theme-v2">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
