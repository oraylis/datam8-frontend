import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'apps/web/package.json'));
const { chromium, expect } = require('@playwright/test');
const tempRoot = fs.realpathSync.native(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, 'DataM8 desktop launch '));
if (path.dirname(profile) !== tempRoot) throw new Error('Unexpected temporary profile path');
const diagnostics = path.join(root, 'artifacts/desktop-dev-results');
fs.mkdirSync(diagnostics, { recursive: true });
const logs = [], failedFonts = [], externalFonts = [], fonts = [], rendererErrors = [];
let launcher, exited, browser, page, shutdownTimer;

async function stopLauncher() {
  if (!launcher || launcher.exitCode !== null || launcher.signalCode !== null) return;
  // The development test flag makes EOF request the launcher's normal cleanup.
  launcher.stdin.end();
  try {
    await Promise.race([exited, new Promise((_, reject) => {
      shutdownTimer = setTimeout(() => reject(new Error('Desktop launcher did not shut down')), 25_000);
    })]);
  } finally { clearTimeout(shutdownTimer); }
}

try {
  if (!process.env.npm_execpath) throw new Error('Run this check with npm run test:desktop:dev');
  let runningVite = false;
  try { runningVite = (await fetch('http://localhost:4320', { signal: AbortSignal.timeout(500) })).ok; } catch { /* unused port */ }
  if (runningVite) throw new Error('Stop the existing development launcher on port 4320 before this check');
  console.log('Starting npm run dev:desktop');
  const env = { ...process.env, CI: 'false', FORCE_COLOR: '1', DATAM8_DEVELOPER_TEST_DEBUG: '1',
    DATAM8_UPDATE_TEST_PROFILE: profile, DATAM8_UPDATE_TEST_FEED: 'http://127.0.0.1:1/feed', DATAM8_UPDATE_TEST_RELEASES: 'http://127.0.0.1:1/releases' };
  delete env.NO_COLOR;
  launcher = spawn(process.execPath, [process.env.npm_execpath, 'run', 'dev:desktop'], {
    cwd: root, env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
  });
  exited = new Promise(resolve => launcher.once('exit', resolve));
  let launchError;
  launcher.once('error', error => { launchError = error; });
  launcher.stdout.on('data', chunk => logs.push(String(chunk)));
  launcher.stderr.on('data', chunk => logs.push(String(chunk)));
  const deadline = Date.now() + 60_000;
  let endpoint;
  while (!(endpoint = logs.join('').match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1])) {
    if (launchError) throw launchError;
    if (launcher.exitCode !== null) throw new Error(`Desktop launcher exited with ${launcher.exitCode}:\n${logs.join('')}`);
    if (Date.now() >= deadline) throw new Error(`Electron did not start within 60 seconds:\n${logs.join('')}`);
    await sleep(100);
  }
  browser = await chromium.connectOverCDP(endpoint);
  await expect.poll(() => browser.contexts()[0].pages().some(candidate => candidate.url().startsWith('http://localhost:4320')), { timeout: 30_000 }).toBe(true);
  page = browser.contexts()[0].pages().find(candidate => candidate.url().startsWith('http://localhost:4320'));
  page.on('pageerror', error => rendererErrors.push(error.message));
  page.on('request', request => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url());
  });
  page.on('response', response => {
    if (/\.woff2?(?:\?|$)/.test(response.url())) {
      fonts.push({ url: response.url(), status: response.status() });
      if (!response.ok()) failedFonts.push(response.url());
    }
  });
  page.on('requestfailed', request => { if (/woff|fontsource/.test(request.url())) failedFonts.push(request.url()); });
  page.on('console', message => { if (message.type() === 'error' && /font|woff|manrope/i.test(message.text())) failedFonts.push(message.text()); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await expect(page.getByTitle('Open', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('load');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTitle('Open', { exact: true })).toBeVisible({ timeout: 30_000 });
  console.log('Editor rendered; checking local Manrope font weights');
  const faces = await page.evaluate(async () => {
    const result = [];
    for (const weight of [400, 500, 600, 700]) {
      const loaded = await document.fonts.load(`${weight} 14px Manrope`, 'DataM8 ÄÖÜäöüß');
      result.push({ weight, count: loaded.length, states: loaded.map(face => face.status) });
    }
    return result;
  });
  for (const face of faces) {
    expect(face.count).toBeGreaterThan(0);
    expect(face.states.every(state => state === 'loaded')).toBe(true);
  }
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every(font => new URL(font.url).origin === 'http://localhost:4320')).toBe(true);
  expect(failedFonts).toEqual([]);
  expect(externalFonts).toEqual([]);
  expect(rendererErrors).toEqual([]);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
  await page.screenshot({ path: path.join(diagnostics, 'startup.png') });
  fs.writeFileSync(path.join(diagnostics, 'fonts.json'), JSON.stringify({ nodeVersion: process.version, faces, fonts, viewport }, null, 2));
  console.log('All four font weights loaded locally; checking launcher shutdown');
  await stopLauncher();
  expect(launcher.exitCode).toBe(0);
  await expect.poll(async () => {
    try { await fetch('http://localhost:4320', { signal: AbortSignal.timeout(500) }); return false; } catch { return true; }
  }).toBe(true);
  console.log('PASS: npm run dev:desktop renders the editor, loads four local Manrope weights and shuts down cleanly');
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(diagnostics, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await stopLauncher().catch(() => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(launcher.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else { try { process.kill(-launcher.pid, 'SIGKILL'); } catch { /* already exited */ } }
  });
  await browser?.close().catch(() => {});
  fs.writeFileSync(path.join(diagnostics, 'test.log'), logs.join('').replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]'));
  await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
