import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { terminateChild } from '../apps/desktop/resources/backend-lifecycle.cjs';

const scriptPath = fileURLToPath(import.meta.url);
const webRoot = path.resolve(import.meta.dirname, '../apps/web');
const webRequire = createRequire(path.join(webRoot, 'package.json'));

// Keep Vite in its own process: readiness and shutdown use IPC, logs are only logs.
export function startVite({ cwd = webRoot, url = 'http://localhost:4320', env = process.env, stdio = ['inherit', 'inherit', 'inherit'], timeoutMs = 30_000 } = {}) {
  const child = spawn(process.execPath, [scriptPath], { cwd, env, stdio: [...stdio, 'ipc'] });
  const controller = new AbortController();
  let settled = false, closing, settle;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => settle(new Error(`Vite did not start within ${timeoutMs / 1000} seconds.`)), timeoutMs);
    settle = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      controller.abort();
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
      if (error) reject(error);
      else resolve();
    };
    const onError = error => settle(error);
    const onExit = (code, signal) => settle(new Error(`Vite exited before becoming ready (${signal || `code ${code}`}).`));
    const onMessage = message => {
      if (message?.type === 'vite:error') settle(new Error(message.message));
      if (message?.type !== 'vite:ready') return;
      child.off('message', onMessage);
      void (async () => {
        while (!settled) {
          try {
            const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(500)]) });
            await response.body?.cancel();
            if (response.ok) { settle(); return; }
          } catch { /* The owned Vite server may still be preparing its first response. */ }
          await sleep(100, undefined, { signal: controller.signal });
        }
      })().catch(error => settle(error));
    };
    child.on('message', onMessage);
    child.once('error', onError);
    child.once('exit', onExit);
  });

  function close() {
    if (!closing) closing = (async () => {
      settle(new Error('Vite startup cancelled.'));
      if (child.exitCode !== null || child.signalCode !== null) return;
      await new Promise((resolve, reject) => {
        const done = () => { clearTimeout(timer); resolve(); };
        const force = () => {
          clearTimeout(timer);
          void terminateChild(child, 0).then(done, reject);
        };
        const timer = setTimeout(force, 8_000);
        child.once('close', done);
        // A disconnected child may already be completing its own cleanup.
        if (child.connected) child.send({ type: 'vite:shutdown' }, () => {});
      });
    })();
    return closing;
  }
  return { child, ready, close };
}

async function runServer() {
  let server, stopping = false, closing, starting;
  function close() {
    stopping = true;
    if (!closing) closing = (async () => {
      await starting?.catch(() => {});
      await server?.close();
      if (process.connected) process.disconnect();
    })();
    return closing;
  }
  const shutdown = () => { void close().catch(error => { console.error(error); process.exitCode = 1; }); };
  process.on('message', message => { if (message?.type === 'vite:shutdown') shutdown(); });
  process.once('disconnect', shutdown);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  starting = (async () => {
    const { createServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
    if (stopping) return;
    server = await createServer({ root: process.cwd() });
    if (stopping) return;
    await server.listen();
    if (stopping) return;
    server.printUrls();
    server.bindCLIShortcuts({ print: true });
    if (process.connected) process.send({ type: 'vite:ready' }, error => { if (error) shutdown(); });
  })();
  try { await starting; }
  catch (error) {
    process.exitCode = 1;
    if (process.connected) await new Promise(resolve => process.send({ type: 'vite:error', message: error.message }, resolve));
    else console.error(error);
    await close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) await runServer();
