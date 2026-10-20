import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron, expect } from '@playwright/test';
import { desktopFixture } from './desktop-fixture.mjs';
import { unusedLoopbackPort } from './test-port.mjs';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'apps/desktop/package.json'));
const tempRoot = fs.realpathSync.native(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempRoot, 'DataM8 workspace test '));
if (path.dirname(temp) !== tempRoot) throw new Error('Unexpected test directory');
const diagnostics = path.join(root, 'artifacts/desktop-workspace-results');
fs.mkdirSync(diagnostics, { recursive: true });
const first = desktopFixture(temp, 'First');
const second = desktopFixture(temp, 'Second');
const slow = desktopFixture(temp, 'Slow start');
const failing = desktopFixture(temp, 'Failed start');
fs.writeFileSync(path.join(path.dirname(failing), '.user-settings.json'), JSON.stringify({ backendModule: 'nonexistent_backend_for_test' }));
fs.writeFileSync(path.join(path.dirname(slow), '.user-settings.json'), JSON.stringify({ backendModule: 'slow_backend' }));
fs.writeFileSync(path.join(temp, 'slow_backend.py'), 'import time, runpy\ntime.sleep(30)\nrunpy.run_module("datam8", run_name="__main__")\n');
const broken = path.join(temp, 'Broken.dm8s');
fs.writeFileSync(broken, JSON.stringify({ schemaVersion: '2.0.0', modelPath: 42 }));
let app, page;
const logs = [];
const metrics = [];
const backendPort = await unusedLoopbackPort();
try {
  const env = { ...process.env, VITE_APP_MODE: 'electron', DATAM8_DEVELOPER_TEST_DEBUG: '1',
    DATAM8_BACKEND_TEST_PORT: String(backendPort),
    PYTHONPATH: temp,
    DATAM8_PYTHON_PATH: path.join(root, 'submodules/datam8-generator/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python') };
  app = await _electron.launch({ executablePath: require('electron'),
    args: [path.join(root, 'apps/desktop'), `--user-data-dir=${path.join(temp, 'Profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], env, timeout: 60_000 });
  app.process().stdout?.on('data', data => logs.push(String(data))); app.process().stderr?.on('data', data => logs.push(String(data)));
  await (await app.firstWindow()).waitForLoadState('load');
  await app.evaluate(async ({ BrowserWindow }, file) => {
    const window = BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().startsWith('devtools:'));
    if (!window) throw new Error('Production renderer window not found');
    window.loadURL = async () => {};
    window.webContents.stop();
    window.webContents.closeDevTools();
    await window.loadFile(file);
  }, path.join(root, 'apps/web/dist/index.html'));
  await expect.poll(() => app.windows().some(window => window.url().startsWith('file:'))).toBe(true);
  page = app.windows().find(window => window.url().startsWith('file:'));
  await expect(page.getByTitle('Open', { exact: true })).toBeVisible({ timeout: 30_000 });
  const pids = () => app.evaluate(() => process._getActiveHandles().filter(handle => handle.constructor.name === 'ChildProcess' && handle.spawnargs?.includes('serve')).map(handle => handle.pid));
  async function open(solution) {
    const started = performance.now();
    await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, solution);
    await page.getByTitle('Open', { exact: true }).click();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()), { timeout: 70_000 }).toContain(solution);
    await expect(page.getByRole('heading', { name: /Starting backend|Opening solution/ })).toHaveCount(0);
    await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible();
    metrics.push({ solution: path.basename(path.dirname(solution)), durationMs: Math.round(performance.now() - started) });
  }
  await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, slow);
  await page.getByTitle('Open', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Starting backend', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Starting backend|Opening solution/ })).toHaveCount(0);
  expect(await pids()).toEqual([]);
  await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, failing);
  await page.getByTitle('Open', { exact: true }).click();
  await expect.poll(() => logs.join('').includes('module=nonexistent_backend_for_test.')).toBe(true);
  await expect(page.getByRole('heading', { name: /Starting backend|Opening solution/ })).toHaveCount(0);
  await expect.poll(pids).toEqual([]);
  await open(first);
  expect(await page.evaluate(async () => (await fetch(`${window.desktop.apiBase}/config`)).status)).toBe(200);
  const originalPids = await pids(); expect(originalPids).toHaveLength(1);
  const originalId = await page.evaluate(async () => (await (await fetch(`${window.desktop.apiBase}/workspace`)).json()).workspaceId);
  await page.getByText('Customer', { exact: true }).first().click();
  const description = page.getByPlaceholder('Describe this entity');
  await expect(description).toHaveValue('Packaged fixture');
  const entityFile = path.join(path.dirname(first), 'Model/Core/Customer.json');
  const external = JSON.parse(fs.readFileSync(entityFile, 'utf8'));
  external.description = 'Changed externally before Reload';
  fs.writeFileSync(entityFile, JSON.stringify(external));
  const reloadRequests = [];
  const recordReload = request => reloadRequests.push({ url: new URL(request.url()).pathname, method: request.method() });
  page.on('request', recordReload);
  const startsBeforeReload = logs.join('').split('[datam8] Starting backend for ').length;
  await page.getByTitle('Reload', { exact: true }).click();
  await expect(description).toHaveValue('Changed externally before Reload');
  page.off('request', recordReload);
  expect(reloadRequests.some(request => request.url === '/model/reload')).toBe(true);
  expect(reloadRequests.some(request => request.url === '/solution/full')).toBe(true);
  expect(reloadRequests.some(request => request.url === '/workspace/open')).toBe(false);
  expect(reloadRequests.some(request => request.method !== 'GET' && !['/model/reload', '/plugins/reload'].includes(request.url))).toBe(false);
  expect(logs.join('').split('[datam8] Starting backend for ').length).toBe(startsBeforeReload);
  expect(logs.join('')).not.toContain('override detected');
  expect(logs.join('')).toContain('(source: DATAM8_PYTHON_PATH)');
  expect(await pids()).toEqual(originalPids);
  await description.fill('Saved before switching workspace');
  // Open immediately, without waiting for autosave or manually blurring.
  await open(second);
  expect(await pids()).toEqual(originalPids);
  expect(JSON.parse(fs.readFileSync(path.join(path.dirname(first), 'Model/Core/Customer.json'), 'utf8')).description).toBe('Saved before switching workspace');
  await page.getByText('Customer', { exact: true }).first().click();
  await expect(page.getByPlaceholder('Describe this entity')).toHaveValue('Packaged fixture');
  const stale = await page.evaluate(async id => {
    const response = await fetch(`${window.desktop.apiBase}/model/save`, { method: 'POST', headers: { 'X-DataM8-Workspace': id } });
    return response.status;
  }, originalId);
  expect(stale).toBe(409);
  await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, broken);
  await page.getByTitle('Open', { exact: true }).click();
  await expect(page.getByRole('heading', { name: /Starting backend|Opening solution/ })).toHaveCount(0);
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).toContain(second);
  expect(await pids()).toEqual(originalPids);
  // Clear surfaced failure by successfully opening the original solution.
  await open(first);
  expect(await pids()).toEqual(originalPids);
  await page.getByText('Customer', { exact: true }).first().click();
  await expect(page.getByPlaceholder('Describe this entity')).toHaveValue('Saved before switching workspace');
  await page.getByRole('button', { name: 'Toggle generator' }).click();
  await page.locator('.generator-panel').getByRole('button', { name: 'Generate', exact: true }).click();
  await expect.poll(() => fs.existsSync(path.join(path.dirname(first), 'Output/generated/hello.txt')), { timeout: 60_000 }).toBe(true);
  await page.screenshot({ path: path.join(diagnostics, 'workspace.png') });
  await app.close(); app = null;
  for (const pid of originalPids) expect(() => process.kill(pid, 0)).toThrow();
  console.log('PASS: startup cancellation/retry, Reload reads external changes without reopening or saving, real Electron save barrier, A → B → failed open → A, same backend PID, stale write rejection, generation and shutdown');
  console.log(JSON.stringify(metrics));
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(diagnostics, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await app?.close().catch(() => {});
  fs.writeFileSync(path.join(diagnostics, 'test.log'), logs.join('\n').replace(/(--token[\s=]+)[^\s"']+/gi, '$1[redacted]'));
  fs.writeFileSync(path.join(diagnostics, 'metrics.json'), JSON.stringify(metrics, null, 2));
  await fs.promises.rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
