import fs from "node:fs";
import path from "node:path";
import type AdmZip from "adm-zip";

function assertPortableSegment(segment: string): void {
  if (!segment || segment === "." || segment === ".." || /[<>:"/\\|?*\x00-\x1f]/.test(segment)
    || /[. ]$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)) {
    throw new Error("Unsafe plugin path component.");
  }
}

function pluginFolder(id: string): string {
  if (id.split(/[\\/]/).some(part => part === "." || part === "..")) {
    throw new Error("Unsafe plugin identifier.");
  }
  const name = id.trim().replace(/[\\/]/g, "_");
  assertPortableSegment(name);
  if (name.startsWith(".datam8-import-")) throw new Error("Reserved plugin identifier.");
  return name;
}

function assertDestination(root: string, destination: string): void {
  if (fs.realpathSync(root) !== root || path.dirname(destination) !== root || destination === root) {
    throw new Error("Plugin destination escapes its installation directory.");
  }
  try {
    const stat = fs.lstatSync(destination);
    if (stat.isSymbolicLink() || !stat.isDirectory() || path.dirname(fs.realpathSync(destination)) !== root) {
      throw new Error("Plugin destination must be a real directory, not a link.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Validate and stage an archive before replacing any installed plugin. */
export function importPluginZipArtifact(zipPath: string, pluginsTargetDir: string): void {
  // Keep ZIP support lazy: a missing package must not prevent desktop startup.
  const AdmZipCtor = require("adm-zip") as typeof AdmZip;
  const zip = new AdmZipCtor(zipPath);
  const entries = zip.getEntries();
  if (!entries.length) throw new Error("Plugin ZIP is empty.");

  const names = new Set<string>();
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, "/");
    if (normalized.includes("..") || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
      throw new Error("Unsafe ZIP entry path.");
    }
    const parts = normalized.replace(/\/$/, "").split("/");
    parts.forEach(assertPortableSegment);
    const canonical = parts.join("/").toLowerCase();
    if (names.has(canonical)) throw new Error("Duplicate ZIP entry path.");
    names.add(canonical);
    if (((entry.attr >>> 16) & 0o170000) === 0o120000) throw new Error("ZIP symlinks are not supported.");
  }
  const manifests = entries.filter(entry => !entry.isDirectory
    && path.posix.basename(entry.entryName.replace(/\\/g, "/")).toLowerCase() === "plugin.json");
  if (manifests.length !== 1) throw new Error("Plugin ZIP must contain exactly one plugin.json.");
  const manifest = JSON.parse(zip.readAsText(manifests[0]));
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
    || (manifest.id !== undefined && typeof manifest.id !== "string")) {
    throw new Error("Invalid plugin.json in ZIP.");
  }
  const folder = pluginFolder(manifest.id?.trim() || path.basename(zipPath, path.extname(zipPath)));
  fs.mkdirSync(pluginsTargetDir, { recursive: true });
  const root = fs.realpathSync(pluginsTargetDir);
  const destination = path.resolve(root, folder);
  assertDestination(root, destination);

  const work = fs.mkdtempSync(path.join(root, ".datam8-import-"));
  const staged = path.join(work, "staged");
  const previous = path.join(work, "previous");
  let preserveBackup = false;
  try {
    fs.mkdirSync(staged);
    zip.extractAllTo(staged, false, false);
    assertDestination(root, destination);
    const replacing = fs.existsSync(destination);
    if (replacing) fs.renameSync(destination, previous);
    try {
      fs.renameSync(staged, destination);
    } catch (installError) {
      if (replacing) {
        try { fs.renameSync(previous, destination); }
        catch (restoreError) {
          preserveBackup = true;
          throw new AggregateError([installError, restoreError], `Plugin replacement failed; previous plugin retained at ${previous}`);
        }
      }
      throw installError;
    }
  } finally {
    // Only this privately allocated directory is recursively removed, never an ID-derived path.
    if (!preserveBackup && path.dirname(work) === root && path.basename(work).startsWith(".datam8-import-")) {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
}
