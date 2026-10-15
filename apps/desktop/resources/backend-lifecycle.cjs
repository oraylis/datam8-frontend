const { spawnSync } = require('node:child_process');
async function terminateChild(proc, graceMs = 8_000) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    let timer;
    const done = () => { clearTimeout(timer); resolve(); };
    proc.once('close', done);
    timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* close may already be queued */ }
      timer = setTimeout(() => {
        proc.off('close', done);
        reject(new Error('Backend did not terminate; refusing to reuse its port'));
      }, 3_000);
    }, graceMs);
    try {
      if (process.platform === 'win32') {
        // Venv/uv launchers own another Python process; stop only this child tree.
        const result = spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        if (result.error) throw result.error;
      } else proc.kill();
    } catch (error) { clearTimeout(timer); proc.off('close', done); reject(error); }
  });
}
module.exports = { terminateChild };
