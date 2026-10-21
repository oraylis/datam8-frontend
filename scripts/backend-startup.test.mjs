import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { waitForBackendReady, waitForBackendHealth } from '../apps/desktop/resources/backend-startup.cjs';
import { terminateChild } from '../apps/desktop/resources/backend-lifecycle.cjs';

test('readiness tolerates a slow first start, and awaits owned process shutdown on cancel', async () => {
  const proc = spawn(process.execPath, ['-e', 'setTimeout(()=>console.log(JSON.stringify({type:"ready",baseUrl:"http://localhost",version:"test"})),100); setInterval(()=>{},1000)'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  try {
    assert.equal((await waitForBackendReady(proc, 2000)).version, 'test');
  } finally { await terminateChild(proc); }
  const waiting = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const controller = new AbortController();
  const readiness = waitForBackendReady(waiting, 2000, controller.signal);
  controller.abort();
  await assert.rejects(readiness, /cancelled/);
  await terminateChild(waiting);
  assert.throws(() => process.kill(waiting.pid, 0));
});
test('exited process fails immediately instead of consuming startup budget', async () => {
  const proc = spawn(process.execPath, ['-e', 'process.exit(7)'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  await assert.rejects(waitForBackendReady(proc, 5000), /code=7/);
});
test('only the canonical readiness JSON on stdout establishes readiness', async () => {
  const proc = spawn(process.execPath, ['-e', 'console.error(JSON.stringify({type:"ready",baseUrl:"http://localhost",version:"test"})); console.log(JSON.stringify({baseUrl:"http://localhost",version:"test"})); setInterval(()=>{},1000)'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  try {
    await assert.rejects(waitForBackendReady(proc, 500), /timed out/);
  } finally { await terminateChild(proc); }
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
