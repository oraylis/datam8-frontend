import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function proseLines(source) {
  let fence = null;
  return source.split(/\r?\n/).map(line => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = { char: match[1][0], length: match[1].length };
      else if (match[1][0] === fence.char && match[1].length >= fence.length) fence = null;
      return "";
    }
    return fence ? "" : line;
  });
}

export function headingAnchors(source) {
  const counts = new Map();
  const anchors = new Set();
  for (const line of proseLines(source)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1];
    if (!heading) continue;
    const slug = heading.toLowerCase().replace(/<[^>]*>/g, "")
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s/g, "-");
    const count = counts.get(slug) || 0;
    counts.set(slug, count + 1);
    anchors.add(count ? `${slug}-${count}` : slug);
  }
  return anchors;
}

export function checkMarkdown(file, source, read = name => fs.readFileSync(name, "utf8"), exists = fs.existsSync) {
  const errors = [];
  const lines = proseLines(source);
  if (!source.endsWith("\n")) errors.push("missing final newline");
  if (!lines.some(line => /^#\s/.test(line))) errors.push("missing level-one title");
  const definitions = new Map();
  for (const line of lines) {
    const definition = line.match(/^\s{0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/);
    if (definition) definitions.set(definition[1].toLowerCase(), definition[2] || definition[3]);
  }
  function destination(raw, line) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) return;
    let decoded;
    try { decoded = decodeURIComponent(raw); } catch { errors.push(`line ${line}: malformed URL ${raw}`); return; }
    const [relative, fragment] = decoded.split("#");
    const target = relative ? path.resolve(path.dirname(file), relative.split("?")[0]) : file;
    if (!exists(target)) { errors.push(`line ${line}: missing local target ${raw}`); return; }
    if (fragment && /\.md$/i.test(target)) {
      if (!headingAnchors(read(target)).has(fragment)) errors.push(`line ${line}: missing heading ${raw}`);
    }
  }
  lines.forEach((line, index) => {
    if (/\s+$/.test(line) && !/ {2}$/.test(line)) errors.push(`line ${index + 1}: trailing whitespace`);
    if (/^#{1,6}\s/.test(line) && lines[index + 1]?.trim()) errors.push(`line ${index + 1}: heading needs a blank line afterward`);
    const clean = line.replace(/`+[^`]*`+/g, "");
    for (const match of clean.matchAll(/!?\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*["'])?\)/g)) {
      if (match[0].startsWith("![") && !match[1].trim()) errors.push(`line ${index + 1}: image needs alt text`);
      destination(match[2] || match[3], index + 1);
    }
    for (const match of clean.matchAll(/!?\[([^\]]+)\]\[([^\]]*)\]/g)) {
      const ref = (match[2] || match[1]).toLowerCase();
      if (!definitions.has(ref)) errors.push(`line ${index + 1}: undefined reference ${ref}`);
      else destination(definitions.get(ref), index + 1);
    }
  });
  return errors;
}

export function documentationFiles(repoRoot = root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(".") && entry.name !== ".github") continue;
      if (["node_modules", "dist", "release", "output", "Output", ".git", ".venv", ".playwright-cli", "datam8-model", "submodules"].includes(entry.name)) continue;
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (entry.name.endsWith(".md")) files.push(name);
    }
  }
  walk(repoRoot);
  return files.sort();
}

export function checkCapture(manifest, assets, exists = fs.existsSync) {
  const errors = [];
  for (const field of ["frontendCommit", "backendCommit", "schemaCommit", "sampleCommit"]) {
    if (!/^[a-f0-9]{40}$/.test(manifest[field] || "")) errors.push(`Invalid capture revision: ${field}`);
  }
  const shots = manifest.screenshots || [];
  if (shots.length !== 22 || new Set(shots.map(shot => shot.file)).size !== 22) errors.push("Capture must contain 22 unique screenshots");
  for (const shot of shots) {
    if (!/^\d{2}-[a-z-]+\.png$/.test(shot.file || "") || !shot.description || shot.status !== "captured") errors.push(`Invalid capture image entry: ${shot.file}`);
    else if (!exists(path.join(assets, shot.file))) errors.push(`Missing manifest image: ${shot.file}`);
  }
  if (!Array.isArray(manifest.checks) || manifest.checks.length < 5 || manifest.checks.some(check => check.result !== "PASS")) errors.push("Capture needs all five passing acceptance checks");
  return errors;
}

export function checkTargetDocumentation(source, solution) {
  const rows = proseLines(source).filter(line => /^\|\s*[a-z][a-z-]*\s*\|\s*`/.test(line));
  const expected = solution.generatorTargets || [];
  const errors = [];
  if (rows.length !== expected.length) errors.push("Target table count differs from solution descriptor");
  for (const target of expected) {
    const row = rows.find(line => line.split("|")[1].trim() === target.name);
    if (!row || !row.includes(`\`${target.sourcePath}\``) || !row.includes(`\`${target.outputPath}\``)) errors.push(`Target documentation differs from descriptor: ${target.name}`);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let count = 0;
  const files = documentationFiles();
  for (const file of files) {
    for (const error of checkMarkdown(file, fs.readFileSync(file, "utf8"))) {
      console.error(`${path.relative(root, file)}: ${error}`);
      count++;
    }
  }
  const assets = path.join(root, "docs/user-guide/assets");
  const descriptor = path.join(root, "ORAYLISDatabricksSample.dm8s");
  const targets = path.join(root, "docs/reference/targets.md");
  if (fs.existsSync(descriptor) && fs.existsSync(targets)) {
    for (const error of checkTargetDocumentation(fs.readFileSync(targets, "utf8"), JSON.parse(fs.readFileSync(descriptor, "utf8")))) { console.error(error); count++; }
  }
  const manifestFile = path.join(assets, "manifest.json");
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    for (const error of checkCapture(manifest, assets)) { console.error(error); count++; }
  } else if (process.argv.includes("--require-capture")) {
    console.error("Missing central user-guide capture manifest"); count++;
  }
  console.log(`Checked ${files.length} Markdown files: ${count} problem(s). External URLs are not fetched.`);
  process.exitCode = count ? 1 : 0;
}
