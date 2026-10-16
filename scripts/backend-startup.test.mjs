import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { waitForBackendReady, waitForBackendHealth } from '../apps/desktop/resources/backend-startup.cjs';
import { terminateChild } from '../apps/desktop/resources/backend-lifecycle.cjs';

const parse = line => { try { return JSON.parse(line); } catch { return null; } };
test('readiness tolerates a slow first start, and awaits owned process shutdown on cancel', async () => {
  const proc = spawn(process.execPath, ['-e', 'setTimeout(()=>console.log(JSON.stringify({baseUrl:"http://localhost",version:"test"})),100); setInterval(()=>{},1000)'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  try {
    assert.equal((await waitForBackendReady(proc, parse, 2000)).version, 'test');
  } finally { await terminateChild(proc); }
  const waiting = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const controller = new AbortController();
  const readiness = waitForBackendReady(waiting, parse, 2000, controller.signal);
  controller.abort();
  await assert.rejects(readiness, /cancelled/);
  await terminateChild(waiting);
  assert.throws(() => process.kill(waiting.pid, 0));
});
test('exited process fails immediately instead of consuming startup budget', async () => {
  const proc = spawn(process.execPath, ['-e', 'process.exit(7)'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  await assert.rejects(waitForBackendReady(proc, parse, 5000), /code=7/);
});
test('hung health request is bounded by the overall deadline', async () => {
  const server = createServer(() => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const started = Date.now();
  try {
    await assert.rejects(waitForBackendHealth(`http://127.0.0.1:${server.address().port}`, 'test', 100), /timed out/);
    assert.ok(Date.now() - started < 2000);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
