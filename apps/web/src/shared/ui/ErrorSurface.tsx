import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ErrorSurfaceScope = string;

type ErrorSurfacePayload = {
  title: string;
  description?: string | null;
  onRetry?: (() => void) | null;
  retryLabel?: string;
};

type InfoSurfacePayload = {
  title: string;
  description?: string | null;
};

type ErrorSurfaceEntry = {
  title: string;
  description: string;
  onRetry?: (() => void) | null;
  retryLabel: string;
};

type InfoSurfaceEntry = {
  title: string;
  description: string;
};

type ErrorSurfaceContextValue = {
  showError: (scope: ErrorSurfaceScope, payload: ErrorSurfacePayload) => void;
  clearError: (scope: ErrorSurfaceScope) => void;
  getError: (scope: ErrorSurfaceScope) => ErrorSurfaceEntry | null;
  showInfo: (scope: ErrorSurfaceScope, payload: InfoSurfacePayload) => void;
  clearInfo: (scope: ErrorSurfaceScope) => void;
  getInfo: (scope: ErrorSurfaceScope) => InfoSurfaceEntry | null;
};

const ErrorSurfaceContext = createContext<ErrorSurfaceContextValue | undefined>(undefined);

export function ErrorSurfaceProvider({ children }: { children: ReactNode }) {
  const [errorEntries, setErrorEntries] = useState<Record<string, ErrorSurfaceEntry>>({});
  const [infoEntries, setInfoEntries] = useState<Record<string, InfoSurfaceEntry>>({});

  const showError = useCallback((scope: ErrorSurfaceScope, payload: ErrorSurfacePayload) => {
    const title = `${payload.title || ""}`.trim() || "Operation failed";
    const description = `${payload.description || ""}`.trim();
    const retryLabel = `${payload.retryLabel || ""}`.trim() || "Retry";
    const onRetry = payload.onRetry || null;
    setErrorEntries((prev) => {
      const current = prev[scope];
      if (
        current &&
        current.title === title &&
        current.description === description &&
        current.retryLabel === retryLabel
      ) {
        return prev;
      }
      return {
        ...prev,
        [scope]: {
          title,
          description,
          onRetry,
          retryLabel,
        },
      };
    });
    setInfoEntries((prev) => {
      if (!prev[scope]) return prev;
      const next = { ...prev };
      delete next[scope];
      return next;
    });
  }, []);

  const showInfo = useCallback((scope: ErrorSurfaceScope, payload: InfoSurfacePayload) => {
    const title = `${payload.title || ""}`.trim() || "Information";
    const description = `${payload.description || ""}`.trim();
    setInfoEntries((prev) => ({
      ...prev,
      [scope]: {
        title,
        description,
      },
    }));
    setErrorEntries((prev) => {
      if (!prev[scope]) return prev;
      const next = { ...prev };
      delete next[scope];
      return next;
    });
  }, []);

  const clearError = useCallback((scope: ErrorSurfaceScope) => {
    setErrorEntries((prev) => {
      if (!prev[scope]) return prev;
      const next = { ...prev };
      delete next[scope];
      return next;
    });
  }, []);

  const clearInfo = useCallback((scope: ErrorSurfaceScope) => {
    setInfoEntries((prev) => {
      if (!prev[scope]) return prev;
      const next = { ...prev };
      delete next[scope];
      return next;
    });
  }, []);

  const getError = useCallback(
    (scope: ErrorSurfaceScope) => {
      return errorEntries[scope] || null;
    },
    [errorEntries],
  );

  const getInfo = useCallback(
    (scope: ErrorSurfaceScope) => {
      return infoEntries[scope] || null;
    },
    [infoEntries],
  );

  const value = useMemo<ErrorSurfaceContextValue>(
    () => ({
      showError,
      clearError,
      getError,
      showInfo,
      clearInfo,
      getInfo,
    }),
    [clearError, clearInfo, getError, getInfo, showError, showInfo],
  );

  return <ErrorSurfaceContext.Provider value={value}>{children}</ErrorSurfaceContext.Provider>;
}

export function useErrorSurface() {
  const ctx = useContext(ErrorSurfaceContext);
  if (!ctx) {
    throw new Error("useErrorSurface must be used within an ErrorSurfaceProvider");
  }
  return ctx;
}

export function ErrorSurfaceHost({ scope }: { scope: ErrorSurfaceScope }) {
  const { clearError, getError } = useErrorSurface();
  const entry = getError(scope);

  if (!entry) return null;

  return (
    <div className="error-surface" role="alert" aria-live="assertive">
      <div className="error-surface__head">
        <div className="error-surface__title">{entry.title}</div>
        <button
          type="button"
          className="error-surface__close"
          onClick={() => clearError(scope)}
          aria-label="Close error"
          title="Close"
        >
          x
        </button>
      </div>
      {entry.description ? <div className="error-surface__description">{entry.description}</div> : null}
      {entry.onRetry ? (
        <div className="error-surface__actions">
          <button
            type="button"
            className="error-surface__retry"
            onClick={() => entry.onRetry?.()}
          >
            {entry.retryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function InfoSurfaceHost({ scope }: { scope: ErrorSurfaceScope }) {
  const { clearInfo, getInfo } = useErrorSurface();
  const entry = getInfo(scope);

  if (!entry) return null;

  return (
    <div className="info-surface" role="status" aria-live="polite">
      <div className="error-surface__head">
        <div className="error-surface__title">{entry.title}</div>
        <button
          type="button"
          className="error-surface__close"
          onClick={() => clearInfo(scope)}
          aria-label="Close info"
          title="Close"
        >
          x
        </button>
      </div>
      {entry.description ? <div className="error-surface__description">{entry.description}</div> : null}
    </div>
  );
}
