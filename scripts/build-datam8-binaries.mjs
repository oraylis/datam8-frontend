import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatorRoot = path.join(repoRoot, "submodules", "datam8-generator");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(generatorRoot)) {
  fail(`[build:datam8-binaries] Missing submodule at ${generatorRoot}. Run: git submodule update --init --recursive`);
}

const uv = process.platform === "win32" ? "uv.exe" : "uv";
const build = spawnSync(uv, ["build"], {
  cwd: generatorRoot,
  stdio: "inherit",
  shell: false,
});
if (build.error && build.error.code === "ENOENT") {
  fail("[build:datam8-binaries] 'uv' is not installed or not on PATH. Install uv first (e.g. `python -m pip install uv`).");
}
if (build.status !== 0) {
  fail("[build:datam8-binaries] Failed to build datam8 wheel via uv build.");
}

const distDir = path.join(generatorRoot, "dist");
const wheel = fs
  .readdirSync(distDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".whl"))
  .map((entry) => entry.name)
  .sort()
  .at(-1);

if (!wheel) {
  fail("[build:datam8-binaries] Build finished but no wheel was found in submodules/datam8-generator/dist.");
}

console.log(`[build:datam8-binaries] OK (wheel): ${wheel}`);
