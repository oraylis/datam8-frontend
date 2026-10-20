import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { expect, _electron } from '@playwright/test';
import { desktopFixture } from './desktop-fixture.mjs';
import { unusedLoopbackPort } from './test-port.mjs';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'apps/desktop/package.json'));

test('function creation and legacy deletion use real Desktop IPC without overwriting files', { timeout: 60_000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'datam8-function-ipc-'));
  const solution = desktopFixture(temp, 'Solution');
  const directory = path.join(path.dirname(solution), 'Model/Core');
  let app;
  const listener = spawn(process.execPath, ['-e', "require('node:http').createServer((_, res) => res.end('unrelated service')).listen(0, '127.0.0.1', function () { process.send(this.address().port); });"], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
  try {
    const port = await new Promise((resolve, reject) => { listener.once('message', resolve); listener.once('error', reject); listener.once('exit', code => reject(new Error(`Listener exited ${code}`))); });
    const env = { ...process.env, DATAM8_BACKEND_TEST_PORT: String(port) };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({
      executablePath: require('electron'),
      args: [path.join(root, 'apps/desktop'), `--user-data-dir=${path.join(temp, 'Profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
      env,
    });
    assert.equal(fs.realpathSync(await app.evaluate(({ app }) => app.getPath('userData'))), fs.realpathSync(path.join(temp, 'Profile')));
    await (await app.firstWindow()).waitForLoadState('load');
    // Keep the production window/preload, without depending on a running dev server.
    await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().startsWith('devtools:'));
      if (!window) throw new Error('Production renderer window not found');
      window.webContents.closeDevTools();
      window.loadURL = async () => {}; // Disable only the development server retry.
      window.webContents.stop();
      await window.webContents.loadURL('data:text/html,<title>Function IPC regression</title>');
    });
    await expect.poll(() => app.windows().some(window => window.url().startsWith('data:text/html'))).toBe(true);
    const page = app.windows().find(window => window.url().startsWith('data:text/html'));
    await page.waitForFunction(() => !!window.desktop?.solution?.saveFunctionSource);
    const payload = { relPath: 'Model/Core/Customer.json', entityName: 'Customer', solutionPath: solution, content: '', createOnly: true };
    const create = source => page.evaluate(payload => window.desktop.solution.saveFunctionSource(payload), { ...payload, source });

    const result = await create('new.py');
    assert.equal(result.path, path.join(directory, 'new.py'));
    assert.equal(fs.readFileSync(result.path, 'utf8'), '');
    assert.equal(fs.existsSync(path.join(directory, 'Customer/new.py')), false);
    // An empty existing source is also a collision.
    await assert.rejects(create('new.py'), /already exists/);
    fs.writeFileSync(path.join(directory, 'existing.py'), '# keep direct content');
    await assert.rejects(create('existing.py'), /already exists/);
    assert.equal(fs.readFileSync(path.join(directory, 'existing.py'), 'utf8'), '# keep direct content');
    fs.mkdirSync(path.join(directory, 'Customer'));
    fs.writeFileSync(path.join(directory, 'Customer/legacy.py'), '# keep legacy content');
    await assert.rejects(create('legacy.py'), /already exists/);
    await assert.rejects(create('Customer/legacy.py'), /already exists/);
    assert.equal(fs.existsSync(path.join(directory, 'legacy.py')), false);
    assert.equal(fs.readFileSync(path.join(directory, 'Customer/legacy.py'), 'utf8'), '# keep legacy content');

    // Ordinary saves retain their overwrite semantics.
    await page.evaluate(payload => window.desktop.solution.saveFunctionSource(payload), {
      ...payload, createOnly: false, source: 'new.py', content: '# saved normally',
    });
    assert.equal(fs.readFileSync(path.join(directory, 'new.py'), 'utf8'), '# saved normally');
    await page.evaluate(payload => window.desktop.solution.deleteFunctionSource(payload), { ...payload, source: 'legacy.py' });
    assert.equal(fs.existsSync(path.join(directory, 'Customer/legacy.py')), false);
    assert.equal(fs.readFileSync(path.join(directory, 'existing.py'), 'utf8'), '# keep direct content');
    // A port collision must fail without terminating an unrelated listener.
    await assert.rejects(page.evaluate(solution => window.desktop.solution.load(solution), solution), /Backend|open solution/i);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'unrelated service');
  } finally {
    if (app) await app.close();
    if (listener.exitCode === null) {
      await new Promise(resolve => { listener.once('exit', resolve); listener.kill(); });
    }
    const resolved = path.resolve(temp);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('datam8-function-ipc-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test('Desktop reload commands and solution detection preserve the active solution', { timeout: 90_000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'datam8-session-ipc-'));
  const solution = desktopFixture(temp, 'Solution');
  const v1 = { basePath: 'Base', rawPath: 'Raw', stagingPath: 'Staging', corePath: 'Core', curatedPath: 'Curated',
    generatePath: 'Generate', diagramPath: 'Diagram', outputPath: 'Output',
    AreaTypes: { Raw: 'Raw', Stage: 'Stage', Core: 'Core', Curated: 'Curated', Diagram: 'Diagram' } };
  let app;
  try {
    const env = { ...process.env, DATAM8_BACKEND_TEST_PORT: String(await unusedLoopbackPort()), DATAM8_DEVELOPER_TEST_DEBUG: '1' };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ executablePath: require('electron'),
      args: [path.join(root, 'apps/desktop'), `--user-data-dir=${path.join(temp, 'Profile')}`], env });
    await (await app.firstWindow()).waitForLoadState('load');
    await app.evaluate(async ({ BrowserWindow }, file) => {
      const window = BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().startsWith('devtools:'));
      window.loadURL = async () => {}; // Use the built renderer without a development server.
      window.webContents.stop();
      window.webContents.closeDevTools();
      await window.loadFile(file);
    }, path.join(root, 'apps/web/dist/index.html'));
    await expect.poll(() => app.windows().some(window => window.url().startsWith('file:'))).toBe(true);
    const page = app.windows().find(window => window.url().startsWith('file:'));
    const menu = label => app.evaluate(({ Menu }, label) => Menu.getApplicationMenu().items
      .find(item => item.label === 'View').submenu.items.find(item => item.label === label).click(), label);
    const backendPids = () => app.evaluate(() => process._getActiveHandles()
      .filter(handle => handle.constructor.name === 'ChildProcess' && handle.spawnargs?.includes('serve')).map(handle => handle.pid));
    const open = async file => {
      await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
      await page.getByTitle('Open', { exact: true }).click();
    };
    await open(solution);
    await expect(page.getByRole('button', { name: 'Customer', exact: true })).toBeVisible({ timeout: 30_000 });
    const pids = await backendPids(); assert.equal(pids.length, 1);
    await page.evaluate(() => { window.reloadMarker = 'same renderer'; });
    // Solution payloads are fetched through real Main IPC, not renderer HTTP.
    await app.evaluate(() => {
      globalThis.solutionReadCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (...args) => {
        if (String(args[0]).endsWith('/solution/full')) globalThis.solutionReadCount++;
        return originalFetch(...args);
      };
    });
    const requests = [];
    page.on('request', request => { const pathname = new URL(request.url()).pathname;
      if (['/model/reload', '/plugins/reload', '/solution/full'].includes(pathname)) requests.push(`${request.method()} ${pathname}`); });
    for (const reload of [() => page.getByTitle('Reload', { exact: true }).click(), () => menu('Reload')]) {
      requests.length = 0;
      const reads = await app.evaluate(() => globalThis.solutionReadCount);
      await reload();
      await expect.poll(() => app.evaluate(() => globalThis.solutionReadCount)).toBe(reads + 1);
      assert.deepEqual(requests, ['POST /model/reload', 'POST /plugins/reload']);
      assert.deepEqual(await backendPids(), pids);
      assert.equal(await page.evaluate(() => window.reloadMarker), 'same renderer');
      await expect(page.getByRole('button', { name: 'Customer', exact: true })).toBeVisible();
    }
    // A failed save leaves a real dirty tab; both native commands must allow cancellation.
    await page.getByRole('button', { name: 'Customer', exact: true }).click();
    const description = page.getByPlaceholder('Describe this entity');
    await page.route('**/entities/**', route => route.fulfill({ status: 503, json: { message: 'Test save failure' } }));
    await description.fill('Unsaved edit'); await description.press('Tab');
    await expect(page.locator('.sidebar__save-pill--failed')).toBeVisible();
    for (const label of ['Reload', 'Force Reload']) {
      requests.length = 0;
      await menu(label);
      await page.getByRole('dialog', { name: 'Reload solution?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.deepEqual(requests, []); assert.deepEqual(await backendPids(), pids);
      await expect(description).toHaveValue('Unsaved edit');
    }
    await page.unroute('**/entities/**');
    await description.fill('Saved edit'); await description.press('Tab');
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(path.dirname(solution), 'Model/Core/Customer.json'), 'utf8')).description).toBe('Saved edit');
    await Promise.all([page.waitForEvent('load'), menu('Force Reload')]);
    await expect(page.getByRole('button', { name: 'Customer', exact: true })).toBeVisible({ timeout: 30_000 });
    assert.notDeepEqual(await backendPids(), pids);
    assert.equal(await page.evaluate(() => window.reloadMarker), undefined);
    assert.ok((await page.evaluate(() => window.desktop.window.getTitle())).includes(solution));

    for (const [name, content, version] of [
      ['v1', JSON.stringify(v1), 'v1'], ['v2', fs.readFileSync(solution, 'utf8'), 'v2'],
      ['broken', '{ broken JSON'], ['empty', '{}'], ['null', 'null'], ['partial-v1', JSON.stringify({ ...v1, AreaTypes: { Raw: 'Raw' } })],
    ]) {
      const file = path.join(temp, `${name}.dm8s`); fs.writeFileSync(file, content);
      const detect = () => page.evaluate(file => window.desktop.solution.detectVersion(file), file);
      if (version) assert.equal((await detect()).version, version);
      else await assert.rejects(detect(), error => error.message.includes(file));
    }
    await open(path.join(temp, 'broken.dm8s'));
    await expect(page.getByRole('alert').filter({ hasText: 'broken.dm8s' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Customer', exact: true })).toBeVisible();
    assert.ok((await page.evaluate(() => window.desktop.window.getTitle())).includes(solution));
  } finally {
    if (app) await app.close();
    const resolved = path.resolve(temp);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('datam8-session-ipc-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
