import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
const { listPackage } = createRequire(new URL('../package.json', import.meta.url))('@electron/asar');
import { test, expect, _electron } from '@playwright/test';
import { verifyMac, verifyWindows } from '../../../scripts/desktop-verification.mjs';
import { desktopFixture as fixture } from '../../../scripts/desktop-fixture.mjs';
import { checked } from '../../../scripts/mac-runtime.mjs';
import { unusedLoopbackPort } from '../../../scripts/test-port.mjs';
import { demoReleaseServer } from '../resources/dev-fixtures.cjs';
import { legacyRuntimeFixture, runtimePluginArchive } from '../../../scripts/runtime-test-fixtures.mjs';
import { assertRuntimeUnchanged, snapshotRuntime } from '../../../scripts/runtime-test-support.mjs';
const manifest = process.env.DATAM8_INSTALLED_MANIFEST || 'artifacts/installed/installed.json';
const distributions = JSON.parse(fs.readFileSync(manifest, 'utf8'));
if (!distributions.length) throw new Error('No installed distributions');
const redact = text => String(text).replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]').replace(/(--token[\s=]+)[^\s"']+/gi, '$1[redacted]');
async function portClosed(port) {
  return new Promise(resolve => {
    const socket = net.connect(Number(port), '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(true));
  });
}
for (const distribution of distributions) {
  test(`${distribution.format}: solution, persistence, generation, switching and shutdown`, async ({}, testInfo) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 desktop tests '));
    const first = fixture(temp, 'First solution'); const second = fixture(temp, 'Second solution');
    const runtimeBefore = snapshotRuntime(distribution.runtimeRoot);
    const backendPort = await unusedLoopbackPort();
    const logs = []; let app; let page;
    const verify = () => {
      if (process.platform === 'darwin') verifyMac(distribution.appRoot);
      if (process.platform === 'win32' && process.env.DATAM8_REQUIRE_SIGNING === '1') verifyWindows(distribution.appRoot, process.env.DATAM8_WINDOWS_THUMBPRINT);
    };
    async function launch(previous = false) {
      if (previous && distribution.previousAppRoot && process.platform === 'darwin') verifyMac(distribution.previousAppRoot);
      app = await _electron.launch({ executablePath: previous && distribution.previousExecutable ? distribution.previousExecutable : distribution.executable, args: [`--user-data-dir=${path.join(temp, 'Profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
        env: { ...process.env, DATAM8_BACKEND_TEST_PORT: backendPort, APPIMAGE_EXTRACT_AND_RUN: '1', PYTHONHOME: '/deliberately/invalid/host-python', PYTHONPATH: '/deliberately/invalid/host-modules' }, timeout: 60_000 });
      if (!previous) {
        const expectedElectron = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).build.electronVersion;
        expect(await app.evaluate(() => process.versions.electron)).toBe(expectedElectron);
      }
      app.process().stdout?.on('data', chunk => logs.push(redact(chunk)));
      app.process().stderr?.on('data', chunk => logs.push(redact(chunk)));
      page = await app.firstWindow();
      await page.context().tracing.start({ screenshots: true, snapshots: true });
      const userData = await app.evaluate(({ app }) => app.getPath('userData'));
      expect(fs.realpathSync(userData)).toBe(fs.realpathSync(path.join(temp, 'Profile')));
    }
    async function open(solution) {
      await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, solution);
      await page.getByTitle('Open', { exact: true }).click({ timeout: 90_000 });
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).toContain(solution);
      await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Select solution (.dm8s)', { exact: true })).toBeHidden();
      await expect(page.getByText('Failed to load solution', { exact: true })).toHaveCount(0);
      await expect.poll(async () => {
        try {
          return await page.evaluate(async () => {
            const { apiBase, token } = window.desktop;
            const headers = { Authorization: `Bearer ${token}` };
            const health = await fetch(`${apiBase}/health`, { headers });
            const config = await fetch(`${apiBase}/config`, { headers });
            if (config.status === 200) await config.json();
            return [health.status, config.status];
          });
        } catch { return []; }
      }).toEqual([204, 200]);
      const apiBase = await page.evaluate(() => window.desktop.apiBase);
      const unauthorized = await app.evaluate(async (_electron, base) => (await fetch(`${base}/config`)).status, apiBase);
      expect([401, 403]).toContain(unauthorized);
      return app.evaluate(() => process._getActiveHandles().filter(handle => handle.constructor.name === 'ChildProcess' && handle.spawnargs?.includes('serve')).map(handle => handle.pid));
    }
    async function editEntity() {
      await page.getByText('Customer', { exact: true }).first().click();
      const description = page.getByPlaceholder('Describe this entity');
      await expect(description).toBeVisible();
      return description;
    }
    try {
      checked(process.execPath, ['scripts/smoke-python-runtime.mjs', '--runtime-root', distribution.runtimeRoot,
        '--report', testInfo.outputPath('runtime.json'),
        ...(process.env.CI === 'true' || process.env.DATAM8_RUNTIME_TEST_SECRETS === '1' ? ['--secrets-roundtrip'] : [])], { stdio: 'inherit' });
      const entries = listPackage(path.join(path.dirname(distribution.runtimeRoot), 'app.asar'));
      expect(entries.some(entry => /developerSimulation|dev-fixtures|cleanup-dev-profile|\/resources\/.*\.d\.cts$/.test(entry))).toBe(false);
      verify(); await launch(Boolean(distribution.previousExecutable));
      const previousVersion = await app.evaluate(({ app }) => app.getVersion());
      if (distribution.previousExecutable) expect(previousVersion).toBe(distribution.previousVersion);
      await page.evaluate(() => localStorage.setItem('desktop-version-regression', 'preserved'));
      const pids = await open(first); expect(pids.length).toBeGreaterThan(0);
      const description = await editEntity();
      await description.fill('Saved by packaged desktop regression'); await description.press('Tab');
      await expect.poll(() => JSON.parse(fs.readFileSync(path.join(path.dirname(first), 'Model', 'Core', 'Customer.json'), 'utf8')).description).toBe('Saved by packaged desktop regression');
      await app.close(); app = null;
      await expect.poll(() => portClosed(backendPort)).toBe(true);
      await launch();
      if (distribution.previousExecutable) expect(await app.evaluate(({ app }) => app.getVersion())).not.toBe(previousVersion);
      await expect.poll(() => page.evaluate(() => localStorage.getItem('desktop-version-regression'))).toBe('preserved');
      await open(first);
      await expect(await editEntity()).toHaveValue('Saved by packaged desktop regression');
      await page.getByRole('button', { name: 'Toggle generator' }).click();
      await page.locator('.generator-panel').getByRole('button', { name: 'Generate', exact: true }).click();
      const generated = path.join(path.dirname(first), 'Output', 'generated', 'hello.txt');
      await expect.poll(() => fs.existsSync(generated) ? fs.readFileSync(generated, 'utf8').trim() : '', { timeout: 60_000 }).toBe('Hello world');
      await expect(page.locator('.generator-panel').getByRole('button', { name: 'Generate', exact: true })).toBeEnabled();
      const oldPids = await app.evaluate(() => process._getActiveHandles().filter(handle => handle.constructor.name === 'ChildProcess' && handle.spawnargs?.includes('serve')).map(handle => handle.pid));
      const newPids = await open(second); expect(newPids.length).toBeGreaterThan(0);
      expect(newPids).toEqual(oldPids);
      await expect(await editEntity()).toHaveValue('Packaged fixture');

      // Exercise the packaged main process's actual CLI bridges, using its own
      // runtime selection rather than injecting an external Python interpreter.
      const createdDir = path.join(temp, 'Created ü'); fs.mkdirSync(createdDir);
      const created = await page.evaluate(saveDir => window.desktop.solution.createNew({ saveDir, solutionName: 'Created' }), createdDir);
      const createdPath = path.join(createdDir, 'Created.dm8s');
      expect(created.solutionPath).toBe(createdPath);
      expect(JSON.parse(fs.readFileSync(createdPath, 'utf8')).schemaVersion).toBe('2.0.0');
      expect((await page.evaluate(file => window.desktop.solution.load(file), createdPath)).path).toBe(createdPath);

      const legacy = legacyRuntimeFixture(temp);
      const sourceBefore = snapshotRuntime(path.dirname(legacy));
      const targetDir = path.join(temp, 'Migrated ü');
      fs.mkdirSync(targetDir); // The desktop directory picker supplies an existing directory.
      const migrated = await page.evaluate(payload => window.desktop.solution.migrateV1ToV2(payload), { sourceSolutionPath: legacy, targetDir });
      assertRuntimeUnchanged(sourceBefore, snapshotRuntime(path.dirname(legacy)));
      expect(migrated.solutionPath).toBe(path.join(targetDir, 'Legacy.dm8s'));
      const migratedEntity = JSON.parse(fs.readFileSync(path.join(targetDir, 'Model/Core/Sales/Customers/Customer.json'), 'utf8'));
      expect(migratedEntity.description).toBe('Migrated runtime fixture');
      expect(migratedEntity.attributes[0].name).toBe('CustomerId');
      expect((await page.evaluate(file => window.desktop.solution.load(file), migrated.solutionPath)).path).toBe(migrated.solutionPath);

      const archive = runtimePluginArchive(temp);
      const unsafeArchive = path.join(temp, 'unsafe-plugin.zip');
      const AdmZip = createRequire(import.meta.url)('adm-zip');
      const unsafeZip = new AdmZip(archive);
      unsafeZip.updateFile('plugin.json', Buffer.from(JSON.stringify({ id: '..' })));
      unsafeZip.writeZip(unsafeArchive);
      const solutionBeforeImport = snapshotRuntime(path.dirname(second));
      await expect(page.evaluate(payload => window.desktop.solution.importPlugins(payload), {
        solutionPath: second, artifactPaths: [unsafeArchive],
      })).rejects.toThrow(/Unsafe plugin/);
      assertRuntimeUnchanged(solutionBeforeImport, snapshotRuntime(path.dirname(second)));
      const imported = await page.evaluate(payload => window.desktop.solution.importPlugins(payload), { solutionPath: second, artifactPaths: [archive] });
      expect(imported.imported).toBe(1);
      expect(imported.plugins.items.some(plugin => plugin.id === 'runtime_fixture')).toBe(true);
      const session = await page.evaluate(async file => {
        const loaded = await window.desktop.solution.load(file);
        return { base: window.desktop.apiBase, token: window.desktop.token, id: loaded.workspaceId };
      }, second);
      const pluginProperties = await app.evaluate(async (_electron, { base, token, id }) => {
        const response = await fetch(`${base}/plugins/runtime_fixture/connection-properties`, {
          headers: { Authorization: `Bearer ${token}`, 'X-DataM8-Workspace': id },
        });
        if (!response.ok) throw new Error(`Plugin load failed: ${response.status}`);
        return response.json();
      }, session);
      expect(pluginProperties.items.at(-1).default).toBe('first');
      await page.context().tracing.stop();
      await app.evaluate(({ app }) => { app.quit(); app.quit(); });
      await app.close(); app = null;
      await expect.poll(() => portClosed(backendPort)).toBe(true);
      for (const pid of [...pids, ...oldPids, ...newPids]) {
        expect(() => process.kill(pid, 0)).toThrow();
      }
      verify();
      assertRuntimeUnchanged(runtimeBefore, snapshotRuntime(distribution.runtimeRoot));
    } catch (error) {
      if (page) {
        await page.screenshot({ path: testInfo.outputPath('failure.png') }).catch(() => {});
        await page.context().tracing.stop({ path: testInfo.outputPath('trace.zip') }).catch(() => {});
      }
      throw error;
    } finally {
      if (app) await app.close().catch(() => {});
      fs.writeFileSync(testInfo.outputPath('app-backend.log'), logs.join('\n'));
      await testInfo.attach('app-backend.log', { body: Buffer.from(logs.join('\n')), contentType: 'text/plain' });
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
  if (process.platform !== 'win32') test(`${distribution.format}: packaged manual updates and GitHub release notes`, async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 manual updates '));
    const server = demoReleaseServer(); let app;
    const releaseRequests = [];
    server.on('request', request => releaseRequests.push(request.url));
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      app = await _electron.launch({ executablePath: distribution.executable, args: [`--user-data-dir=${temp}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
        env: { ...process.env, DATAM8_UPDATE_DEMO: '1', DATAM8_UPDATE_SANDBOX: '1', DATAM8_DEVELOPER_TEST_DEBUG: '1', DATAM8_UPDATE_TEST_RELEASES: `http://127.0.0.1:${server.address().port}`, APPIMAGE_EXTRACT_AND_RUN: '1' }, timeout: 60_000 });
      const page = await app.firstWindow();
      const externalFonts = [];
      page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url()); });
      // Packaged UI assets must load without renderer internet access. Release
      // HTTP runs in the main process against the real local fixture server.
      await page.context().setOffline(true);
      await expect(page.getByTitle('Open', { exact: true })).toBeVisible();
      expect(externalFonts).toEqual([]);
      const faces = await page.evaluate(async () => (await document.fonts.load('400 14px Manrope')).map(face => face.status));
      expect(faces.length).toBeGreaterThan(0); expect(faces.every(state => state === 'loaded')).toBe(true);
      expect(releaseRequests).toEqual([]);
      expect((await page.evaluate(() => window.desktop.updates.getStatus())).phase).toBe('idle');
      await app.evaluate(({ dialog, shell }) => {
        globalThis.__dialogs = []; globalThis.__links = [];
        dialog.showMessageBox = async (...args) => { const options = args.at(-1); globalThis.__dialogs.push(options); return { response: options.buttons[0] === 'Open Release & Downloads' ? 0 : options.cancelId, checkboxChecked: false }; };
        shell.openExternal = async url => { globalThis.__links.push(url); };
      });
      await page.evaluate(() => window.desktop.updates.check());
      const state = await page.evaluate(() => window.desktop.updates.getStatus());
      expect(state.phase).toBe('available'); expect(state.canInstall).toBe(false); expect(state.demo).toBe(false);
      expect(state.notes).toContain('Safer desktop updates');
      expect(await page.evaluate(() => window.desktop.developer)).toBeUndefined();
      const developerDenials = await app.evaluate(async ({ ipcMain, BrowserWindow }) => {
        const sender = BrowserWindow.getAllWindows()[0].webContents;
        return Promise.all(['capabilities', 'open-panel', 'open-simulation', 'run-scenario', 'open-example'].map(async action => {
          try { await ipcMain._invokeHandlers.get(`developer:${action}`)({ sender }); return false; }
          catch (error) { return error.message === 'Developer tools are unavailable.'; }
        }));
      });
      expect(developerDenials).toEqual([true, true, true, true, true]);
      await expect(page.getByRole('complementary', { name: 'Developer tools' })).toHaveCount(0);
      expect(releaseRequests).toHaveLength(2);
      expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.some(item => item.label === 'Developer' || item.label === 'Update demo'))).toBe(false);
      await expect(page.getByRole('complementary', { name: 'Desktop update' })).toHaveCount(0);
      expect(await app.evaluate(() => globalThis.__links.at(-1))).toBe(`https://github.com/oraylis/datam8-frontend/releases/tag/v${state.version}`);
      expect(await app.evaluate(() => globalThis.__dialogs.at(-1).buttons)).toEqual(['Open Release & Downloads', 'Later']);
    } finally {
      if (app) await app.close();
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
}
