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
import { SolutionSettingsFields, type SolutionSettingsValues } from "../features/solution/SolutionSettingsFields";

const defaultSettings: SolutionSettingsValues = {
  basePath: "base",
  modelPath: "model",
  pluginsPath: "plugins",
  diagramPath: "",
  generatorTargets: [{ name: "default", isDefault: true, sourcePath: "generate", outputPath: "output" }],
};

type NewSolutionDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (solutionPath: string) => Promise<void> | void;
};

export function NewSolutionDialog({
  open,
  onClose,
  onCreated,
}: NewSolutionDialogProps) {
  const scope = "dialog:new-solution";
  const isElectron = !!window.desktop?.isElectron;
  const [solutionName, setSolutionName] = useState("");
  const [savePath, setSavePath] = useState("");
  const [settings, setSettings] = useState<SolutionSettingsValues>(defaultSettings);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError, clearError } = useErrorSurface();

  const canCreate = useMemo(() => !!solutionName.trim() && !!savePath.trim(), [solutionName, savePath]);

  useEffect(() => {
    if (!open) return;
    setSolutionName("");
    setSavePath("");
    setSettings(defaultSettings);
    setError(null);
    clearError(scope);
  }, [clearError, open]);

  useEffect(() => {
    if (!open) return;
    if (error) {
      showError(scope, { title: "Solution creation failed", description: error });
      return;
    }
    clearError(scope);
  }, [clearError, error, open, showError]);

  const validate = () => {
    const normalizedSolutionName = solutionName.trim();
    const normalizedSavePath = savePath.trim();

    if (!normalizedSolutionName) return "Solution name is required.";
    if (!normalizedSavePath) return "Solution directory is required.";
    if ([".", ".."].includes(normalizedSolutionName) || /[\\/\0]/.test(normalizedSolutionName)) return "Solution name contains invalid characters.";
    if (normalizedSavePath.includes("\0")) return "Solution directory contains invalid characters.";
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
        settings: {
          ...settings,
          diagramPath: settings.diagramPath?.trim() || null,
        },
      });
      const solutionPath = `${(result as any)?.solutionPath || ""}`.trim();
      if (!solutionPath) throw new Error("Solution path not returned");
      return solutionPath;
    } catch (err) {
      console.error("[DataM8] Create new solution failed:", err);
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
      <DialogContent className="new-solution-wizard flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create New Solution</DialogTitle>
          <DialogDescription>
            Choose a directory and configure the initial solution paths and generator targets.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="new-solution-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Solution name
            </Label>
            <Input
              id="new-solution-name"
              value={solutionName}
              onChange={(e) => setSolutionName(e.target.value)}
              placeholder="MySolution"
            />
            <p className="text-xs text-muted-foreground">
              Creates <code>{solutionName.trim() || "SolutionName"}.dm8s</code> inside the selected save path.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-solution-save-path" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Solution directory
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="new-solution-save-path"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder={isElectron ? "C:\\Solutions" : "/workspace/solutions"}
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
              Creates <code>{savePath.trim() || "<save-path>"}/{solutionName.trim() || "SolutionName"}.dm8s</code>.
            </p>
          </div>
          <SolutionSettingsFields value={settings} onChange={setSettings} />
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
