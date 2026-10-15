import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { expect, _electron, chromium } from '@playwright/test';
import { unusedLoopbackPort } from './test-port.mjs';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'apps/desktop/package.json'));
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 update UI '));
const diagnostics = path.join(root, 'artifacts/desktop-update-ui-results');
fs.mkdirSync(diagnostics, { recursive: true });
let vite, parent, orphanParent, app, browser, inspector, page;
let simulationRoot;
const logs = [];
async function waitForVite() {
  for (let i = 0; i < 100; i++) {
    if (vite.exitCode !== null) throw new Error('Vite failed to start; port 4320 may already be in use.');
    try { if ((await fetch('http://localhost:4320')).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Vite did not start');
}
async function developmentPage(electronApp) {
  await electronApp.firstWindow();
  await expect.poll(() => electronApp.windows().some(candidate => candidate.url().startsWith('http://localhost:4320')), { timeout: 30_000 }).toBe(true);
  const frontend = electronApp.windows().find(candidate => candidate.url().startsWith('http://localhost:4320'));
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.closeDevTools());
  return frontend;
}
try {
  const env = { ...process.env, VITE_APP_MODE: 'electron', DATAM8_DEVELOPER_TEST_DEBUG: '1', DATAM8_BACKEND_TEST_PORT: await unusedLoopbackPort() };
  const python = path.join(root, 'submodules/datam8-generator/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (fs.existsSync(python)) env.DATAM8_PYTHON_PATH = python;
  let existingVite = false;
  try { existingVite = (await fetch('http://localhost:4320/src/features/developer/DeveloperTools.tsx')).ok; } catch { /* no development server */ }
  if (!existingVite) {
    vite = spawn(process.execPath, [path.join(path.dirname(webRequire.resolve('vite/package.json')), 'bin/vite.js')], { cwd: path.join(root, 'apps/web'), env, stdio: ['ignore', 'pipe', 'pipe'] });
    vite.stdout.on('data', chunk => logs.push(String(chunk))); vite.stderr.on('data', chunk => logs.push(String(chunk)));
    await waitForVite();
  }
  parent = await _electron.launch({ executablePath: require('electron'), args: [path.join(root, 'apps/desktop'), `--user-data-dir=${path.join(temp, 'Parent profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], env, timeout: 60_000 });
  parent.process().stderr?.on('data', chunk => logs.push(String(chunk)));
  parent.process().stdout?.on('data', chunk => logs.push(String(chunk)));
  const parentPage = await developmentPage(parent);
  await expect(parentPage.getByTitle('Open', { exact: true })).toBeVisible({ timeout: 60_000 });
  await parentPage.evaluate(() => localStorage.setItem('developer-parent-state', 'preserved'));
  await parent.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'Developer').submenu.items.find(item => item.label === 'Developer Tools…').click());
  await expect(parentPage.getByRole('complementary', { name: 'Developer tools' })).toBeVisible();
  await expect(parentPage.getByRole('dialog')).toHaveCount(0);
  await expect(parentPage.getByRole('button', { name: 'Open Update Simulation' })).toBeVisible();
  await expect(parentPage.evaluate(() => window.desktop.developer.runUpdateScenario('available', 'current'))).rejects.toThrow('isolated');
  await parentPage.getByRole('button', { name: 'Open Update Simulation' }).click();
  await Promise.all([parentPage.evaluate(() => window.desktop.developer.openUpdateSimulation()), parentPage.evaluate(() => window.desktop.developer.openUpdateSimulation())]);
  const childInfo = () => parent.evaluate(() => process._getActiveHandles().filter(handle => handle.constructor.name === 'ChildProcess').map(child => ({ pid: child.pid, args: child.spawnargs })).filter(child => child.args.some(arg => String(arg).includes('DataM8 update simulation'))));
  await expect.poll(async () => (await childInfo()).length).toBe(1);
  const firstChild = (await childInfo())[0];
  simulationRoot = path.dirname(firstChild.args.find(arg => arg.startsWith('--user-data-dir=')).slice('--user-data-dir='.length));
  await expect.poll(() => logs.join('\n').includes('[update-sandbox]')).toBe(true);
  const endpoints = async () => {
    await expect.poll(() => /\[update-sandbox\] Debugger listening on (ws:\/\/[^\s]+)/.test(logs.join('\n'))).toBe(true);
    await expect.poll(() => /\[update-sandbox\]\s*DevTools listening on (ws:\/\/[^\s]+)/.test(logs.join('\n'))).toBe(true);
    return { node: logs.join('\n').match(/\[update-sandbox\] Debugger listening on (ws:\/\/[^\s]+)/)[1], browser: logs.join('\n').match(/\[update-sandbox\]\s*DevTools listening on (ws:\/\/[^\s]+)/)[1] };
  };
  const address = await endpoints();
  inspector = new WebSocket(address.node);
  await new Promise((resolve, reject) => { inspector.addEventListener('open', resolve, { once: true }); inspector.addEventListener('error', reject, { once: true }); });
  let nextId = 1; const pending = new Map();
  inspector.addEventListener('message', event => { const message = JSON.parse(String(event.data)); if (pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
  app = { evaluate: async (fn, arg) => {
    const expression = `(${fn.toString()})(process.mainModule.require('electron'), ${JSON.stringify(arg) || 'undefined'})`;
    const id = nextId++;
    const response = await new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); inspector.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })); });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result?.value;
  } };
  browser = await chromium.connectOverCDP(address.browser, { noDefaults: true });
  page = browser.contexts()[0].pages().find(candidate => candidate.url().startsWith('http://localhost:4320')) || browser.contexts()[0].pages()[0];
  await expect(page.getByRole('heading', { name: 'Update Simulation', exact: true })).toBeVisible();
  expect(fs.realpathSync(await app.evaluate(({ app }) => app.getPath('userData')))).toBe(fs.realpathSync(path.join(simulationRoot, 'Profile')));
  expect(fs.realpathSync(await parent.evaluate(({ app }) => app.getPath('userData')))).toBe(fs.realpathSync(path.join(temp, 'Parent profile')));
  await parentPage.getByRole('button', { name: 'Open Update Simulation' }).click();
  await expect.poll(async () => (await childInfo())[0]?.pid).toBe(firstChild.pid);
  expect(await parentPage.evaluate(() => localStorage.getItem('developer-parent-state'))).toBe('preserved');
  expect(await app.evaluate(() => process.env.DATAM8_BACKEND_TEST_PORT)).not.toBe(env.DATAM8_BACKEND_TEST_PORT);
  await expect(page.evaluate(() => window.desktop.developer.runUpdateScenario('invalid', 'current'))).rejects.toThrow('Invalid');
  // Only native dialog answers are substituted. UI, preload, IPC, release HTTP,
  // backend persistence and update controller all run unchanged.
  await app.evaluate(({ dialog, shell, BrowserWindow }) => {
    globalThis.__updateDialogs = []; globalThis.__updateLinks = []; globalThis.__confirmInstall = false;
    globalThis.__download = false; globalThis.__openRelease = false;
    globalThis.__progress = [];
    const progress = BrowserWindow.prototype.setProgressBar;
    BrowserWindow.prototype.setProgressBar = function (value) { globalThis.__progress.push(value); return progress.call(this, value); };
    dialog.showMessageBox = async (...args) => {
      const options = args.at(-1); globalThis.__updateDialogs.push(options);
      const accept = (globalThis.__confirmInstall && options.buttons[0] === 'Restart and Install') || (globalThis.__download && options.buttons[0] === 'Download Update') || (globalThis.__openRelease && options.buttons[0] === 'Open Release & Downloads');
      return { response: accept ? 0 : options.cancelId, checkboxChecked: false };
    };
    shell.openExternal = async url => { globalThis.__updateLinks.push(url); };
  });
  const scenarioValues = { 'Manual download on this system': 'available', 'Already up to date': 'current', 'No compatible package': 'incompatible', 'Long release notes': 'long', 'Missing release notes': 'empty', 'Release notes unavailable': 'notes-error', 'Network error': 'network-error', 'Download failure (Windows preview)': 'download-error', 'Slow download (Windows preview)': 'slow' };
  const scenario = async label => {
    await page.getByLabel('Scenario', { exact: true }).selectOption(scenarioValues[label]);
    await page.getByRole('button', { name: 'Run Scenario', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Run Scenario', exact: true })).toBeEnabled({ timeout: 25_000 });
  };
  const status = () => page.evaluate(() => window.desktop.updates.getStatus());
  expect((await status()).phase).toBe('idle');
  await app.evaluate(() => { globalThis.__openRelease = true; });
  await scenario('Manual download on this system');
  await expect.poll(async () => (await status()).phase).toBe('available');
  if (process.platform !== 'win32') {
    await expect.poll(() => app.evaluate(() => globalThis.__updateLinks.at(-1))).toBe('https://github.com/oraylis/datam8-frontend/releases/tag/v2.1.0');
  }
  const details = await app.evaluate(() => globalThis.__updateDialogs.at(-1).detail);
  expect(details).toContain('Safer desktop updates'); expect(details).not.toContain('**');
  for (const label of ['Already up to date', 'No compatible package']) {
    await scenario(label); await expect.poll(async () => (await status()).phase).toBe('current');
  }
  await scenario('Long release notes'); expect((await status()).notes).toContain('excerpt');
  for (const label of ['Missing release notes', 'Release notes unavailable']) {
    await scenario(label); expect((await status()).notesUnavailable).toBe(true); expect((await status()).phase).toBe('available');
  }
  await scenario('Network error'); expect((await status()).phase).toBe('error');
  await scenario('Download failure (Windows preview)');
  await app.evaluate(() => { globalThis.__download = true; });
  await page.evaluate(() => window.desktop.updates.check());
  await expect.poll(async () => (await status()).phase).toBe('error');
  await app.evaluate(() => { globalThis.__download = false; });
  await scenario('Slow download (Windows preview)');
  await app.evaluate(() => { globalThis.__download = true; globalThis.__progress = []; });
  const downloading = page.evaluate(() => window.desktop.updates.check());
  await expect.poll(async () => (await status()).phase).toBe('downloading');
  await expect(page.getByLabel('Scenario', { exact: true })).toBeDisabled();
  await expect(page.evaluate(() => window.desktop.developer.runUpdateScenario('current', 'current'))).rejects.toThrow('finish');
  await expect(page.getByRole('complementary', { name: 'Desktop update' })).toHaveCount(0);
  await expect.poll(async () => (await status()).phase, { timeout: 20_000 }).toBe('ready');
  await downloading;
  const progressValues = await app.evaluate(() => globalThis.__progress);
  expect(progressValues.some(value => value > 0 && value < 1)).toBe(true);
  expect(progressValues.at(-1)).toBe(-1);
  await page.evaluate(() => window.desktop.updates.check());
  expect(await app.evaluate(() => globalThis.__updateDialogs.at(-1).buttons[0])).toBe('Restart and Install');
  await page.screenshot({ path: path.join(diagnostics, 'update-ready.png') });
  console.log('PASS: no release requests at startup, manual native dialogs, no update overlay, postponed installation through Help, native progress, notes/links and error paths');
  await app.evaluate(() => { globalThis.__confirmInstall = true; });
  await page.evaluate(() => window.desktop.updates.install());
  expect(await app.evaluate(() => globalThis.__updateDialogs.at(-1).message)).toBe('Demo installation completed');
  await expect(page.locator('.app')).not.toHaveAttribute('inert');
  if (!fs.existsSync(python)) throw new Error('Generator virtual environment is required for the real save-barrier checks. Prepare it with uv sync --all-extras.');
  const entityPath = path.join(simulationRoot, 'Example solution/Model/Core/Customer.json');
  await page.getByRole('button', { name: 'Open Example Solution', exact: true }).click();
  await page.getByText('Customer', { exact: true }).first().click({ timeout: 60_000 });
  const description = page.getByPlaceholder('Describe this entity');
  await expect(description).toBeVisible();
  // Hold the first real backend PATCH, then edit again while it is in flight.
  // Completing installation must wait for and save the newer queued draft.
  let releasePatch, firstPatchSeen;
  const firstSeen = new Promise(resolve => { firstPatchSeen = resolve; });
  const hold = new Promise(resolve => { releasePatch = resolve; });
  let held = false;
  await page.route('**/entities/**', async route => {
    if (!held && route.request().method() === 'PATCH') { held = true; firstPatchSeen(); await hold; }
    await route.continue();
  });
  await description.fill('First revision'); await description.press('Tab'); await firstSeen;
  await description.fill('Latest focused revision');
  const install = page.evaluate(() => window.desktop.updates.install());
  await expect.poll(async () => (await status()).phase).toBe('preparing');
  expect(JSON.parse(fs.readFileSync(entityPath)).description).toBe('Packaged fixture');
  releasePatch(); await install;
  expect((await status()).error, "Install preparation must finish saving the newer draft").toBeUndefined();
  expect(JSON.parse(fs.readFileSync(entityPath)).description).toBe('Latest focused revision');
  expect(await app.evaluate(() => globalThis.__updateDialogs.at(-1).message)).toBe('Demo installation completed');
  await page.unroute('**/entities/**');
  // A real HTTP failure must keep the focused draft and refuse installation.
  await page.route('**/entities/**', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 500, json: { message: 'Deliberate save failure' } }) : route.continue());
  await description.fill('Must remain an unsaved draft');
  await page.evaluate(() => window.desktop.updates.install());
  expect((await status()).error).toContain('unsaved');
  expect(JSON.parse(fs.readFileSync(entityPath)).description).toBe('Latest focused revision');
  await expect(description).toHaveValue('Must remain an unsaved draft');
  await expect(page.locator('.app')).not.toHaveAttribute('inert');
  await page.screenshot({ path: path.join(diagnostics, 'update-save-failed.png') });
  console.log('PASS: no-solution install preparation, focused input, in-flight/queued real backend saves, save failure preserves draft and unlocks editor');
  await page.getByRole('button', { name: 'Close developer tools' }).click();
  await expect(page.getByRole('complementary', { name: 'Developer tools' })).toHaveCount(0);
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'Developer').submenu.items[0].click());
  await expect(page.getByRole('complementary', { name: 'Developer tools' })).toBeVisible();
  // Close the child, verify cleanup, then reopen a fresh profile and let parent
  // shutdown close that second child as well.
  await app.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); });
  inspector.close(); inspector = null;
  await browser.close().catch(() => {}); browser = null;
  await expect.poll(() => fs.existsSync(simulationRoot), { timeout: 25_000 }).toBe(false);
  await expect.poll(async () => (await childInfo()).length).toBe(0);
  await parentPage.getByRole('button', { name: 'Open Update Simulation' }).click();
  await expect.poll(async () => (await childInfo()).length).toBe(1);
  const nextChild = (await childInfo())[0];
  const nextRoot = path.dirname(nextChild.args.find(arg => arg.startsWith('--user-data-dir=')).slice('--user-data-dir='.length));
  expect(nextRoot).not.toBe(simulationRoot); expect(nextChild.pid).not.toBe(firstChild.pid);
  await parent.close(); parent = null;
  await expect.poll(() => fs.existsSync(nextRoot), { timeout: 25_000 }).toBe(false);
  console.log('PASS: developer frontend entry, isolated process/profile/port, repeated open focuses one child, close/reopen makes a fresh profile, parent shutdown cleans up');
  // A killed parent cannot run its own shutdown callbacks. The child must quit
  // on IPC disconnect and remove its profile after Chromium releases it.
  const orphanLogIndex = logs.length;
  orphanParent = await _electron.launch({ executablePath: require('electron'), args: [path.join(root, 'apps/desktop'), `--user-data-dir=${path.join(temp, 'Orphan parent profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], env, timeout: 60_000 });
  orphanParent.process().stderr?.on('data', chunk => logs.push(String(chunk)));
  const orphanPage = await developmentPage(orphanParent);
  await expect(orphanPage.getByTitle('Open', { exact: true })).toBeVisible();
  await orphanParent.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'Developer').submenu.items[0].click());
  await orphanPage.getByRole('button', { name: 'Open Update Simulation' }).click();
  const orphanChildren = () => orphanParent.evaluate(() => process._getActiveHandles().filter(handle => handle.constructor.name === 'ChildProcess' && handle.spawnargs?.some(arg => String(arg).includes('DataM8 update simulation'))).map(child => ({ pid: child.pid, args: child.spawnargs })));
  await expect.poll(async () => (await orphanChildren()).length).toBe(1);
  await expect(orphanPage.getByRole('button', { name: 'Open Update Simulation' })).toBeEnabled();
  const orphanChild = (await orphanChildren())[0];
  const orphanRoot = path.dirname(orphanChild.args.find(arg => arg.startsWith('--user-data-dir=')).slice('--user-data-dir='.length));
  await expect.poll(() => /\[update-sandbox\]\s*DevTools listening on (ws:\/\/[^\s]+)/.test(logs.slice(orphanLogIndex).join('\n'))).toBe(true);
  const orphanEndpoint = logs.slice(orphanLogIndex).join('\n').match(/\[update-sandbox\]\s*DevTools listening on (ws:\/\/[^\s]+)/)[1];
  browser = await chromium.connectOverCDP(orphanEndpoint);
  const orphanSimulation = browser.contexts()[0].pages().find(candidate => candidate.url().startsWith('http://localhost:4320')) || browser.contexts()[0].pages()[0];
  await orphanSimulation.getByRole('button', { name: 'Open Example Solution' }).click();
  await expect(orphanSimulation.getByText('Customer', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  const orphanBackendPort = Number(new URL(await orphanSimulation.evaluate(() => window.desktop.apiBase)).port);
  const dead = new Promise(resolve => orphanParent.process().once('exit', resolve));
  orphanParent.process().kill('SIGKILL'); await dead; orphanParent = null;
  await expect.poll(() => fs.existsSync(orphanRoot), { timeout: 35_000 }).toBe(false);
  await expect.poll(() => { try { process.kill(orphanChild.pid, 0); return false; } catch { return true; } }).toBe(true);
  await expect.poll(() => new Promise(resolve => {
    const socket = net.connect(orphanBackendPort, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(true));
  }), { timeout: 25_000 }).toBe(true);
  await browser.close().catch(() => {}); browser = null;
  console.log('PASS: killed parent causes simulation/backend exit and orphan profile cleanup');
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(diagnostics, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  inspector?.close();
  if (browser) await browser.close().catch(() => {});
  if (parent) await parent.close().catch(() => {});
  if (orphanParent) await orphanParent.close().catch(() => {});
  if (vite) { vite.kill(); await new Promise(resolve => vite.exitCode !== null ? resolve() : vite.once('exit', resolve)); }
  fs.writeFileSync(path.join(diagnostics, 'test.log'), logs.join('\n').replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]'));
  await fs.promises.rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
