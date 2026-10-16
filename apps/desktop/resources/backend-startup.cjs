const { setTimeout: delay } = require('node:timers/promises');

function waitForBackendReady(proc, parseReadyLine, timeoutMs = 60_000, signal) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', preview = '';
    const finish = (error, result) => {
      clearTimeout(timer);
      proc.stdout.off('data', onStdout); proc.stderr.off('data', onStderr);
      proc.off('exit', onExit); proc.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
      error ? reject(error) : resolve(result);
    };
    const onAbort = () => finish(new Error('Backend startup cancelled.'));
    const onError = error => finish(error);
    const onExit = (code, sig) => finish(new Error(`Backend exited before readiness. code=${code} signal=${sig}\n${preview}`));
    const consume = (buffer, chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      const remaining = lines.pop();
      for (const line of lines) {
        const ready = parseReadyLine(line.trim());
        if (ready) { finish(null, ready); break; }
      }
      return remaining;
    };
    const onStdout = chunk => { stdout = consume(stdout, chunk); };
    const onStderr = chunk => { preview = (preview + chunk).slice(-4096); stderr = consume(stderr, chunk); };
    const timer = setTimeout(() => finish(new Error(`Backend startup timed out after ${timeoutMs}ms`)), Math.max(1, timeoutMs));
    proc.stdout.on('data', onStdout); proc.stderr.on('data', onStderr);
    proc.once('exit', onExit); proc.once('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    else if (proc.exitCode !== null || proc.signalCode !== null) onExit(proc.exitCode, proc.signalCode);
  });
}

async function waitForBackendHealth(baseUrl, token, timeoutMs = 60_000, signal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const requestSignal = AbortSignal.timeout(Math.max(1, Math.min(2000, deadline - Date.now())));
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: signal ? AbortSignal.any([signal, requestSignal]) : requestSignal,
      });
      if (response.ok) return;
    } catch { signal?.throwIfAborted(); }
    await delay(Math.min(200, Math.max(1, deadline - Date.now())), undefined, { signal });
  }
  throw new Error(`Backend health timed out after ${timeoutMs}ms`);
}

module.exports = { waitForBackendReady, waitForBackendHealth };
