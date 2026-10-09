import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const standaloneRelease = '20261003';
export const standaloneVersion = '3.12.15';
export const standaloneArchives = {
  arm64: { triple: 'aarch64-apple-darwin', sha256: '316a463172740e71d8dca1f2730784e325f3f720941137b5d674d5801a632213' },
  x64: { triple: 'x86_64-apple-darwin', sha256: 'a8fd7a91852f19b6d959793ef41fad048631ccb2a334a9ecdf573255298f7978' },
};
export function checked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`);
  return result.stdout || '';
}
export function files(root) {
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const name = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...files(name));
    else if (entry.isFile()) result.push(name);

  }
  return result;
}
function inside(root, name) {
  const rel = path.relative(root, name);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
export function isMachO(name) {
  const fd = fs.openSync(name, 'r');
  try {
    const bytes = Buffer.alloc(4);
    if (fs.readSync(fd, bytes, 0, 4, 0) !== 4) return false;
    return ['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(bytes.toString('hex'));
  } finally { fs.closeSync(fd); }
}
export async function installStandalone(runtimeRoot, arch = process.arch) {
  const spec = standaloneArchives[arch];
  if (!spec) throw new Error(`Unsupported macOS architecture: ${arch}`);
  const name = `cpython-${standaloneVersion}+${standaloneRelease}-${spec.triple}-install_only.tar.gz`;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'datam8-python-'));
  try {
    let bytes;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`https://github.com/astral-sh/python-build-standalone/releases/download/${standaloneRelease}/${name}`, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`Standalone download failed: ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        console.log(`[mac-runtime] Retrying standalone download (${attempt + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    if (createHash('sha256').update(bytes).digest('hex') !== spec.sha256) throw new Error(`Standalone SHA-256 mismatch: ${name}`);
    const archive = path.join(temp, name);
    fs.writeFileSync(archive, bytes);
    fs.mkdirSync(runtimeRoot, { recursive: true });
    checked('tar', ['-xzf', archive, '--strip-components=1', '-C', runtimeRoot]);
    return path.join(runtimeRoot, 'bin', 'python3');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function otool(binary, flag) {
  // Apple's otool treats a trailing '(...)' as archive-member syntax, even in a filename.
  if (!/[()]/.test(binary)) return checked('otool', [flag, binary]);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'datam8-macho-'));
  try {
    const alias = path.join(temp, 'binary'); fs.symlinkSync(path.resolve(binary), alias);
    return checked('otool', [flag, alias]);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function rpaths(binary) {
  const output = otool(binary, '-l');
  return [...output.matchAll(/cmd LC_RPATH\s+cmdsize \d+\s+path (.+?) \(offset/g)].map(match => match[1]);
}
function executableFor(binary, root) {
  const marker = `${path.sep}python-runtime${path.sep}`;
  const index = binary.indexOf(marker);
  if (index >= 0) return path.join(binary.slice(0, index), 'python-runtime', 'bin', 'python3');
  let dir = path.dirname(binary);
  while (inside(root, dir)) {
    if (dir.endsWith('.app')) {
      const macos = path.join(dir, 'Contents', 'MacOS');
      if (fs.existsSync(macos)) return files(macos).find(isMachO) || binary;
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return fs.existsSync(path.join(root, 'bin', 'python3')) ? path.join(root, 'bin', 'python3') : binary;
}
export function validateMacBinaries(root, arch = process.arch) {
  if (process.platform !== 'darwin') throw new Error('Mach-O verification requires macOS');
  root = fs.realpathSync(root);
  const binaries = files(root).filter(isMachO);
  if (!binaries.length) throw new Error(`No Mach-O binaries in ${root}`);
  const expected = arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'x86_64' : null;
  if (!expected) throw new Error(`Unsupported Mach-O architecture ${arch}`);
  const problems = [];
  function checkSymlinks(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) checkSymlinks(name);
      else if (entry.isSymbolicLink() && !inside(root, fs.realpathSync(name))) problems.push(`External symlink: ${name}`);
    }
  }
  checkSymlinks(root);
  for (const binary of binaries) {
    if (!checked('lipo', ['-archs', binary]).trim().split(/\s+/).includes(expected)) problems.push(`Wrong architecture: ${binary}`);
    const executable = executableFor(binary, root);
    const expand = value => value.replace('@loader_path', path.dirname(binary)).replace('@executable_path', path.dirname(executable));
    const runpaths = [...rpaths(binary).map(expand), ...rpaths(executable).map(value => value.replace('@loader_path', path.dirname(executable)).replace('@executable_path', path.dirname(executable)))];
    const ids = new Set(otool(binary, '-D').split(/\r?\n/).slice(1).map(line => line.trim()).filter(Boolean));
    const dependencies = [...otool(binary, '-L').matchAll(/^\s+(.+?) \(compatibility version/gm)].map(match => match[1]);
    for (const dependency of dependencies) {
      if (ids.has(dependency)) continue; // LC_ID_DYLIB describes this binary, not an imported library.
      if (dependency.startsWith('/System/Library/') || dependency.startsWith('/usr/lib/')) continue;
      const candidates = dependency.startsWith('@rpath/')
        ? runpaths.map(base => path.resolve(base, dependency.slice(7)))
        : [expand(dependency)];
      const valid = candidates.some(name => path.isAbsolute(name) && fs.existsSync(name) && inside(root, fs.realpathSync(name)));
      if (!valid) problems.push(`${path.relative(root, binary)}: unresolved/external ${dependency}`);
    }
  }
  if (problems.length) throw new Error(`Non-portable macOS bundle:\n${problems.join('\n')}`);
  console.log(`[mac-runtime] Verified ${binaries.length} native binaries (${expected})`);
  return binaries;
}
export function signMacRuntime(root) {
  for (const binary of files(root).filter(isMachO)) checked('codesign', ['--force', '--sign', '-', '--timestamp=none', binary]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { validateMacBinaries(path.resolve(process.argv[2]), process.argv[3] || process.arch); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
