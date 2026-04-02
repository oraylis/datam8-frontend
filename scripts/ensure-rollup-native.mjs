import { spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(msg) {
  process.stdout.write(`[ensure-rollup-native] ${msg}\n`);
}

function error(msg) {
  process.stderr.write(`[ensure-rollup-native] ${msg}\n`);
}

function collectErrorText(err) {
  const parts = [];
  const seen = new Set();
  let cur = err;
  for (let i = 0; i < 6 && cur && typeof cur === "object" && !seen.has(cur); i++) {
    seen.add(cur);
    if (typeof cur.message === "string") parts.push(cur.message);
    if (typeof cur.stack === "string") parts.push(cur.stack);
    cur = cur.cause;
  }
  if (typeof err === "string") parts.push(err);
  return parts.join("\n");
}

function extractMissingRollupNativePackage(err) {
  const haystack = collectErrorText(err);
  const match = haystack.match(/@rollup\/rollup-[a-z0-9-]+/i);
  return match?.[0] ?? null;
}

function looksLikeRollupNativeOptionalDepMissing(err, missingPkg) {
  if (!missingPkg) return false;
  const haystack = collectErrorText(err);
  return /cannot find (module|package)/i.test(haystack);
}

function runRollupProbe() {
  // Run in a fresh Node process to avoid module caching after a failed require/import.
  const probe = String.raw`(async () => {
  try {
    await import("rollup");
    process.exit(0);
  } catch (e1) {
    try {
      require("rollup");
      process.exit(0);
    } catch (e2) {
      const err = e2 || e1;
      const msg = err && typeof err === "object" ? (err.stack || err.message || String(err)) : String(err);
      console.error(msg);
      if (err && typeof err === "object" && err.cause) {
        const c = err.cause;
        const cmsg = c && typeof c === "object" ? (c.stack || c.message || String(c)) : String(c);
        console.error("Caused by:");
        console.error(cmsg);
      }
      process.exit(1);
    }
  }
})();`;

  const res = spawnSync(process.execPath, ["-e", probe], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  return {
    ok: res.status === 0,
    status: res.status ?? 1,
    stdout: String(res.stdout || ""),
    stderr: String(res.stderr || ""),
  };
}

function resolveRollupVersion() {
  try {
    const pkgJson = require.resolve("rollup/package.json");
    const parsed = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
    if (parsed && typeof parsed.version === "string") return parsed.version;
  } catch {
    // ignore
  }
  return null;
}

function installPackage(pkg, versionHint) {
  const npmCmd = "npm";
  const spec = versionHint ? `${pkg}@${versionHint}` : pkg;
  const args = ["i", "--no-save", "--no-audit", "--no-fund", "--workspaces=false", spec];
  log(`Running: ${npmCmd} ${args.join(" ")}`);
  const lockPath = path.join(repoRoot, "package-lock.json");
  const lockBefore = fs.existsSync(lockPath) ? fs.readFileSync(lockPath) : null;
  const res = spawnSync(npmCmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (lockBefore) {
    try {
      const lockAfter = fs.existsSync(lockPath) ? fs.readFileSync(lockPath) : null;
      if (lockAfter && !lockAfter.equals(lockBefore)) {
        fs.writeFileSync(lockPath, lockBefore);
        log("Restored package-lock.json to keep it unchanged.");
      }
    } catch (e) {
      error(`Failed to restore package-lock.json: ${(e && e.message) || String(e)}`);
    }
  }
  return res.status ?? 1;
}

log("Checking Rollup native optional dependency…");

const first = runRollupProbe();
if (first.ok) {
  log("Rollup is loadable.");
  process.exit(0);
}

const firstText = `${first.stderr}\n${first.stdout}`.trim();
const missingPkg = extractMissingRollupNativePackage(firstText);

if (!looksLikeRollupNativeOptionalDepMissing(firstText, missingPkg)) {
  error("Rollup failed to load, but this does not look like a missing @rollup/rollup-<platform> package.");
  error(firstText || `Exit code: ${first.status}`);
  process.exit(1);
}

log(`Detected missing Rollup native package: ${missingPkg}`);
log("This is a known npm optionalDependencies issue. Attempting a local self-heal (no lockfile changes).");

const rollupVersion = resolveRollupVersion();
if (rollupVersion) log(`Detected installed rollup version ${rollupVersion}.`);

const status = installPackage(missingPkg, rollupVersion);
if (status !== 0) {
  error(`npm install failed with exit code ${status}`);
  process.exit(status);
}

try {
  const resolvedMissing = require.resolve(missingPkg);
  log(`Verified installed: ${missingPkg} -> ${resolvedMissing}`);
} catch {
  error(`Install completed, but ${missingPkg} is still not resolvable from the repository root.`);
}

const second = runRollupProbe();
if (second.ok) {
  log("Rollup is loadable after installing the native package.");
  process.exit(0);
}

error("Rollup still failed to load after installing the native package.");
const secondText = `${second.stderr}\n${second.stdout}`.trim();
error(secondText || `Exit code: ${second.status}`);
process.exit(1);
