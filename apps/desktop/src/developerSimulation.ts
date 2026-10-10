import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { UpdateScenario } from "../../../packages/types/src/desktop-developer";
import type { Server } from "node:http";
import { demoReleaseServer, desktopFixture } from "../resources/dev-fixtures.cjs";

export function assertDeveloperAccess(state: { packaged: boolean; simulation: boolean; quitting: boolean }, sender: unknown, owner: unknown, simulation = false): void {
  if (state.packaged || !owner || sender !== owner || state.quitting) throw new Error("Developer tools are unavailable.");
  if (simulation && !state.simulation) throw new Error("Open an isolated update simulation first.");
}
export function simulationChoice(scenario: unknown, system: unknown): { scenario: UpdateScenario; windows: boolean } {
  const scenarios = ["available", "current", "incompatible", "long", "empty", "notes-error", "network-error", "slow", "download-error"];
  if (typeof scenario !== "string" || !scenarios.includes(scenario) || (system !== "current" && system !== "windows")) throw new Error("Invalid simulation scenario or system.");
  return { scenario: scenario as UpdateScenario, windows: system === "windows" || scenario === "slow" || scenario === "download-error" };
}
export function examplePython(repoRoot: string): string | undefined {
  const python = path.join(repoRoot, "submodules/datam8-generator/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!fs.existsSync(python)) return undefined;
  const probe = spawnSync(python, ["-m", "datam8", "--help"], { cwd: path.join(repoRoot, "submodules/datam8-generator"), stdio: "ignore", timeout: 5_000 });
  return !probe.error && probe.status === 0 ? python : undefined;
}
export const exampleSetup = "Prepare the Generator environment: cd submodules/datam8-generator, then uv sync --frozen --all-extras.";
async function unusedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
type Session = { root: string; server: Server; child: ChildProcess; closed: Promise<void>; backendPid?: number };
export class DeveloperSimulation {
  private session: Session | null = null;
  private starting: Promise<void> | null = null;
  private stopping = false;
  constructor(private appPath: string) {}
  async open(): Promise<void> {
    if (this.stopping) throw new Error("The development app is closing.");
    if (this.starting) return this.starting;
    this.starting = this.openSession();
    try { await this.starting; } finally { this.starting = null; }
  }
  private async openSession(): Promise<void> {
    const session = this.session;
    if (session && session.child.exitCode === null && session.child.signalCode === null && session.child.connected) {
      await new Promise<void>((resolve, reject) => session.child.send({ type: "focus" }, error => error ? reject(error) : resolve())); return;
    }
    if (session) await session.closed;
    if (this.stopping) throw new Error("The development app is closing.");
    await this.start();
  }
  private async start(): Promise<void> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "DataM8 update simulation "));
    const server = demoReleaseServer(); let session: Session | undefined;
    try {
      fs.mkdirSync(path.join(root, "Profile"));
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (key.startsWith("DATAM8_UPDATE_") || key === "ELECTRON_RUN_AS_NODE" || key === "NODE_OPTIONS") delete env[key];
      Object.assign(env, { DATAM8_UPDATE_SANDBOX: "1", DATAM8_UPDATE_DEMO_API: `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`, DATAM8_UPDATE_DEMO_PROFILE: path.join(root, "Profile"), DATAM8_BACKEND_TEST_PORT: String(await unusedPort()) });
      const repoRoot = path.resolve(this.appPath, "../..");
      const python = examplePython(repoRoot);
      if (python) env.DATAM8_PYTHON_PATH = python;
      else delete env.DATAM8_PYTHON_PATH;
      env.DATAM8_UPDATE_DEMO_SOLUTION = desktopFixture(root, "Example solution", repoRoot);
      const debug = process.env.DATAM8_DEVELOPER_TEST_DEBUG === "1";
      const child = spawn(process.execPath, [...(debug ? ["--inspect=0", "--remote-debugging-port=0"] : []), this.appPath, `--user-data-dir=${path.join(root, "Profile")}`, ...(process.argv.includes("--no-sandbox") ? ["--no-sandbox"] : [])], { env, stdio: ["ignore", "pipe", "pipe", "ipc"], detached: process.platform !== "win32" });
      const redact = (chunk: Buffer) => String(chunk).replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]").replace(/(--token[\s=]+)[^\s"']+/gi, "$1[redacted]");
      child.stdout?.on("data", chunk => console.log(`[update-sandbox] ${redact(chunk)}`));
      child.stderr?.on("data", chunk => console.error(`[update-sandbox] ${redact(chunk)}`));
      const closed = new Promise<void>((resolve, reject) => child.once("close", () => { void this.cleanup(session!).then(resolve, reject); }));
      void closed.catch(error => console.error("Update simulation cleanup failed:", error));
      session = { root, server, child, closed }; this.session = session;
      child.on("message", message => {
        const data = message as { type?: string; pid?: number };
        if (data.type === "backend" && Number.isInteger(data.pid) && Number(data.pid) > 0) session!.backendPid = data.pid;
        if (data.type === "backend-stopped" && data.pid === session!.backendPid) session!.backendPid = undefined;
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { clear(); reject(new Error("Update simulation did not start within 30 seconds.")); }, 30_000);
        const ready = (message: unknown) => { if ((message as { type?: string }).type === "ready") { clear(); resolve(); } };
        const failed = (error?: Error) => { clear(); reject(error || new Error("Update simulation exited during startup.")); };
        const clear = () => { clearTimeout(timer); child.off("message", ready); child.off("error", failed); child.off("close", failed); };
        child.on("message", ready); child.once("error", failed); child.once("close", failed);
      });
    } catch (error) {
      if (session) await this.stopSession(session);
      else { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await fs.promises.rm(root, { recursive: true, force: true }); }
      throw error;
    }
  }
  private async killTree(pid: number, group = false): Promise<void> {
    if (process.platform === "win32") {
      await new Promise<void>(resolve => { const task = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" }); task.once("error", () => resolve()); task.once("close", () => resolve()); });
    } else { try { process.kill(group ? -pid : pid, "SIGKILL"); } catch { /* already stopped */ } }
  }
  private async cleanup(session: Session): Promise<void> {
    if (process.platform !== "win32" && session.child.pid) await this.killTree(session.child.pid, true);
    else if (session.backendPid) await this.killTree(session.backendPid);
    session.server.closeAllConnections();
    await new Promise<void>(resolve => session.server.close(() => resolve()));
    await fs.promises.rm(session.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    if (this.session === session) this.session = null;
  }
  private async stopSession(session: Session): Promise<void> {
    if (session.child.connected) session.child.send({ type: "shutdown" }, () => {});
    let timeout: ReturnType<typeof setTimeout>;
    let graceful: boolean;
    try { graceful = await Promise.race([session.closed.then(() => true), new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), 15_000); })]); }
    finally { clearTimeout(timeout!); }
    if (!graceful && session.child.pid) { await this.killTree(session.child.pid, process.platform !== "win32"); await session.closed; }
  }
  async close(): Promise<void> {
    this.stopping = true;
    await this.starting?.catch(() => {});
    if (this.session) await this.stopSession(this.session);
  }
}
