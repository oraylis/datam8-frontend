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
    try { proc.kill(); } catch (error) { clearTimeout(timer); proc.off('close', done); reject(error); }
  });
}
module.exports = { terminateChild };
