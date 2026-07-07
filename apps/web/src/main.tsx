import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@datam8/ui/theme";
import "@datam8/ui/styles.css";
import "./index.css";
import { publishAppError } from "./shared/ui/appErrorBridge";

let didLogAuthShimInstalled = false;

type DesktopRuntime = {
  isElectron?: boolean;
  token?: string;
  apiBase?: string;
};

function installAuthFetchShim() {
  const desktop = (window as Window & { desktop?: DesktopRuntime }).desktop;
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
    if (!urlStr) return originalFetch(input, init);

    const url = new URL(urlStr, window.location.origin);
    const isBackend = urlStr.startsWith(apiBase) || url.origin === apiOrigin;
    if (!isBackend) return originalFetch(input, init);

    const headers = new Headers(init?.headers || req?.headers);
    if (!headers.has("authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetch(input, { ...(init || {}), headers });
  }) satisfies typeof window.fetch;
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
  publishAppError("Unhandled error", message);
});

window.addEventListener("error", (event) => {
  if (!event.error) return;
  const message = event.error instanceof Error ? event.error.message : String(event.error);
  console.error("[DataM8] Runtime error:", event.error);
  publishAppError("Runtime error", message);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="datam8-ui-theme-v2">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
