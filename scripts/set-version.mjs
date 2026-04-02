import fs from "fs/promises";
import path from "path";

function normalizeVersion(input) {
  const raw = String(input || "").trim();
  const version = raw.startsWith("v") ? raw.slice(1) : raw;
  // SemVer: X.Y.Z with optional pre-release and build metadata.
  // Examples: 1.2.3, 2.0.0-beta.1, 1.0.0+build.5, 1.0.0-rc.1+sha.abc
  const semverRe =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  if (!semverRe.test(version)) {
    throw new Error(
      `Invalid version "${raw}". Expected SemVer (e.g. 1.2.3, 2.0.0-beta.1), optionally prefixed with "v".`,
    );
  }
  return version;
}

async function updatePackageVersion(filePath, version) {
  const raw = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(raw);
  json.version = version;
  await fs.writeFile(filePath, JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`Updated ${filePath} -> ${version}`);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const version = normalizeVersion(process.argv[2]);

const root = process.cwd();
const targetCandidates = [
  "package.json",
  path.join("apps", "desktop", "package.json"),
  path.join("apps", "web", "package.json"),
  path.join("apps", "api", "package.json"),
].map((p) => path.join(root, p));

const targets = [];
for (const file of targetCandidates) {
  if (await pathExists(file)) {
    targets.push(file);
  } else {
    console.warn(`Skipped missing file: ${file}`);
  }
}

if (!targets.length) {
  throw new Error("No package.json targets found to update.");
}

await Promise.all(targets.map((file) => updatePackageVersion(file, version)));
