import { execSync } from "child_process";

const platform = process.platform;
const script =
  platform === "win32"
    ? "package:win"
    : platform === "darwin"
      ? "package:mac"
      : platform === "linux"
        ? "package:linux"
        : null;

if (!script) {
  console.error(`[package-desktop] Unsupported platform: ${platform}`);
  process.exit(1);
}

execSync(`npm --workspace apps/desktop run ${script}`, { stdio: "inherit" });

