export type DesktopUpdatePhase = "idle" | "checking" | "current" | "available" | "downloading" | "ready" | "preparing" | "error";
export type DesktopUpdateStatus = {
  phase: DesktopUpdatePhase;
  currentVersion: string;
  version?: string;
  releaseUrl?: string;
  notes?: string;
  notesUnavailable?: boolean;
  percent?: number;
  error?: string;
  canInstall: boolean;
  demo: boolean;
};
export type UpdatePreparation = { ok: boolean; reason?: string };
export type DesktopUpdateBridge = {
  getStatus: () => Promise<DesktopUpdateStatus>;
  check: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  openRelease: () => Promise<void>;
  onStatusChanged: (callback: (status: DesktopUpdateStatus) => void) => () => void;
  onPrepareInstall: (callback: (requestId: string) => void) => () => void;
  completePreparation: (requestId: string, result: UpdatePreparation) => Promise<void>;
};
