import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { startVite } from './dev-vite.mjs';
import { unusedLoopbackPort } from './test-port.mjs';

async function fixture(extraConfig = '') {
  // Resolve Windows 8.3 temp aliases before passing paths to Vite's watcher.
  const tempRoot = fs.realpathSync.native(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(tempRoot, 'DataM8 Vite IPC '));
  assert.equal(path.dirname(directory), tempRoot);
  const port = await unusedLoopbackPort();
  fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(directory, 'index.html'), '<h1>Owned Vite fixture</h1>');
  fs.writeFileSync(path.join(directory, 'vite.config.mjs'), `export default {
    server: { host: '127.0.0.1', port: ${port}, strictPort: true },
    clearScreen: false, ${extraConfig}
  };`);
  const url = `http://127.0.0.1:${port}`;
  let output = '';
  const start = options => {
    const env = { ...process.env, CI: 'true', VITE_APP_MODE: 'electron' };
    delete env.NO_COLOR;
    const vite = startVite({ cwd: directory, url, env, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    vite.child.stdout.on('data', chunk => { output += chunk; });
    vite.child.stderr.on('data', chunk => { output += chunk; });
    return vite;
  };
  return { directory, port, url, start, output: () => output, remove: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

for (const colored of [true, false]) test(`starts through IPC with ${colored ? 'colored' : 'plain'} output and closes through IPC`, async () => {
  const f = await fixture();
  const vite = f.start({ env: { ...process.env, CI: 'true', VITE_APP_MODE: 'electron', NO_COLOR: colored ? undefined : '1', FORCE_COLOR: colored ? '1' : undefined } });
  try {
    await vite.ready;
    assert.equal(vite.child.exitCode, null);
    assert.match(await (await fetch(f.url)).text(), /Owned Vite fixture/);
    // stdout still carries normal Vite output, but readiness never parses it.
    await Promise.all([vite.close(), vite.close()]);
    assert.equal(vite.child.exitCode, 0, f.output());
    assert.match(f.output(), /Local/);
    if (colored) assert.match(f.output(), /\u001b\[/);
    else assert.doesNotMatch(f.output(), /\u001b\[/);
    await assert.rejects(fetch(f.url));
  } catch (error) { error.message += `\n${f.output()}`; throw error; }
  finally { await vite.close(); f.remove(); }
});

test('rejects a port collision even if the existing server returns HTTP 200', async () => {
  const f = await fixture();
  const other = http.createServer((request, response) => response.end('unrelated server'));
  await new Promise(resolve => other.listen(f.port, '127.0.0.1', resolve));
  const vite = f.start();
  try {
    await assert.rejects(vite.ready, /already in use/);
    await vite.close();
    assert.equal(vite.child.exitCode, 1);
    assert.equal(await (await fetch(f.url)).text(), 'unrelated server');
  } finally {
    await vite.close();
    await new Promise(resolve => other.close(resolve));
    f.remove();
  }
});

test('reports config errors before readiness', async () => {
  const f = await fixture();
  fs.writeFileSync(path.join(f.directory, 'vite.config.mjs'), 'throw new Error("fixture config failed");');
  const vite = f.start();
  try {
    await assert.rejects(vite.ready, /fixture config failed/);
    await vite.close();
    assert.equal(vite.child.exitCode, 1);
  } finally { await vite.close(); f.remove(); }
});

test('keeps checking HTTP after IPC readiness and times out on unsuccessful responses', async () => {
  const f = await fixture(`plugins: [{ name: 'unavailable-probe', configureServer(server) {
    server.middlewares.use('/probe', (request, response) => { response.statusCode = 503; response.end(); });
  } }]`);
  const vite = f.start({ url: `${f.url}/probe`, timeoutMs: 4_000 });
  try {
    const [message] = await once(vite.child, 'message');
    assert.equal(message.type, 'vite:ready');
    await assert.rejects(vite.ready, /Vite did not start within 4 seconds/);
    await vite.close();
    assert.equal(vite.child.exitCode, 0);
    await assert.rejects(fetch(f.url));
  } finally { await vite.close(); f.remove(); }
});

test('cancels startup and cleans up when closed before readiness', async () => {
  const f = await fixture();
  const vite = f.start();
  const rejected = assert.rejects(vite.ready, /startup cancelled/);
  try {
    await Promise.all([vite.close(), vite.close(), rejected]);
    assert.equal(vite.child.exitCode, 0, f.output());
    await assert.rejects(fetch(f.url));
  } finally { await vite.close(); f.remove(); }
});

test('times out before IPC readiness and cleans up the pending start', async () => {
  const f = await fixture();
  fs.appendFileSync(path.join(f.directory, 'vite.config.mjs'), '\nawait new Promise(resolve => setTimeout(resolve, 500));\n');
  const vite = f.start({ timeoutMs: 100 });
  try {
    await assert.rejects(vite.ready, /Vite did not start within 0.1 seconds/);
    await vite.close();
    assert.equal(vite.child.exitCode, 0);
    await assert.rejects(fetch(f.url));
  } finally { await vite.close(); f.remove(); }
});

test('closes the server when its launcher IPC channel disappears', async () => {
  const f = await fixture();
  const vite = f.start();
  try {
    await vite.ready;
    const exited = once(vite.child, 'exit');
    vite.child.disconnect();
    await exited;
    assert.equal(vite.child.exitCode, 0, f.output());
    await assert.rejects(fetch(f.url));
  } finally { await vite.close(); f.remove(); }
});
