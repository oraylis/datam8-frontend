import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { expect, _electron } from '@playwright/test';
import { desktopFixture } from './desktop-fixture.mjs';
import { readSolutionText, writeSolutionText } from '../apps/desktop/dist/solutionEncoding.js';

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
    await (await app.firstWindow()).waitForLoadState('domcontentloaded');
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
    const metadataDirectory = path.join(directory, 'Alt');
    fs.mkdirSync(metadataDirectory);
    writeSolutionText(path.join(metadataDirectory, '.properties.json'), JSON.stringify({
      type: 'folders', folders: [{ id: 2, name: 'Alt', path: 'Core/Alt', displayName: 'für Größe €' }],
    }));
    await page.evaluate(solutionPath => window.desktop.solution.renameFolder({
      fromFolderPath: 'Core/Alt', toFolderPath: 'Core/Größe', solutionPath,
    }), solution);
    const metadataPath = path.join(directory, 'Größe/.properties.json');
    const metadata = JSON.parse(readSolutionText(metadataPath));
    assert.equal(metadata.folders[0].displayName, 'für Größe €');
    assert.equal(metadata.folders[0].name, 'Größe');
    assert.equal(metadata.folders[0].path, 'Core/Größe');
    assert.ok(fs.readFileSync(metadataPath).includes(0xfc));
    assert.ok(fs.readFileSync(metadataPath).includes(0x80));
    fs.mkdirSync(path.join(directory, 'Customer'));
    fs.writeFileSync(path.join(directory, 'Customer/legacy.py'), '# keep legacy content');
    await assert.rejects(create('legacy.py'), /already exists/);
    await assert.rejects(create('Customer/legacy.py'), /already exists/);
    assert.equal(fs.existsSync(path.join(directory, 'legacy.py')), false);
    assert.equal(fs.readFileSync(path.join(directory, 'Customer/legacy.py'), 'utf8'), '# keep legacy content');

    // Ordinary saves retain their overwrite semantics.
    await page.evaluate(payload => window.desktop.solution.saveFunctionSource(payload), {
      ...payload, createOnly: false, source: 'new.py', content: '# für Größe €',
    });
    assert.equal(fs.readFileSync(path.join(directory, 'new.py'), 'utf8'), '# für Größe €');
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
