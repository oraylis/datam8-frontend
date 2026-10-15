export type UpdateScenario = "available" | "current" | "incompatible" | "long" | "empty" | "notes-error" | "network-error" | "slow" | "download-error";
export type SimulationSystem = "current" | "windows";
export type DeveloperCapabilities = { simulation: boolean; exampleAvailable: boolean; exampleReason?: string };
export type DesktopDeveloperBridge = {
  getCapabilities: () => Promise<DeveloperCapabilities>;
  openPanel: () => Promise<void>;
  openUpdateSimulation: () => Promise<void>;
  runUpdateScenario: (scenario: UpdateScenario, system: SimulationSystem) => Promise<void>;
  openExampleSolution: () => Promise<void>;
  onOpenPanel: (callback: () => void) => () => void;
};
