import { useEffect, useMemo, useState } from "react";
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
} from "@datam8/ui";
import { FolderOpen } from "lucide-react";
import { ErrorSurfaceHost, useErrorSurface } from "../shared/ui/ErrorSurface";

type NewProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (solutionPath: string) => Promise<void> | void;
  defaultProjectRoot?: string;
};

export function NewProjectDialog({
  open,
  onClose,
  onCreated,
  defaultProjectRoot: _defaultProjectRoot,
}: NewProjectDialogProps) {
  const scope = "dialog:new-project";
  const isElectron = !!window.desktop?.isElectron;
  const [solutionName, setSolutionName] = useState("");
  const [savePath, setSavePath] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError, clearError } = useErrorSurface();

  const canCreate = useMemo(() => !!solutionName.trim() && !!savePath.trim(), [solutionName, savePath]);

  useEffect(() => {
    if (!open) return;
    setSolutionName("");
    setSavePath("");
    setError(null);
    clearError(scope);
  }, [clearError, open]);

  useEffect(() => {
    if (!open) return;
    if (error) {
      showError(scope, { title: "Create failed", description: error });
      return;
    }
    clearError(scope);
  }, [clearError, error, open, showError]);

  const validate = () => {
    const normalizedSolutionName = solutionName.trim();
    const normalizedSavePath = savePath.trim();

    if (!normalizedSolutionName) return "Solution Name is required.";
    if (!normalizedSavePath) return "Save Path is required.";
    if (normalizedSolutionName.includes("\0")) return "Solution Name contains invalid characters.";
    if (normalizedSavePath.includes("\0")) return "Save Path contains invalid characters.";
    return null;
  };

  const createNewSolution = async () => {
    setCreating(true);
    setError(null);
    try {
      const validationError = validate();
      if (validationError) throw new Error(validationError);

      if (!isElectron || !window.desktop?.solution?.createNew) {
        throw new Error("New Solution requires desktop bridge in v2 mode.");
      }

      const result = await window.desktop.solution.createNew({
        saveDir: savePath.trim(),
        solutionName: solutionName.trim(),
      });
      const solutionPath = `${(result as any)?.solutionPath || ""}`.trim();
      if (!solutionPath) throw new Error("Solution path not returned");
      return solutionPath;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async () => {
    const solutionPath = await createNewSolution();
    if (!solutionPath) return;
    await onCreated(solutionPath);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!creating && !next) onClose();
      }}
    >
      <DialogContent className="new-solution-wizard flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Choose a save directory and create a new solution with backend defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="new-project-solution-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Solution Name
            </Label>
            <Input
              id="new-project-solution-name"
              value={solutionName}
              onChange={(e) => setSolutionName(e.target.value)}
              placeholder="MySolution"
            />
            <p className="text-xs text-muted-foreground">
              Creates <code>{solutionName.trim() || "SolutionName"}.dm8s</code> inside <code>{solutionName.trim() || "SolutionName"}</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-project-save-path" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Save Path
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="new-project-save-path"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder={isElectron ? "C:\\Projects" : "/workspace/projects"}
              />
              {isElectron && window.desktop?.solution?.pickDirectory ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const selected = await window.desktop?.solution?.pickDirectory?.();
                    if (selected) setSavePath(selected);
                  }}
                  disabled={creating}
                  className="shrink-0"
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Creates <code>{savePath.trim() || "<save-path>"}/{solutionName.trim() || "SolutionName"}/{solutionName.trim() || "SolutionName"}.dm8s</code>.
            </p>
          </div>

        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="button" variant="default" onClick={handleCreate} disabled={creating || !canCreate}>
            {creating ? "Creating..." : "Create Solution"}
          </Button>
        </DialogFooter>
        <div className="error-surface-slot error-surface-slot--flush">
          <ErrorSurfaceHost scope={scope} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
