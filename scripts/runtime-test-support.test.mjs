import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertReportOutsideRuntime, assertRuntimeUnchanged, selectRuntimePython, snapshotRuntime } from './runtime-test-support.mjs';

test('runtime integrity detects same-size edits, new bytecode, deletions and changed links', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'Runtime integrity '));
  try {
    const file = path.join(root, 'module.py');
    fs.writeFileSync(file, 'first');
    const before = snapshotRuntime(root);
    fs.writeFileSync(file, 'other');
    assert.throws(() => assertRuntimeUnchanged(before, snapshotRuntime(root)), /module.py/);
    fs.writeFileSync(file, 'first');
    assertRuntimeUnchanged(before, snapshotRuntime(root));
    fs.writeFileSync(path.join(root, 'module.pyc'), 'bytecode');
    assert.throws(() => assertRuntimeUnchanged(before, snapshotRuntime(root)), /module.pyc/);
    fs.rmSync(path.join(root, 'module.pyc'));
    fs.rmSync(file);
    assert.throws(() => assertRuntimeUnchanged(before, snapshotRuntime(root)), /module.py/);
    if (process.platform !== 'win32') {
      fs.symlinkSync('first', file);
      const linked = snapshotRuntime(root);
      fs.unlinkSync(file); fs.symlinkSync('other', file);
      assert.throws(() => assertRuntimeUnchanged(linked, snapshotRuntime(root)), /module.py/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('runtime selection cannot substitute a host interpreter or escaping symlink', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'Runtime selection '));
  try {
    const runtime = path.join(root, 'python-runtime');
    fs.mkdirSync(path.join(runtime, 'bin'), { recursive: true });
    const file = path.join(runtime, 'bin', 'python3'); fs.writeFileSync(file, 'runtime');
    const host = path.join(root, 'host-python'); fs.writeFileSync(host, 'host');
    assert.equal(selectRuntimePython(runtime, undefined, 'darwin'), file);
    assert.throws(() => selectRuntimePython(runtime, host), /inside the selected runtime/);
    if (process.platform !== 'win32') {
      fs.rmSync(file); fs.symlinkSync(host, file);
      assert.throws(() => selectRuntimePython(runtime, undefined, 'darwin'), /inside the selected runtime/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('report output cannot modify the runtime through a directory symlink', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'Runtime report '));
  try {
    const runtime = path.join(root, 'python-runtime'); fs.mkdirSync(runtime);
    assertReportOutsideRuntime(runtime, path.join(root, 'results', 'report.json'));
    assert.throws(() => assertReportOutsideRuntime(runtime, path.join(runtime, 'report.json')), /outside the runtime/);
    if (process.platform !== 'win32') {
      const alias = path.join(root, 'alias'); fs.symlinkSync(runtime, alias);
      assert.throws(() => assertReportOutsideRuntime(runtime, path.join(alias, 'report.json')), /outside the runtime/);
      const file = path.join(root, 'linked-report.json'); fs.symlinkSync(path.join(runtime, 'new-report.json'), file);
      assert.throws(() => assertReportOutsideRuntime(runtime, file), /symbolic link/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('POSIX pruning keeps native libraries, runtime metadata and unrelated resources', () => {
  const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-B', '-c', `
import runpy, sys, tempfile
from pathlib import Path
prune = runpy.run_path(sys.argv[1])['prune_posix_development']
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    stdlib = root / 'lib/python3.12'
    removed = ['include/python.h', 'share/man/python.1', 'lib/tcl9.0/init.tcl',
               'lib/tk9.0/tk.tcl', 'bin/idle3', 'bin/python3-config',
               'lib/python3.12/config-build/python.o', 'lib/python3.12/lib-dynload/_tkinter.test.so']
    kept = ['lib/libtcl9.0.so', 'bin/python3', 'share/terminfo/data',
            'lib/python3.12/site-packages/example.dist-info/licenses/LICENSE',
            'lib/python3.12/site-packages/example/resource.txt']
    for name in removed + kept:
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text('fixture')
    prune(root, stdlib)
    assert all(not (root / name).exists() for name in removed)
    assert all((root / name).is_file() for name in kept)
`, path.join(import.meta.dirname, 'prepare-python-runtime.py')], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
});

test('package pruning preserves runtime payload and ZIP guards reject native files on every platform', () => {
  const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-B', '-c', `
import runpy, sys, tempfile, zipfile
from pathlib import Path
helpers = runpy.run_path(sys.argv[1])
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    removed = ['Crypto/SelfTest/test_cipher.py', 'example/kernel.cc', 'example/kernel.cxx',
               'example/interface.hh', 'example/interface.hxx']
    kept = ['Crypto/Cipher/native.so', 'example/native.pyd', 'example/native.DLL',
            'example/module.py', 'example/resource.json', 'example/testing/helpers.py',
            'example.dist-info/METADATA', 'example.dist-info/entry_points.txt',
            'example.dist-info/licenses/original.cc', 'example/LICENSE/original.hxx']
    for name in removed + kept:
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text('fixture')
    helpers['prune_package_development'](root)
    assert all(not (root / name).exists() for name in removed)
    assert all((root / name).is_file() for name in kept)
    for suffix in ['.so', '.pyd', '.DLL', '.SO', '.dylib']:
        candidate = root / 'pure'
        candidate.mkdir(exist_ok=True)
        native = candidate / ('native' + suffix)
        native.write_text('native')
        try:
            helpers['require_pure_package'](candidate)
        except RuntimeError:
            pass
        else:
            raise AssertionError('Accepted native extension ' + suffix)
        native.unlink()
    (candidate / '__init__.py').write_text('value = 1')
    (candidate / 'resource.txt').write_text('retained resource')
    helpers['require_pure_package'](candidate)
    helpers['archive_paths'](root, [candidate], root / 'pure.zip')
    with zipfile.ZipFile(root / 'pure.zip') as archive:
        assert archive.read('pure/__init__.py') == b'value = 1'
        assert archive.read('pure/resource.txt') == b'retained resource'
        assert 'pure/__init__.pyc' in archive.namelist()
    assert not candidate.exists()
`, path.join(import.meta.dirname, 'prepare-python-runtime.py')], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
});
