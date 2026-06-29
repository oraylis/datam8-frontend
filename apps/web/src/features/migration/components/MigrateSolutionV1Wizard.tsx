import { useCallback, useEffect, useMemo, useState } from "react";
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
import { FolderOpen, Loader2, MoveRight } from "lucide-react";
import { useSolution } from "../../solution/SolutionContext";
import type { BaseEntity, FolderEntity, ModelEntity } from "../../model/model-types";
import { ErrorSurfaceHost, useErrorSurface } from "../../../shared/ui/ErrorSurface";

type MigrationResponse = {
  solutionPath: string;
};

type Props = {
  open: boolean;
  sourceSolutionPath: string;
  onLoaded: (modelEntities: ModelEntity[], baseEntities: BaseEntity[], folderEntities: FolderEntity[]) => void;
};

type Step = 1 | 2 | 3 | 4;

export function MigrateSolutionV1Wizard({ open, sourceSolutionPath, onLoaded }: Props) {
  const scope = "dialog:migrate-v1";
  const { closeMigration, setPickerOpen, loadSolution } = useSolution();
  const [step, setStep] = useState<Step>(1);
  const [targetDir, setTargetDir] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MigrationResponse | null>(null);
  const { showError, clearError } = useErrorSurface();

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTargetDir("");
    setRunning(false);
    setError(null);
    setResult(null);
    clearError(scope);
  }, [clearError, open, sourceSolutionPath]);

  useEffect(() => {
    if (!open) return;
    if (error) {
      showError(scope, { title: "Migration failed", description: error });
      return;
    }
    clearError(scope);
  }, [clearError, error, open, showError]);

  const canClose = !running;

  const close = useCallback(() => {
    if (!canClose) return;
    closeMigration();
  }, [canClose, closeMigration]);

  const cancelAndReopenPicker = useCallback(() => {
    if (!canClose) return;
    closeMigration();
    setPickerOpen(true);
  }, [canClose, closeMigration, setPickerOpen]);

  const handleBrowseTargetDir = useCallback(async () => {
    setError(null);
    const pick = window.desktop?.solution?.pickDirectory;
    if (!pick) {
      setError("Directory picker is only available in the Desktop app.");
      return;
    }
    const dir = await pick();
    if (dir) setTargetDir(dir);
  }, []);

  const runMigration = useCallback(async () => {
    setError(null);
    if (!sourceSolutionPath) {
      setError("Missing source solution path.");
      return;
    }
    if (!targetDir.trim()) {
      setError("Select a target folder.");
      return;
    }
    if (!window.desktop?.solution?.migrateV1ToV2) {
      setError("Migration requires desktop bridge support.");
      return;
    }
    const normalizedSource = sourceSolutionPath.trim().toLowerCase();
    const normalizedTarget = targetDir.trim().toLowerCase();
    if (!normalizedSource.endsWith(".dm8s")) {
      setError("Source must be a .dm8s file.");
      return;
    }
    if (normalizedSource.startsWith(normalizedTarget)) {
      setError("Target directory must not contain the source solution directory.");
      return;
    }

    setRunning(true);
    setStep(3);
    try {
      const data = (await window.desktop.solution.migrateV1ToV2({
        sourceSolutionPath,
        targetDir: targetDir.trim(),
      })) as MigrationResponse | null;
      if (!data?.solutionPath) throw new Error("Invalid migration response");
      setResult(data);
      setStep(4);
    } catch (e) {
      console.error("[DataM8] Solution migration failed:", e);
      setError((e as Error).message);
      setStep(2);
    } finally {
      setRunning(false);
    }
  }, [sourceSolutionPath, targetDir]);

  const openMigratedSolution = useCallback(async () => {
    if (!result?.solutionPath) return;
    const source = window.desktop?.isElectron
      ? ({ kind: "electron-path", path: result.solutionPath } as const)
      : ({ kind: "server-path", path: result.solutionPath } as const);
    const loaded = await loadSolution(source);
    if (loaded) {
      onLoaded(loaded.modelEntities, loaded.baseEntities, loaded.folderEntities);
      close();
    }
  }, [close, loadSolution, onLoaded, result?.solutionPath]);

  const summary = useMemo(() => {
    if (!result) return null;
    return [
      { label: "Status", value: "Completed" },
    ];
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Migrate V1 Solution -&gt; V2</DialogTitle>
          <DialogDescription>
            This solution looks like a V1 project. DataM8 will migrate it to V2 so it can be opened.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="codex-popup-section flex items-center justify-between px-4 py-3">
            <div className="text-sm">
              <div className="font-semibold">Step {step} of 4</div>
              <div className="text-muted-foreground">
                {step === 1
                  ? "Confirm source"
                  : step === 2
                    ? "Select target folder"
                    : step === 3
                      ? "Migrating..."
                      : "Results"}
              </div>
            </div>
            {running ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Working...
              </div>
            ) : null}
          </div>

          {step === 1 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Source .dm8s
                </Label>
                <Input value={sourceSolutionPath} readOnly />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Target folder
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Absolute path to a folder"
                    value={targetDir}
                    onChange={(e) => setTargetDir(e.target.value)}
                    disabled={running}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBrowseTargetDir}
                    disabled={running || !window.desktop?.solution?.pickDirectory}
                    className="sm:w-[170px]"
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Browse Folder...
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="codex-popup-section flex items-center justify-center px-4 py-10">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Running migration...
              </div>
            </div>
          ) : null}

          {step === 4 && result ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Migrated solution
                </Label>
                <Input value={result.solutionPath} readOnly />
              </div>

              {summary ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {summary.map((s) => (
                    <div key={s.label} className="codex-popup-section px-3 py-2">
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className="text-sm font-semibold">{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="codex-popup-section p-3 text-sm text-muted-foreground">
                Migration was executed by the CLI (`datam8 migrate v1-to-v2`) and the migrated solution is now loaded.
              </div>
            </div>
          ) : null}

        </div>

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button type="button" variant="ghost" onClick={cancelAndReopenPicker} disabled={running}>
                Cancel
              </Button>
              <Button type="button" variant="default" onClick={() => setStep(2)} disabled={!sourceSolutionPath}>
                Continue
              </Button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={running}>
                Back
              </Button>
              <Button type="button" variant="ghost" onClick={cancelAndReopenPicker} disabled={running}>
                Cancel
              </Button>
              <Button type="button" variant="default" onClick={runMigration} disabled={running || !targetDir.trim()}>
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  <>
                    Run migration
                    <MoveRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          ) : null}

          {step === 3 ? (
            <Button type="button" variant="ghost" disabled>
              Migration running...
            </Button>
          ) : null}

          {step === 4 ? (
            <>
              <Button type="button" variant="ghost" onClick={cancelAndReopenPicker} disabled={running}>
                Close
              </Button>
              <Button type="button" variant="default" onClick={openMigratedSolution} disabled={!result?.solutionPath}>
                Open migrated solution
              </Button>
            </>
          ) : null}
        </DialogFooter>
        <div className="error-surface-slot error-surface-slot--flush">
          <ErrorSurfaceHost scope={scope} />
        </div>
      </DialogContent>
    </Dialog>
  );
}


