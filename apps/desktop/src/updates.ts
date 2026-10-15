import type { DesktopUpdateStatus, UpdatePreparation } from "../../../packages/types/src/desktop-updates";
import { API, compareVersions, loopback, notesExcerpt, releaseUrl, selectRelease, type Release } from "../resources/update-policy.cjs";

type DialogOptions = { title: string; message: string; detail?: string; buttons: string[]; cancelId: number; defaultId: number; type?: "info" | "error" };
export type UpdateHost = {
  currentVersion: string;
  platform: string;
  arch: string;
  packaged: boolean;
  demo: boolean;
  releasesApi?: string;
  showDialog: (options: DialogOptions) => Promise<number>;
  publish: (status: DesktopUpdateStatus) => void;
  progress: (fraction: number) => void;
  openExternal: (url: string) => Promise<void>;
  checkWindows: (tag: string) => Promise<string | null>;
  downloadWindows: () => Promise<void>;
  prepare: () => Promise<UpdatePreparation>;
  stopBackend: () => Promise<void>;
  installWindows: () => void;
  releasePreparation: () => void;
  fetch?: typeof fetch;
};

export class DesktopUpdates {
  status: DesktopUpdateStatus;
  private busy = false;
  private dialogOpen = false;
  private installerStopped = false;
  private scenario = "available";
  private windowsPreview = false;
  private api: string;
  private fetched: typeof fetch;

  constructor(private host: UpdateHost) {
    this.status = { phase: "idle", currentVersion: host.currentVersion, canInstall: host.platform === "win32", demo: host.demo };
    this.api = host.releasesApi ? loopback(host.releasesApi) : API;
    this.fetched = host.fetch || fetch;
  }
  private set(patch: Partial<DesktopUpdateStatus>) {
    this.status = { ...this.status, ...patch };
    this.host.publish(this.status);
  }
  private async json(route: string) {
    const response = await this.fetched(`${this.api}${route}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(15_000), redirect: "error",
    });
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "GitHub request limit reached. Please try again later." : `Release server returned HTTP ${response.status}.`);
    const data: unknown = await response.json();
    return data;
  }
  async check() {
    if (this.installerStopped) {
      await this.message("Restart DataM8 before trying again", this.status.error || "The update installer could not start.", true);
      return;
    }
    if (this.busy || this.dialogOpen || ["downloading", "preparing", "ready"].includes(this.status.phase)) {
      if (this.status.phase === "ready") await this.readyDialog();
      return;
    }
    if (!this.host.packaged && !this.host.demo && !this.host.releasesApi) {
      await this.message("Updates are available in the installed app", "Use the update demo to try the dialogs during development.");
      return;
    }
    this.busy = true;
    this.set({ phase: "checking", error: undefined, version: undefined, notes: undefined, releaseUrl: undefined, percent: undefined });
    try {
      const query = this.host.demo ? `&scenario=${encodeURIComponent(this.scenario)}` : "";
      const releases = await this.json(`/releases?per_page=100${query}`);
      if (!Array.isArray(releases)) throw new Error("Release server returned an invalid response.");
      const candidate = selectRelease(releases as Release[], this.host.currentVersion, this.host.platform, this.host.arch);
      if (!candidate) {
        this.set({ phase: "current" });
      } else {
        const version = candidate.tag_name.replace(/^v/, "");
        // Metadata from the actual Windows updater must describe the same release
        // selected by package/channel policy. A mismatch never reaches download.
        if (this.status.canInstall && !this.host.demo) {
          const offered = await this.host.checkWindows(candidate.tag_name);
          if (!offered || compareVersions(offered, version) !== 0) throw new Error("Windows update metadata does not match the published release. Please try again after publication completes.");
        }
        let notes = "", notesUnavailable = false;
        try {
          const suffix = this.host.demo ? `?scenario=${encodeURIComponent(this.scenario)}` : "";
          const exact = await this.json(`/releases/tags/${encodeURIComponent(candidate.tag_name)}${suffix}`) as Release;
          if (exact.tag_name !== candidate.tag_name || exact.draft) throw new Error("Release notes version mismatch");
          notes = notesExcerpt(exact.body || "");
          notesUnavailable = !notes;
        } catch { notesUnavailable = true; }
        this.set({ phase: "available", version, releaseUrl: releaseUrl(candidate.tag_name), notes, notesUnavailable });
      }
    } catch (error) {
      this.set({ phase: "error", error: error instanceof Error ? error.message : "Could not check for updates." });
    } finally { this.busy = false; }
    if (this.status.phase === "available") await this.availableDialog();
    else if (this.status.phase === "current") await this.message("DataM8 is up to date", `Installed version: ${this.host.currentVersion}\nNo newer compatible published release is available.`);
    else if (this.status.phase === "error") await this.message("Could not check for updates", this.status.error || "Please try again later.", true);
  }
  private async message(message: string, detail: string, error = false) {
    if (this.dialogOpen) return;
    this.dialogOpen = true;
    try { await this.host.showDialog({ title: this.host.demo ? "DataM8 — Update demo" : "DataM8 Updates", message, detail, type: error ? "error" : "info", buttons: ["OK"], cancelId: 0, defaultId: 0 }); }
    finally { this.dialogOpen = false; }
  }
  private async availableDialog() {
    if (this.dialogOpen) return;
    this.dialogOpen = true;
    let download = false;
    try {
      const canInstall = this.status.canInstall;
      const choice = await this.host.showDialog({ title: this.host.demo ? "DataM8 — Update demo" : "DataM8 Updates", message: `DataM8 ${this.status.version} is available`,
        detail: `Installed: ${this.host.currentVersion}\n\n${this.status.notes || "Release notes are unavailable. Open the release on GitHub for details."}${canInstall ? "" : "\n\nDownload the package for your system, verify its signature and replace the installed app. Installation instructions are linked on the release page."}`,
        buttons: canInstall ? ["Download Update", "Full Release Notes", "Later"] : ["Open Release & Downloads", "Later"], defaultId: 0, cancelId: canInstall ? 2 : 1 });
      if (choice === 0) { if (canInstall) download = true; else await this.openRelease(); }
      else if (canInstall && choice === 1) await this.openRelease();
    } finally { this.dialogOpen = false; }
    if (download) await this.download();
  }
  async openRelease() {
    // No URL supplied by the renderer or release body is used here.
    if (this.status.releaseUrl) await this.host.openExternal(this.status.releaseUrl);
  }
  async download() {
    if (this.busy || this.dialogOpen || !this.status.canInstall || this.status.phase !== "available") return;
    this.busy = true;
    this.set({ phase: "downloading", percent: 0, error: undefined });
    try {
      if (this.host.demo) {
        for (let percent = 0; percent <= 100; percent += 10) {
          await new Promise(resolve => setTimeout(resolve, this.scenario === "slow" ? 800 : 100));
          if (this.scenario === "download-error" && percent === 40) throw new Error("Demo: download interrupted. No installed files were changed.");
          this.progress(percent);
        }
      } else await this.host.downloadWindows();
      this.host.progress(-1);
      this.set({ phase: "ready", percent: 100 });
    } catch (error) {
      this.host.progress(-1);
      this.set({ phase: "error", error: error instanceof Error ? error.message : "Update download failed." });
    } finally { this.busy = false; }
    if ((this.status as DesktopUpdateStatus).phase === "ready") await this.readyDialog();
    else await this.message("Update download failed", this.status.error || "Please try again.", true);
  }
  progress(percent: number) {
    if (this.status.phase !== "downloading") return;
    const bounded = Math.max(0, Math.min(100, percent));
    this.set({ percent: bounded }); this.host.progress(bounded / 100);
  }
  private async readyDialog() {
    if (this.dialogOpen) return;
    this.dialogOpen = true;
    let install = false;
    try {
      install = await this.host.showDialog({ title: "DataM8 Updates", message: `DataM8 ${this.status.version} is ready to install`,
        detail: this.host.demo ? "Update demo: downloading and installing are simulated. Your installed app will not be replaced. Open drafts still go through the real save checks." : "DataM8 will save open changes, finish shutting down its backend, install the update and restart. You can also install later.",
        buttons: ["Restart and Install", "Later"], defaultId: 1, cancelId: 1 }) === 0;
    } finally { this.dialogOpen = false; }
    if (install) await this.install(true);
  }
  async install(confirmed = false) {
    if (this.busy || this.status.phase !== "ready" || !this.status.canInstall) return;
    if (!confirmed) { await this.readyDialog(); return; }
    this.busy = true;
    this.set({ phase: "preparing" });
    try {
      const preparation = await this.host.prepare();
      if (!preparation.ok) throw new Error(preparation.reason || "Open changes could not be saved.");
      if (this.host.demo) {
        this.set({ phase: "ready" });
        await this.message("Demo installation completed", "Save checks passed. In the signed Windows app, the backend would now stop and the update would install. This demo has not replaced or restarted your app.");
      } else {
        await this.host.stopBackend();
        this.host.installWindows();
      }
    } catch (error) {
      this.set({ phase: "ready", error: error instanceof Error ? error.message : "Update installation was cancelled." });
      await this.message("Update installation stopped", this.status.error || "Please save your changes and try again.", true);
    } finally { this.busy = false; this.host.releasePreparation(); }
  }
  installationFailed(error: unknown) {
    if (this.status.phase !== "preparing") return;
    this.installerStopped = true;
    this.set({ phase: "error", error: `The installer could not start. Restart DataM8 before trying again. ${error instanceof Error ? error.message : String(error)}` });
    this.host.releasePreparation();
    void this.message("Update installation stopped", this.status.error || "Please restart DataM8 and try again.", true).catch(() => {});
  }
  get canChangeScenario() { return !this.busy && !this.dialogOpen; }
  async demoScenario(scenario: string, windows = this.windowsPreview) {
    if (!this.host.demo || this.busy || this.dialogOpen) return;
    this.scenario = scenario; this.windowsPreview = windows;
    this.set({ phase: "idle", canInstall: windows || this.host.platform === "win32", error: undefined });
    await this.check();
  }
}
