import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { terminateChild } from '../apps/desktop/resources/backend-lifecycle.cjs';
async function child(code) {
  const proc = spawn(process.execPath, ['-e', `${code}; console.log('ready'); setInterval(()=>{}, 1000)`], { stdio: ['ignore', 'pipe', 'pipe'] });
  await once(proc.stdout, 'data');
  return proc;
}
test('waits for backend exit before returning its port to the next solution', async () => {
  const proc = await child("process.on('SIGTERM', () => setTimeout(() => process.exit(0), 100))");
  try {
    let closed = false; proc.once('close', () => { closed = true; });
    await terminateChild(proc);
    assert.equal(closed, true);
    if (process.platform !== 'win32') assert.equal(proc.exitCode, 0);
    assert.throws(() => process.kill(proc.pid, 0));
  } finally { if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL'); }
});
test('terminates a backend that ignores shutdown', async () => {
  const proc = await child("process.on('SIGTERM', () => {})");
  try {
    await terminateChild(proc, 50);
    assert.throws(() => process.kill(proc.pid, 0));
  } finally { if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL'); }
});

test('Windows termination includes the owned launcher child', { skip: process.platform !== 'win32' }, async () => {
  const proc = spawn(process.execPath, ['-e', "const nested = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], { stdio: 'inherit' }); nested.once('spawn', () => process.send(nested.pid)); setInterval(()=>{}, 1000)"], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  const [pid] = await once(proc, 'message');
  try {
    await terminateChild(proc);
    assert.throws(() => process.kill(proc.pid, 0));
    assert.throws(() => process.kill(pid, 0));
  } finally { if (proc.exitCode === null && proc.signalCode === null) await terminateChild(proc); }
});
