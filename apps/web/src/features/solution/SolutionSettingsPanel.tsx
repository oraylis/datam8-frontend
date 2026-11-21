import { useEffect, useState } from "react";
import { Button } from "@datam8/ui";
import { requestBackendApi } from "../../shared/api/backendClient";
import { SolutionSettingsFields, type SolutionSettingsValues } from "./SolutionSettingsFields";
import type { Solution } from "./solution-types";

export function SolutionSettingsPanel({
  solution,
  onSaved,
}: {
  solution: Solution;
  onSaved: () => Promise<void>;
}) {
  const [settings, setSettings] = useState<SolutionSettingsValues>(() => toSettings(solution));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSettings(toSettings(solution)), [solution]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await requestBackendApi<Solution>("/solution", {
        method: "PATCH",
        body: { ...settings, diagramPath: settings.diagramPath?.trim() || null },
      });
      await onSaved();
    } catch (err) {
      setError((err as Error).message || "Failed to save solution settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 p-6" aria-labelledby="solution-settings-title">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 id="solution-settings-title" className="text-xl font-semibold">Solution settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Paths and generator targets for the active solution.</p>
        </div>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <SolutionSettingsFields value={settings} onChange={setSettings} />
    </section>
  );
}

function toSettings(solution: Solution): SolutionSettingsValues {
  return {
    basePath: solution.basePath,
    modelPath: solution.modelPath,
    pluginsPath: solution.pluginsPath || "",
    diagramPath: solution.diagramPath || "",
    generatorTargets: solution.generatorTargets.map((target) => ({ ...target })),
  };
}
