import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);
const { importPluginZipArtifact } = require('../apps/desktop/dist/pluginArtifacts.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'datam8-plugin-'));
  const plugins = path.join(root, 'Plugins');
  fs.mkdirSync(plugins);
  const solution = path.join(root, 'Example.dm8s');
  fs.writeFileSync(solution, 'solution sentinel');
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('datam8-plugin-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function archive(id = 'example', entries = {}) {
    const zip = new AdmZip();
    zip.addFile('plugin.json', Buffer.from(JSON.stringify({ id })));
    zip.addFile('resource.txt', Buffer.from('new content'));
    for (const [name, value] of Object.entries(entries)) zip.addFile(name, Buffer.from(value));
    const file = path.join(root, 'plugin.zip');
    zip.writeZip(file);
    return file;
  }
  function installed() {
    const dir = path.join(plugins, 'example');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'resource.txt'), 'previous content');
    return dir;
  }
  return { root, plugins, solution, archive, installed };
}

test('imports and replaces a valid plugin without retaining old files or staging directories', t => {
  const f = fixture(t);
  const dir = f.installed();
  fs.writeFileSync(path.join(dir, 'obsolete.txt'), 'obsolete');
  importPluginZipArtifact(f.archive(), f.plugins);
  assert.equal(fs.readFileSync(path.join(dir, 'resource.txt'), 'utf8'), 'new content');
  assert.equal(fs.existsSync(path.join(dir, 'obsolete.txt')), false);
  assert.deepEqual(fs.readdirSync(f.plugins), ['example']);
  assert.equal(fs.readFileSync(f.solution, 'utf8'), 'solution sentinel');
});

test('rejects unsafe IDs before touching the solution or installed plugin', t => {
  const f = fixture(t); const dir = f.installed();
  for (const id of ['.', '..', '../example', 'example/..', 'example.', '...', 'CON', 'nul.txt', 'C:example', '.datam8-import-other', 'x\0y']) {
    assert.throws(() => importPluginZipArtifact(f.archive(id), f.plugins), /Unsafe|Reserved/);
    assert.equal(fs.readFileSync(f.solution, 'utf8'), 'solution sentinel');
    assert.equal(fs.readFileSync(path.join(dir, 'resource.txt'), 'utf8'), 'previous content');
    assert.deepEqual(fs.readdirSync(f.plugins), ['example']);
  }
});

test('rejects archive traversal, Windows path aliases and ambiguous manifests', t => {
  const f = fixture(t); const dir = f.installed();
  // Patch equal-length entry names after serialization: addFile normalizes traversal itself.
  for (const [source, target] of [['safe/file', '../escape'], ['safe/file', '/absolute'], ['safe/file', 'C:/escape']]) {
    const file = f.archive('example', { [source]: 'payload' });
    const bytes = fs.readFileSync(file);
    for (let at = bytes.indexOf(source); at !== -1; at = bytes.indexOf(source, at + target.length)) bytes.write(target, at);
    fs.writeFileSync(file, bytes);
    assert.throws(() => importPluginZipArtifact(file, f.plugins), /Unsafe/);
  }
  for (const entries of [{ 'resource.txt.': 'alias' }, { 'RESOURCE.TXT': 'alias' }, { 'nested/plugin.json': '{}' }]) {
    assert.throws(() => importPluginZipArtifact(f.archive('example', entries), f.plugins), /Unsafe|Duplicate|exactly one/);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'resource.txt'), 'utf8'), 'previous content');
});

test('rejects an existing symlink or Windows junction as the destination', t => {
  const f = fixture(t); const outside = path.join(f.root, 'Outside');
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'sentinel'), 'untouched');
  fs.symlinkSync(outside, path.join(f.plugins, 'example'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => importPluginZipArtifact(f.archive(), f.plugins), /real directory/);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel'), 'utf8'), 'untouched');
});

test('malformed and duplicate ZIPs leave the existing plugin intact', t => {
  const f = fixture(t); const dir = f.installed();
  const duplicate = f.archive('example', { 'resourcf.txt': 'duplicate' });
  fs.writeFileSync(duplicate, Buffer.from(fs.readFileSync(duplicate).toString('latin1').replaceAll('resourcf.txt', 'resource.txt'), 'latin1'));
  assert.throws(() => importPluginZipArtifact(duplicate, f.plugins));
  const corrupt = f.archive(); const bytes = fs.readFileSync(corrupt);
  // Corrupt the resource CRC in both headers; manifest reading still succeeds.
  let at = 0;
  while ((at = bytes.indexOf(Buffer.from('504b0102', 'hex'), at)) !== -1) {
    const nameLength = bytes.readUInt16LE(at + 28);
    if (bytes.subarray(at + 46, at + 46 + nameLength).toString() === 'resource.txt') bytes.writeUInt32LE(0, at + 16);
    at += 46;
  }
  at = 0;
  while ((at = bytes.indexOf(Buffer.from('504b0304', 'hex'), at)) !== -1) {
    const nameLength = bytes.readUInt16LE(at + 26);
    if (bytes.subarray(at + 30, at + 30 + nameLength).toString() === 'resource.txt') bytes.writeUInt32LE(0, at + 14);
    at += 30;
  }
  fs.writeFileSync(corrupt, bytes);
  assert.throws(() => importPluginZipArtifact(corrupt, f.plugins), /CRC/);
  assert.equal(fs.readFileSync(path.join(dir, 'resource.txt'), 'utf8'), 'previous content');
  assert.deepEqual(fs.readdirSync(f.plugins), ['example']);
});

test('rolls back if the final rename fails', t => {
  const f = fixture(t); const dir = f.installed(); const archive = f.archive();
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (source, target) => {
    if (path.basename(source) === 'staged') throw new Error('simulated install failure');
    return rename(source, target);
  });
  assert.throws(() => importPluginZipArtifact(archive, f.plugins), /simulated install failure/);
  assert.equal(fs.readFileSync(path.join(dir, 'resource.txt'), 'utf8'), 'previous content');
  assert.deepEqual(fs.readdirSync(f.plugins), ['example']);
});

test('retains the previous plugin for recovery if both replacement and rollback fail', t => {
  const f = fixture(t); f.installed(); const archive = f.archive();
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (source, target) => {
    if (['staged', 'previous'].includes(path.basename(source))) throw new Error('simulated locked destination');
    return rename(source, target);
  });
  assert.throws(() => importPluginZipArtifact(archive, f.plugins), /previous plugin retained/);
  const backup = fs.readdirSync(f.plugins).find(name => name.startsWith('.datam8-import-'));
  assert.ok(backup);
  assert.equal(fs.readFileSync(path.join(f.plugins, backup, 'previous/resource.txt'), 'utf8'), 'previous content');
  assert.equal(fs.readFileSync(f.solution, 'utf8'), 'solution sentinel');
});

test('rejects archive symlinks and lying zero-size DEFLATE entries without replacing the plugin', t => {
  const f = fixture(t); const dir = f.installed();
  const file = f.archive(); const zip = new AdmZip(file);
  zip.getEntry('resource.txt').attr = (0o120777 << 16) >>> 0;
  zip.writeZip(file);
  assert.throws(() => importPluginZipArtifact(file, f.plugins), /symlinks/);
  const bomb = f.archive(); const bytes = fs.readFileSync(bomb);
  for (const [signature, nameOffset, nameLengthOffset, sizeOffset] of [
    ['504b0102', 46, 28, 24], ['504b0304', 30, 26, 22],
  ]) {
    let at = 0;
    while ((at = bytes.indexOf(Buffer.from(signature, 'hex'), at)) !== -1) {
      const length = bytes.readUInt16LE(at + nameLengthOffset);
      if (bytes.subarray(at + nameOffset, at + nameOffset + length).toString() === 'resource.txt') bytes.writeUInt32LE(0, at + sizeOffset);
      at += nameOffset;
    }
  }
  fs.writeFileSync(bomb, bytes);
  assert.throws(() => importPluginZipArtifact(bomb, f.plugins));
  assert.equal(fs.readFileSync(path.join(dir, 'resource.txt'), 'utf8'), 'previous content');
  assert.deepEqual(fs.readdirSync(f.plugins), ['example']);
});

test('a crafted huge-size ZIP cannot allocate gigabytes before validation', t => {
  const f = fixture(t); const file = path.join(f.root, 'huge.zip');
  fs.writeFileSync(file, Buffer.from('UEsDBBQAAAAAAAAAAAAAAAAABQAAAAUAAAABAAAAYWhlbGxvUEsBAhQAFAAAAAAAAAAAAAAAAAAFAAAA4C7DaQEAAAAAAAAAAAAAAAAAAAAAAGFQSwUGAAAAAAEAAQAvAAAAJAAAAAAA', 'base64'));
  const child = spawnSync(process.execPath, ['--max-old-space-size=64', '-e',
    'const fs=require("node:fs"); const AdmZip=require("adm-zip"); const before=process.memoryUsage().rss; try {new AdmZip(process.argv[1]).getEntries()[0].getData();} catch {} if(process.memoryUsage().rss-before>32*1024*1024)process.exit(1);', file],
  { cwd: path.resolve(import.meta.dirname, '..'), timeout: 10_000, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr || String(child.error));
});
