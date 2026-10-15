import { useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@datam8/ui";
import { FolderHierarchyPicker, type FolderHierarchyItem } from "./wizard/FolderHierarchyPicker";
import { ErrorSurfaceHost, useErrorSurface } from "../../../shared/ui/ErrorSurface";

export type MoveEntitiesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  initialFolderPath?: string;
  folderHierarchyItems: FolderHierarchyItem[];
  onConfirm: (folderPath: string) => void;
};

export function MoveEntitiesDialog({
  open,
  onOpenChange,
  count,
  initialFolderPath,
  folderHierarchyItems,
  onConfirm,
}: MoveEntitiesDialogProps) {
  const scope = "dialog:move-entities";
  const safeCount = Math.max(1, count);
  const selectId = useId();
  const pickerId = useMemo(() => `${selectId}-picker`, [selectId]);

  const [folderPath, setFolderPath] = useState(initialFolderPath || "");
  const [error, setError] = useState<string | null>(null);
  const { showError, clearError } = useErrorSurface();

  useEffect(() => {
    if (!open) return;
    setFolderPath((initialFolderPath || "").trim());
    setError(null);
    clearError(scope);
  }, [clearError, initialFolderPath, open]);

  useEffect(() => {
    if (!open) return;
    if (error) {
      showError(scope, { title: "Move failed", description: error });
      return;
    }
    clearError(scope);
  }, [clearError, error, open, showError]);

  const submit = () => {
    const normalized = (folderPath || "").trim().replace(/^\/+|\/+$/g, "");
    if (!normalized) {
      setError("Folder path is required.");
      return;
    }
    setError(null);
    onConfirm(normalized);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="move-entities-dialog max-w-lg">
        <DialogHeader>
          <DialogTitle>Move {safeCount === 1 ? "entity" : "entities"}</DialogTitle>
          <DialogDescription>Select the target folder under Model.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={pickerId}>Target Folder *</Label>
            <div id={pickerId}>
              <FolderHierarchyPicker
                value={folderPath || ""}
                onChange={setFolderPath}
                folderItems={folderHierarchyItems}
                panelClassName="move-entities-dialog__target-folder-surface"
                scrollClassName="move-entities-dialog__target-folder-scroll"
              />
            </div>
          </div>
          {folderHierarchyItems.length === 0 ? (
            <div className="muted small">No folders available.</div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Move</Button>
        </DialogFooter>
        <div className="error-surface-slot error-surface-slot--flush">
          <ErrorSurfaceHost scope={scope} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
