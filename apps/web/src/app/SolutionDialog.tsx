import { useCallback, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  cn,
} from "@datam8/ui";
import { FolderOpen, Loader2 } from "lucide-react";
import { useSolution } from "../features/solution/SolutionContext";
import type { BaseEntity, FolderEntity, ModelEntity } from "../features/model/model-types";

type SolutionDialogProps = {
  open: boolean;
  onLoaded: (modelEntities: ModelEntity[], baseEntities: BaseEntity[], folderEntities: FolderEntity[]) => void;
};

export function SolutionDialog({ open, onLoaded }: SolutionDialogProps) {
  const {
    pickerInput,
    setPickerInput,
    pickerError,
    setPickerError,
    setPickerOpen,
    loading,
    loadSolution,
  } = useSolution();

  // Handle open-file event from main process
  useEffect(() => {
    if (window.desktop?.solution?.onOpenPath) {
      const unsubscribe = window.desktop.solution.onOpenPath(async (filePath) => {
        if (!filePath || !filePath.toLowerCase().endsWith(".dm8s")) return;
        setPickerInput(filePath); // Update picker input with the opened file
        const result = await loadSolution({ kind: "electron-path", path: filePath });
        if (result) {
          onLoaded(result.modelEntities, result.baseEntities, result.folderEntities);
        }
        setPickerOpen(false); // Close dialog after loading
      });
      return () => unsubscribe();
    }
  }, [loadSolution, onLoaded, setPickerInput, setPickerOpen]);

  const handleLoad = useCallback(async () => {
    // If Electron and native picker was used, 'pickerInput' might already be valid
    // Otherwise, assume 'server-path'
    if (window.desktop?.isElectron && window.desktop.solution?.pickOpenPath) {
      const path = await window.desktop.solution.pickOpenPath();
      if (path) {
        setPickerInput(path); // Update input field
        const result = await loadSolution({ kind: "electron-path", path });
        if (result) {
          onLoaded(result.modelEntities, result.baseEntities, result.folderEntities);
        }
        setPickerOpen(false); // Close dialog after loading
      }
    } else {
      // Existing web flow
      const result = await loadSolution({ kind: "server-path", path: pickerInput });
      if (result) {
        onLoaded(result.modelEntities, result.baseEntities, result.folderEntities);
      }
    }
  }, [loadSolution, onLoaded, pickerInput, setPickerInput, setPickerOpen]);

  return (
    <Dialog open={open} onOpenChange={(next) => setPickerOpen(next)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select solution (.dm8s)</DialogTitle>
          <DialogDescription>
            {window.desktop?.isElectron ? "Use the native file picker." : "The v2 backend manages one bound solution at startup."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {window.desktop?.isElectron && window.desktop.solution?.pickOpenPath && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={handleLoad} disabled={loading}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Solution...
              </Button>
            </div>
          )}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Path</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Absolute path to .dm8s"
                value={pickerInput}
                onChange={(e) => setPickerInput(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          {pickerError ? (
            <div className={cn("codex-popup-error")}>
              Load failed: {pickerError}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)} disabled={loading}>
            Cancel
          </Button>
          {!window.desktop?.isElectron && (
            <Button type="button" variant="default" onClick={handleLoad} disabled={!pickerInput || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
