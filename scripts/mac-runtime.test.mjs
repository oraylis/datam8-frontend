import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checked, validateMacBinaries } from './mac-runtime.mjs';
test('reject host dylibs, wrong architecture and escaping links after relocation', { skip: process.platform !== 'darwin' }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 portability regression '));
  try {
    const root = path.join(temp, 'bundle'); fs.mkdirSync(root);
    const library = path.join(temp, 'external.dylib');
    const source = path.join(temp, 'source.c'); fs.writeFileSync(source, 'int answer(void) {return 42;}');
    checked('xcrun', ['clang', '-dynamiclib', source, '-install_name', library, '-o', library]);
    fs.writeFileSync(source, 'extern int answer(void); int main(void) {return answer()==42 ? 0 : 1;}');
    const binary = path.join(root, 'helper (test)');
    checked('xcrun', ['clang', source, library, '-o', binary]);
    assert.throws(() => validateMacBinaries(root), /unresolved\/external/);
    const local = path.join(root, 'portable.dylib'); fs.copyFileSync(library, local);
    checked('install_name_tool', ['-change', library, '@loader_path/portable.dylib', binary]);
    fs.symlinkSync('helper (test)', path.join(root, 'alias'));
    validateMacBinaries(root);
    const copy = path.join(temp, 'Relocated bundle'); checked('ditto', [root, copy]); validateMacBinaries(copy);
    assert.throws(() => validateMacBinaries(copy, process.arch === 'arm64' ? 'x64' : 'arm64'), /Wrong architecture/);
    fs.symlinkSync(library, path.join(copy, 'escape'));
    assert.throws(() => validateMacBinaries(copy), /External symlink/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
