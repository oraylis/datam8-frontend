import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../apps/desktop/package.json', import.meta.url));
const ts = require('typescript');
const { terminateChild } = require('./resources/backend-lifecycle.cjs');

// Watch completed compiler output, not individual emissions. Preload changes
// require the same orderly restart as main-process changes.
export function watchDesktop({ appDir = process.cwd(), executablePath = require('electron'), settleMs = 200, log = console.log } = {}) {
  appDir = path.resolve(appDir);
  const dist = path.join(appDir, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const resources = path.join(appDir, 'resources');
  const formatHost = { getCanonicalFileName: file => file, getCurrentDirectory: () => appDir, getNewLine: () => '\n' };
  let child, compiler, timer, stopping = false, canRun = false, pending = false, restarting, fingerprint;
  const watchers = [];

  function snapshot() {
    const hash = createHash('sha256');
    function visit(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile()) hash.update(path.relative(appDir, file)).update('\0').update(fs.readFileSync(file)).update('\0');
      }
    }
    visit(dist);
    if (fs.existsSync(resources)) visit(resources);
    hash.update(fs.readFileSync(path.join(appDir, 'package.json')));
    return hash.digest('hex');
  }

  async function stopChild(proc) {
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    if (!proc.connected) return terminateChild(proc, 20_000);
    // OS signals terminate immediately on Windows. Ask the owned Electron
    // process to finish backend/simulation cleanup before exiting instead.
    await new Promise((resolve, reject) => {
      let timer;
      const done = () => { clearTimeout(timer); resolve(); };
      proc.once('close', done);
      const force = () => {
        // The development app owns its own process group so Ctrl+C does not
        // kill Chromium helpers before application cleanup has run.
        try {
          if (process.platform === 'win32') {
            const killed = spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 3_000 });
            if (killed.error) throw killed.error;
          } else {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
          }
        } catch (error) { clearTimeout(timer); proc.off('close', done); reject(error); return; }
        void terminateChild(proc, 0).catch(error => { proc.off('close', done); reject(error); });
      };
      timer = setTimeout(force, 20_000);
      proc.send({ type: 'development:shutdown' }, error => { if (error) force(); });
    });
  }

  async function restart() {
    while (pending && !stopping && canRun) {
      pending = false;
      const next = snapshot();
      if (next === fingerprint) continue; // A second build can rewrite identical files.
      if (child) {
        log('[desktop-dev] Restarting Electron after completed changes.');
        await stopChild(child);
      }
      if (stopping || !canRun) return;
      fingerprint = snapshot(); // Include changes received while the previous app closed.
      log('[desktop-dev] Starting Electron.');
      const debugArgs = process.env.DATAM8_DEVELOPER_TEST_DEBUG === '1'
        ? ['--remote-debugging-port=0', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])]
        : [];
      child = spawn(executablePath, [...debugArgs, appDir], { cwd: appDir, detached: process.platform !== 'win32', stdio: ['inherit', 'inherit', 'inherit', 'ipc'], env: { ...process.env, DATAM8_MODE: 'electron', VITE_APP_MODE: 'electron' } });
      child.once('error', error => {
        console.error('[desktop-dev] Electron failed to start:', error.message);
        process.exitCode = 1;
        void close();
      });
      child.once('exit', (code, signal) => {
        if (!stopping && code) log(`[desktop-dev] Electron exited with code ${code}; waiting for a successful changed build.`);
        else if (!stopping && signal && signal !== 'SIGTERM') log(`[desktop-dev] Electron exited with signal ${signal}.`);
      });
    }
  }

  function schedule() {
    if (stopping) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      pending = true;
      if (restarting || !canRun) return;
      restarting = restart().catch(error => {
        console.error('[desktop-dev] Cannot restart safely:', error.message);
        process.exitCode = 1;
        void close();
      }).finally(() => {
        restarting = null;
        if (pending && canRun && !stopping) schedule();
      });
    }, settleMs);
  }

  const host = ts.createWatchCompilerHost(path.join(appDir, 'tsconfig.json'), { noEmitOnError: true }, ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    diagnostic => console.error(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatHost)),
    diagnostic => {
      if (diagnostic.code === 6031 || diagnostic.code === 6032) canRun = false;
      log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    });
  const watchFile = host.watchFile;
  host.watchFile = (file, callback, ...options) => watchFile(file, (...changes) => {
    // TypeScript has observed an actual input invalidation, but its build is
    // still debounced. Hold resource restarts until that build completes.
    canRun = false;
    clearTimeout(timer);
    callback(...changes);
  }, ...options);
  const afterProgramCreate = host.afterProgramCreate;
  host.afterProgramCreate = builder => {
    afterProgramCreate(builder);
    canRun = !ts.getPreEmitDiagnostics(builder.getProgram()).some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    if (canRun) schedule();
  };

  watchers.push(fs.watch(dist, { recursive: true }, schedule));
  if (fs.existsSync(resources)) watchers.push(fs.watch(resources, { recursive: true }, schedule));
  watchers.push(fs.watch(path.join(appDir, 'package.json'), schedule));
  compiler = ts.createWatchProgram(host);

  let closing;
  function close() {
    if (closing) return closing;
    stopping = true;
    clearTimeout(timer);
    compiler?.close();
    for (const watcher of watchers) watcher.close();
    closing = (async () => {
      await restarting;
      if (child) await stopChild(child);
    })();
    return closing;
  }
  return { close };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const development = watchDesktop();
  const shutdown = () => { void development.close().catch(error => { console.error(error.message); process.exitCode = 1; }); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
