import fs from "fs/promises";
import path from "path";

function normalizeVersion(input) {
  const raw = String(input || "").trim();
  const version = raw.startsWith("v") ? raw.slice(1) : raw;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version "${raw}". Expected X.Y.Z (optionally prefixed with "v").`);
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
