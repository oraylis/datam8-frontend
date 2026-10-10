import { spawn } from 'node:child_process';
import { terminateChild } from '../apps/desktop/resources/backend-lifecycle.cjs';

export async function waitForJson(baseUrl, route, token, alive = () => {}, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let detail;
  while (Date.now() < deadline) {
    alive();
    try {
      const response = await fetch(`${baseUrl}${route}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return response.status === 204 ? {} : await response.json();
      detail = `HTTP ${response.status}`;
    } catch (error) { detail = error.message; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${route} did not become ready: ${detail}`);
}

// Both source-backend gates and installed-runtime smoke checks own their child
// process and await its exit before removing the disposable solution.
export async function withBackend(command, args, options, baseUrl, token, verify) {
  const backend = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '', startError;
  const append = chunk => { if (output.length < 16_384) output += String(chunk).slice(0, 16_384 - output.length); };
  backend.stdout.on('data', append);
  backend.stderr.on('data', append);
  backend.once('error', error => { startError = error; });
  try {
    await waitForJson(baseUrl, '/health', token, () => {
      if (startError) throw startError;
      if (backend.exitCode !== null || backend.signalCode !== null) throw new Error(`Backend exited before readiness: ${backend.exitCode ?? backend.signalCode}`);
    });
    return await verify(baseUrl);
  } catch (error) {
    const preview = output.replace(/(--token[\s=]+|Bearer\s+)[^\s"']+/gi, '$1[redacted]');
    throw new Error(`${error.message}\nBackend output:\n${preview}`, { cause: error });
  } finally { await terminateChild(backend); }
}
