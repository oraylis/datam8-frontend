import type React from "react";
import { ToastAction, type ToastActionElement, useToast } from "@datam8/ui";
import { useCallback, useRef } from "react";

type UseSaveFailureToastParams = {
  contextKey: string;
  onRetry: () => void;
  retryLabel?: string;
};

type SaveFailureToastPayload = {
  title: string;
  description: string;
  variant: "destructive";
  action: ToastActionElement;
  onOpenChange: (open: boolean) => void;
};

type SaveFailureToastHandle = {
  id: string;
  dismiss: () => void;
  update: (props: SaveFailureToastPayload) => void;
};

export function useSaveFailureToast({ contextKey, onRetry, retryLabel = "Retry" }: UseSaveFailureToastParams) {
  const { toast } = useToast();
  const lastSignatureRef = useRef<string | null>(null);
  const toastHandleRef = useRef<SaveFailureToastHandle | null>(null);
  const dismissedSignatureRef = useRef<string | null>(null);

  const clearToastMemory = useCallback(() => {
    toastHandleRef.current = null;
  }, []);

  const buildRetryAction = useCallback(
    () => (
      <ToastAction
        altText="Retry save"
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          onRetry();
        }}
      >
        {retryLabel}
      </ToastAction>
    ),
    [onRetry, retryLabel],
  );

  const buildPayload = useCallback(
    (message: string): SaveFailureToastPayload => ({
      title: "Save failed",
      description: message,
      variant: "destructive",
      action: buildRetryAction(),
      onOpenChange: (open: boolean) => {
        if (!open) {
          dismissedSignatureRef.current = lastSignatureRef.current;
          clearToastMemory();
        }
      },
    }),
    [buildRetryAction, clearToastMemory],
  );

  const notifySaveFailure = useCallback(
    (error?: string | null) => {
      const message = typeof error === "string" && error.trim().length > 0 ? error.trim() : "Save failed.";
      const signature = `${contextKey}::${message}`;
      if (dismissedSignatureRef.current === signature) return;
      const payload = buildPayload(message);
      const existing = toastHandleRef.current;

      if (existing) {
        existing.update(payload);
      } else {
        toastHandleRef.current = toast(payload) as SaveFailureToastHandle;
      }

      lastSignatureRef.current = signature;
    },
    [buildPayload, contextKey, toast],
  );

  const resetSaveFailureToastMemory = useCallback(() => {
    dismissedSignatureRef.current = null;
  }, []);

  return {
    notifySaveFailure,
    resetSaveFailureToastMemory,
  };
}
