import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildPythonEnv, shouldAutoUpdate } from '../apps/desktop/resources/backend-env.cjs';
const root = path.resolve('runtime with spaces');
test('bundled Python ignores host Python configuration and cannot write into its signed bundle', () => {
  const dirty = { PYTHONHOME: '/host', PYTHONPATH: '/host/modules', PYTHONUSERBASE: '/host/user', VIRTUAL_ENV: '/host/venv', CONDA_PREFIX: '/host/conda', PATH: '/usr/bin' };
  const env = buildPythonEnv(path.join(root, 'bin/python3'), root, dirty, 'darwin');
  assert.equal(env.PYTHONHOME, root);
  assert.equal(env.PYTHONPATH, undefined);
  assert.equal(env.VIRTUAL_ENV, undefined);
  assert.equal(env.CONDA_PREFIX, undefined);
  assert.equal(env.PYTHONUSERBASE, undefined);
  assert.equal(env.PYTHONDONTWRITEBYTECODE, '1');
  assert.equal(env.PYTHONNOUSERSITE, '1');
  assert.equal(env.PATH, dirty.PATH);
  assert.equal(dirty.PYTHONHOME, '/host');
});
test('explicit external interpreter preserves development configuration', () => {
  const env = buildPythonEnv(path.resolve('external/bin/python'), root, { PYTHONHOME: '/dev', PYTHONPATH: '/dev/modules' }, 'darwin');
  assert.equal(env.PYTHONHOME, '/dev');
  assert.equal(env.PYTHONPATH, '/dev/modules');
});
test('Windows uses the native keyring and does not inherit a host PYTHONHOME', () => {
  const env = buildPythonEnv(path.join(root, 'python.exe'), root, { PYTHONHOME: '/host' }, 'win32');
  assert.equal(env.PYTHONHOME, undefined);
  assert.equal(env.PYTHON_KEYRING_BACKEND, 'keyring.backends.Windows.WinVaultKeyring');
});
test('only packaged Windows builds can update, and tests can disable them', () => {
  assert.equal(shouldAutoUpdate(true, 'win32', {}), true);
  assert.equal(shouldAutoUpdate(true, 'win32', { DATAM8_DISABLE_AUTO_UPDATES: '1' }), false);
  assert.equal(shouldAutoUpdate(false, 'win32', {}), false);
  assert.equal(shouldAutoUpdate(true, 'darwin', {}), false);
  assert.equal(shouldAutoUpdate(true, 'linux', {}), false);
});
