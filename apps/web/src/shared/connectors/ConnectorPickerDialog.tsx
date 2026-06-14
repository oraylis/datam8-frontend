import React, { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, cn } from "@datam8/ui";
import { refresh, useConnectorCatalog, type ConnectorSummary } from "./connectorCatalog";
import { useSolution } from "../../features/solution/SolutionContext";
import { ErrorSurfaceHost, useErrorSurface } from "../ui/ErrorSurface";

export function ConnectorPickerDialog(props: {
  open: boolean;
  onClose: () => void;
  onSelect: (connector: ConnectorSummary) => void;
  selectedConnectorId?: string | null;
}) {
  const scope = "dialog:connector-picker";
  const { open, onClose, onSelect, selectedConnectorId } = props;
  const { solutionPath, solution } = useSolution();
  const status = useConnectorCatalog((s) => s.status);
  const connectors = useConnectorCatalog((s) => s.connectors);
  const error = useConnectorCatalog((s) => s.error);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showError, clearError } = useErrorSurface();

  useEffect(() => {
    if (!open) return;
    void refresh();
    clearError(scope);
  }, [clearError, open]);

  useEffect(() => {
    if (!open) return;
    const nextError = pluginsError || (status === "error" ? error || "Failed to load connectors" : null);
    if (nextError) {
      showError(scope, { title: "Connector load failed", description: nextError });
      return;
    }
    clearError(scope);
  }, [clearError, error, open, pluginsError, showError, status]);

  const sorted = useMemo(() => {
    return [...(connectors || [])].sort((a, b) => (a.displayName || a.id).localeCompare(b.displayName || b.id));
  }, [connectors]);

  const importArtifacts = async () => {
    if (!window.desktop?.solution?.pickPluginArtifacts || !window.desktop?.solution?.importPlugins) {
      setPluginsError("Plugin import requires desktop bridge support.");
      return;
    }
    if (!solutionPath || !solution?.pluginsPath) {
      setPluginsError("Load a solution first.");
      return;
    }
    const selected = await window.desktop.solution.pickPluginArtifacts();
    const artifactPaths = Array.isArray(selected) ? selected.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
    if (!artifactPaths.length) return;
    setBusy(true);
    setPluginsError(null);
    try {
      await window.desktop.solution.importPlugins({ solutionPath, artifactPaths });
      await refresh();
    } catch (err) {
      setPluginsError(err instanceof Error ? err.message : "Failed to import plugin artifacts");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="connector-picker-dialog max-w-3xl">
        <div className="connector-picker-dialog__header">
          <DialogTitle>Link Connector</DialogTitle>
          <DialogDescription className="sr-only">
            Select a connector plugin to link to this data source type.
          </DialogDescription>
          <Button size="sm" disabled={busy} onClick={() => void importArtifacts()}>
            Import Artifacts
          </Button>
        </div>
        {solution?.pluginsPath ? (
          <div className="muted small">Solution plugins path: {solution.pluginsPath}</div>
        ) : null}

        <div className="codex-popup-scroll mt-3 max-h-[420px] overflow-auto p-2">
          <div className="grid gap-2">
            {sorted.length === 0 && status === "ready" ? (
              <div className="muted small">No connectors available. Import plugin artifacts and reload.</div>
            ) : null}
            {status === "loading" ? <div className="muted small">Loading connectors...</div> : null}
            {sorted.map((c) => {
              const isSelected = !!selectedConnectorId && c.id === selectedConnectorId;
              return (
                <div
                  key={c.id}
                  className={cn("codex-popup-section p-3", isSelected ? "border-primary/60 bg-primary/6" : null)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{c.displayName || c.id}</div>
                      <div className="text-xs text-muted-foreground">{c.id}</div>
                    </div>
                    <Button size="sm" onClick={() => onSelect(c)} disabled={isSelected}>
                      {isSelected ? "Linked" : "Link"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
        <div className="error-surface-slot error-surface-slot--flush">
          <ErrorSurfaceHost scope={scope} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
