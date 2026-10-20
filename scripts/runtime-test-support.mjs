import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function snapshotRuntime(root) {
  const entries = {};
  let files = 0, bytes = 0, symlinks = 0;
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name), relative = path.relative(root, file);
      if (entry.isSymbolicLink()) { entries[relative] = `link:${fs.readlinkSync(file)}`; symlinks++; }
      else if (entry.isDirectory()) { entries[relative] = 'directory'; visit(file); }
      else if (entry.isFile()) {
        const stat = fs.statSync(file);
        entries[relative] = `${stat.mode}:${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
        files++; bytes += stat.size;
      }
    }
  }
  visit(root);
  return { entries, files, bytes, symlinks };
}

export function assertRuntimeUnchanged(before, after) {
  const changed = [...new Set([...Object.keys(before.entries), ...Object.keys(after.entries)])]
    .filter(name => before.entries[name] !== after.entries[name]);
  if (changed.length) throw new Error(`Runtime changed during tests (${changed.length} entries): ${changed.slice(0, 12).join(', ')}`);
}

export function selectRuntimePython(root, override, platform = process.platform) {
  const candidates = platform === 'win32' ? ['python.exe', 'Scripts/python.exe'] : ['bin/python3', 'bin/python', 'python3'];
  const python = override ? path.resolve(override) : candidates.map(name => path.join(root, name)).find(file => fs.existsSync(file));
  if (!python || !fs.statSync(python).isFile()) throw new Error(`No runtime interpreter in ${root}`);
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(python));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('The interpreter must be inside the selected runtime (including symlink targets)');
  }
  return python;
}

export function assertReportOutsideRuntime(root, report) {
  try {
    if (fs.lstatSync(report).isSymbolicLink()) throw new Error('--report must not be a symbolic link');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let existing = path.resolve(report);
  const missing = [];
  while (!fs.existsSync(existing)) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  const destination = path.join(fs.realpathSync(existing), ...missing);
  const relative = path.relative(fs.realpathSync(root), destination);
  if (!relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    throw new Error('--report must be outside the runtime (including symlink targets)');
  }
}
