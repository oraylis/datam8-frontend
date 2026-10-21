import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { assertDeveloperAccess, simulationChoice, examplePython, DeveloperSimulation } = require('../apps/desktop/dist/developerSimulation.js');
const { demoReleaseServer } = require('../apps/desktop/resources/dev-fixtures.cjs');
const { selectRelease } = require('../apps/desktop/resources/update-policy.cjs');
test('demo feed offers a newer release after package version changes and retains the current scenario', async () => {
  for (const [current, next] of [['2.1.0', '2.1.1'], ['4.12.99', '4.12.100'], ['2.1.0-beta.2', '2.1.1']]) {
    const server = demoReleaseServer(current);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}/releases`;
      const available = await (await fetch(base)).json();
      assert.equal(selectRelease(available, current, 'linux', 'x64').tag_name, `v${next}`);
      const unchanged = await (await fetch(`${base}?scenario=current`)).json();
      assert.equal(unchanged[0].tag_name, `v${current}`);
      assert.equal(selectRelease(unchanged, current, 'linux', 'x64'), null);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
});
test('packaged apps, foreign senders and shutdown cannot invoke developer operations', () => {
  const owner = {}; const state = { packaged: false, simulation: true, quitting: false };
  assert.doesNotThrow(() => assertDeveloperAccess(state, owner, owner, true));
  for (const blocked of [{ ...state, packaged: true }, { ...state, quitting: true }]) assert.throws(() => assertDeveloperAccess(blocked, owner, owner, true), /unavailable/);
  assert.throws(() => assertDeveloperAccess(state, {}, owner), /unavailable/);
  assert.throws(() => assertDeveloperAccess(state, undefined, undefined), /unavailable/);
  assert.throws(() => assertDeveloperAccess({ ...state, simulation: false }, owner, owner, true), /isolated/);
});
test('developer scenarios accept only predefined cases and force download exercises to Windows', () => {
  assert.deepEqual(simulationChoice('available', 'current'), { scenario: 'available', windows: false });
  assert.equal(simulationChoice('available', 'windows').windows, true);
  assert.equal(simulationChoice('slow', 'current').windows, true);
  assert.equal(simulationChoice('download-error', 'current').windows, true);
  for (const [scenario, system] of [['https://example.com', 'current'], ['available', 'https://example.com'], [null, 'windows'], [{ scenario: 'available' }, 'current']]) assert.throws(() => simulationChoice(scenario, system), /Invalid/);
});
test('missing Generator environment leaves example setup unavailable without creating files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 missing Generator '));
  try {
    assert.equal(examplePython(temp), undefined); assert.deepEqual(fs.readdirSync(temp), []);
    const interpreter = path.join(temp, 'submodules/datam8-generator/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    fs.mkdirSync(path.dirname(interpreter), { recursive: true }); fs.writeFileSync(interpreter, 'invalid interpreter');
    assert.equal(examplePython(temp), undefined);
  }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('concurrent opens during previous cleanup start exactly one fresh simulation', async () => {
  const service = new DeveloperSimulation('/unused-test-app');
  let finishCleanup; let starts = 0;
  service.session = { child: { exitCode: 0, signalCode: null, connected: false }, closed: new Promise(resolve => { finishCleanup = resolve; }) };
  service.start = async () => { starts++; };
  const first = service.open(); const second = service.open();
  assert.equal(starts, 0); finishCleanup(); await Promise.all([first, second]);
  assert.equal(starts, 1);
});
