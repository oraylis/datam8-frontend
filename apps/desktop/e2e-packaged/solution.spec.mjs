import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { test, expect, _electron } from '@playwright/test';
import { verifyMac, verifyWindows } from '../../../scripts/desktop-verification.mjs';
import { desktopFixture as fixture } from '../../../scripts/desktop-fixture.mjs';
const manifest = process.env.DATAM8_INSTALLED_MANIFEST;
if (!manifest) throw new Error('DATAM8_INSTALLED_MANIFEST must point at installed distributions');
const distributions = JSON.parse(fs.readFileSync(manifest, 'utf8'));
if (!distributions.length) throw new Error('No installed distributions');
const redact = text => String(text).replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]').replace(/(--token[\s=]+)[^\s"']+/gi, '$1[redacted]');
async function portClosed() {
  return new Promise(resolve => {
    const socket = net.connect(4318, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(true));
  });
}
for (const distribution of distributions) {
  test(`${distribution.format}: solution, persistence, generation, switching and shutdown`, async ({}, testInfo) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 desktop tests '));
    const first = fixture(temp, 'First solution'); const second = fixture(temp, 'Second solution');
    const logs = []; let app; let page;
    const verify = () => {
      if (process.platform === 'darwin') verifyMac(distribution.appRoot);
      if (process.platform === 'win32' && process.env.DATAM8_REQUIRE_SIGNING === '1') verifyWindows(distribution.appRoot, process.env.DATAM8_WINDOWS_THUMBPRINT);
    };
    async function launch() {
      app = await _electron.launch({ executablePath: distribution.executable, args: [`--user-data-dir=${path.join(temp, 'Profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
        env: { ...process.env, DATAM8_DISABLE_AUTO_UPDATES: '1', APPIMAGE_EXTRACT_AND_RUN: '1', PYTHONHOME: '/deliberately/invalid/host-python', PYTHONPATH: '/deliberately/invalid/host-modules' }, timeout: 60_000 });
      app.process().stdout?.on('data', chunk => logs.push(redact(chunk)));
      app.process().stderr?.on('data', chunk => logs.push(redact(chunk)));
      page = await app.firstWindow();
      await page.context().tracing.start({ screenshots: true, snapshots: true });
      expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(fs.realpathSync(path.join(temp, 'Profile')));
    }
    async function open(solution) {
      await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, solution);
      await page.getByTitle('Open', { exact: true }).click({ timeout: 90_000 });
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).toContain(solution);
      await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Select solution (.dm8s)', { exact: true })).toBeHidden();
      await expect(page.getByText('Failed to load solution', { exact: true })).toHaveCount(0);
      const responses = await page.evaluate(async () => {
        const { apiBase, token } = window.desktop;
        const headers = { Authorization: `Bearer ${token}` };
        return Promise.all(['/health', '/config'].map(async route => {
          const res = await fetch(`${apiBase}${route}`, { headers });
          return { status: res.status, json: await res.json() };
        }));
      });
      expect(responses.map(response => response.status)).toEqual([200, 200]);
      return app.evaluate(() => process._getActiveHandles().filter(handle => handle.constructor.name === 'ChildProcess' && handle.spawnargs?.includes('serve')).map(handle => handle.pid));
    }
    async function editEntity() {
      await page.getByText('Customer', { exact: true }).first().click();
      const description = page.getByPlaceholder('Describe this entity');
      await expect(description).toBeVisible();
      return description;
    }
    try {
      verify(); await launch();
      const pids = await open(first); expect(pids.length).toBeGreaterThan(0);
      const description = await editEntity();
      await description.fill('Saved by packaged desktop regression'); await description.press('Tab');
      await expect.poll(() => JSON.parse(fs.readFileSync(path.join(path.dirname(first), 'Model', 'Core', 'Customer.json'), 'utf8')).description).toBe('Saved by packaged desktop regression');
      await app.close(); app = null;
      await expect.poll(portClosed).toBe(true);
      await launch(); await open(first);
      await expect(await editEntity()).toHaveValue('Saved by packaged desktop regression');
      await page.getByRole('button', { name: 'Toggle generator' }).click();
      await page.locator('.generator-panel').getByRole('button', { name: 'Generate', exact: true }).click();
      const generated = path.join(path.dirname(first), 'Output', 'generated', 'hello.txt');
      await expect.poll(() => fs.existsSync(generated) ? fs.readFileSync(generated, 'utf8').trim() : '', { timeout: 60_000 }).toBe('Hello world');
      const oldPids = await app.evaluate(() => process._getActiveHandles().filter(handle => handle.constructor.name === 'ChildProcess' && handle.spawnargs?.includes('serve')).map(handle => handle.pid));
      const newPids = await open(second); expect(newPids.length).toBeGreaterThan(0);
      expect(newPids.some(pid => !oldPids.includes(pid))).toBe(true);
      await expect(await editEntity()).toHaveValue('Packaged fixture');
      await page.context().tracing.stop();
      await app.close(); app = null;
      await expect.poll(portClosed).toBe(true);
      for (const pid of [...pids, ...oldPids, ...newPids]) {
        expect(() => process.kill(pid, 0)).toThrow();
      }
      verify();
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
}
