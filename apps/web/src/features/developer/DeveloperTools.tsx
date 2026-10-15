import { useEffect, useState } from "react";
import { Button, Label } from "@datam8/ui";
import type { DeveloperCapabilities, DesktopUpdateStatus, SimulationSystem, UpdateScenario } from "@datam8/types";

const scenarios: [UpdateScenario, string][] = [
  ["available", "Update available"], ["current", "Already up to date"], ["incompatible", "No compatible package"],
  ["long", "Long release notes"], ["empty", "Missing release notes"], ["notes-error", "Release notes unavailable"],
  ["network-error", "Network error"], ["slow", "Slow download"], ["download-error", "Download failure"],
];
export function DeveloperTools({ status }: { status: DesktopUpdateStatus | null }) {
  const bridge = window.desktop?.developer;
  const [capabilities, setCapabilities] = useState<DeveloperCapabilities | null>(null);
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<UpdateScenario>("available");
  const [system, setSystem] = useState<SimulationSystem>("current");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    const unsubscribe = bridge.onOpenPanel(() => setOpen(true));
    void bridge.getCapabilities().then(value => {
      if (live) { setCapabilities(value); if (value.simulation) setOpen(true); }
    }).catch(() => {});
    return () => { live = false; unsubscribe(); };
  }, [bridge]);
  if (!bridge || !capabilities || !open) return null;
  const working = busy || ["checking", "downloading", "preparing"].includes(status?.phase || "");
  const windowsOnly = scenario === "slow" || scenario === "download-error";
  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Developer action failed."); }
    finally { setBusy(false); }
  };
  return <aside aria-label="Developer tools" className="fixed right-5 top-20 z-40 max-h-[80vh] w-80 overflow-auto rounded-xl border border-border bg-card p-4 text-foreground shadow-lg">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-semibold">{capabilities.simulation ? "Update Simulation" : "Developer Tools"}</h2>
      <Button variant="ghost" size="sm" aria-label="Close developer tools" onClick={() => setOpen(false)}>Close</Button>
    </div>
    {capabilities.simulation ? <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Isolated profile and example data. Download and installation are simulated; dialogs and save checks are real.</p>
      <div className="space-y-1">
        <Label htmlFor="simulation-system">System</Label>
        <select id="simulation-system" className="w-full rounded-lg border border-border bg-background p-2 text-sm" value={windowsOnly ? "windows" : system} disabled={working || windowsOnly} onChange={event => setSystem(event.target.value as SimulationSystem)}>
          <option value="current">This system</option><option value="windows">Windows preview</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="simulation-scenario">Scenario</Label>
        <select id="simulation-scenario" className="w-full rounded-lg border border-border bg-background p-2 text-sm" value={scenario} disabled={working} onChange={event => setScenario(event.target.value as UpdateScenario)}>
          {scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {windowsOnly && <p className="text-xs text-muted-foreground">This scenario uses the Windows preview.</p>}
      <Button className="w-full" disabled={working} onClick={() => void act(() => bridge.runUpdateScenario(scenario, windowsOnly ? "windows" : system))}>Run Scenario</Button>
      <Button className="w-full" variant="outline" disabled={working} onClick={() => void act(() => bridge.openExampleSolution())}>Open Example Solution</Button>
      {!capabilities.exampleAvailable && <p className="text-xs text-muted-foreground">{capabilities.exampleReason}</p>}
      <p className="text-xs text-muted-foreground">Update status: {status?.phase || "idle"}{status?.percent !== undefined ? ` (${Math.round(status.percent)}%)` : ""}</p>
    </div> : <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Open a separate update simulation with a temporary profile and example solution. Your current work stays in this window.</p>
      <Button className="w-full" disabled={working} onClick={() => void act(() => bridge.openUpdateSimulation())}>Open Update Simulation</Button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </aside>;
}
