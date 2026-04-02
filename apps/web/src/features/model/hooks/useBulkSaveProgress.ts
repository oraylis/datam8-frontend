import { useCallback, useRef } from "react";
import { useErrorSurface } from "../../../shared/ui/ErrorSurface";

type SaveKind = "entity" | "base";

type ToastHandle = {
  id: string;
  update: (props: { title: string; description?: string; variant?: "default" | "destructive" | "success" | null }) => void;
  dismiss: () => void;
};

type ToastInvoker = (props: {
  title: string;
  description?: string;
  duration?: number;
  variant?: "default" | "destructive" | "success" | null;
}) => ToastHandle;

type BulkSaveState = {
  active: boolean;
  total: number;
  completed: number;
  successes: number;
  failures: { relPath: string; kind: SaveKind; message?: string }[];
  toast?: ToastHandle;
};

export function useBulkSaveProgress(toast: ToastInvoker) {
  const { showError } = useErrorSurface();
  const bulkSaveRef = useRef<BulkSaveState>({
    active: false,
    total: 0,
    completed: 0,
    successes: 0,
    failures: [],
  });

  const finishBulkSave = useCallback((bulk: BulkSaveState) => {
    if (bulk.failures.length > 0) {
      const summaryTitle = `Saved ${bulk.total} files (${bulk.successes} ok, ${bulk.failures.length} failed)`;
      const summaryDescription = bulk.failures
        .map((f) => `${f.kind === "base" ? "Base" : "Entity"}: ${f.relPath}${f.message ? ` - ${f.message}` : ""}`)
        .join("\n");
      showError("app", {
        title: summaryTitle,
        description: summaryDescription,
      });
    }
    bulkSaveRef.current = { active: false, total: 0, completed: 0, successes: 0, failures: [] };
  }, [showError]);

  const startBulkSave = useCallback(
    (total: number) => {
      if (total <= 0) return;
      bulkSaveRef.current = { active: true, total, completed: 0, successes: 0, failures: [] };
    },
    [],
  );

  const recordBulkResult = useCallback(
    (relPath: string, kind: SaveKind, ok: boolean, message?: string) => {
      const bulk = bulkSaveRef.current;
      if (!bulk.active) return false;
      bulk.completed += 1;
      if (ok) bulk.successes += 1;
      else bulk.failures.push({ relPath, kind, message });
      if (bulk.completed >= bulk.total) {
        finishBulkSave(bulk);
      }
      return true;
    },
    [finishBulkSave],
  );

  const finalizeBulkSave = useCallback(() => {
    const bulk = bulkSaveRef.current;
    if (!bulk.active) return;
    if (bulk.completed < bulk.total) {
      const remaining = bulk.total - bulk.completed;
      for (let i = 0; i < remaining; i += 1) {
        bulk.failures.push({ relPath: "unsaved", kind: "base", message: "Not saved" });
      }
      bulk.completed = bulk.total;
    }
    finishBulkSave(bulk);
  }, [finishBulkSave]);

  return {
    startBulkSave,
    recordBulkResult,
    finalizeBulkSave,
  };
}


