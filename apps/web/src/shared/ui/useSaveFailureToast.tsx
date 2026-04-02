import { useCallback, useRef } from "react";
import { useErrorSurface } from "./ErrorSurface";

type UseSaveFailureToastParams = {
  contextKey: string;
  onRetry: () => void;
  retryLabel?: string;
};

export function useSaveFailureToast({ contextKey, onRetry, retryLabel = "Retry" }: UseSaveFailureToastParams) {
  const { showError, clearError } = useErrorSurface();
  const dismissedSignatureRef = useRef<string | null>(null);

  const notifySaveFailure = useCallback(
    (error?: string | null) => {
      const message = typeof error === "string" && error.trim().length > 0 ? error.trim() : "Save failed.";
      const signature = `${contextKey}::${message}`;
      if (dismissedSignatureRef.current === signature) return;
      showError("app", {
        title: "Save failed",
        description: message,
        onRetry,
        retryLabel,
      });
    },
    [contextKey, onRetry, retryLabel, showError],
  );

  const resetSaveFailureToastMemory = useCallback(() => {
    dismissedSignatureRef.current = null;
    clearError("app");
  }, [clearError]);

  return {
    notifySaveFailure,
    resetSaveFailureToastMemory,
  };
}
