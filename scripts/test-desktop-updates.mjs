import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, _electron } from '@playwright/test';
import { desktopFixture } from './desktop-fixture.mjs';
import { checked, files } from './mac-runtime.mjs';
import { verifyWindows } from './desktop-verification.mjs';
import { createUpdateFeed } from './desktop-update-feed.mjs';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
if (process.platform !== 'win32') throw new Error('Signed auto-update acceptance runs on Windows only');
const fixtures = path.resolve(process.argv[2] || 'artifacts/update-fixtures');
const expected = JSON.parse(fs.readFileSync(path.join(fixtures, 'windows.json'), 'utf8'));
const old = files(path.join(fixtures, 'old')).find(name => name.endsWith('.exe'));
const next = files(path.join(fixtures, 'next')).find(name => name.endsWith('.exe'));
const metadataFile = files(path.join(fixtures, 'next')).find(name => /\.yml$/.test(name));
if (!old || !next || !metadataFile) throw new Error('Two signed update fixtures and metadata are required');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 updates '));
const diagnostics = path.resolve('artifacts/desktop-update-results');
fs.mkdirSync(diagnostics, { recursive: true });
const logs = [];
const redact = text => String(text).replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]').replace(/(--token[\s=]+)[^\s"']+/gi, '$1[redacted]');
const phase = message => { console.log(`[signed-update] ${message}`); logs.push(message); };
let app; let server; let feed; let failure;
const cleanupFailures = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let attempt = 0; attempt < 120; attempt++) { if (await check()) return; await sleep(500); }
  throw new Error(`Timed out: ${label}`);
}
function install(target) {
  checked('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(`$p=Start-Process -FilePath $env:DATAM8_UPDATE_OLD -ArgumentList @('/S',('/D='+$env:DATAM8_UPDATE_TARGET)) -Wait -PassThru; if ($p.ExitCode -ne 0) { throw 'Update fixture install failed' }`, 'utf16le').toString('base64')], { env: { ...process.env, DATAM8_UPDATE_OLD: old, DATAM8_UPDATE_TARGET: target } });
}
async function launch(target, enabled = true, solution) {
  const env = { ...process.env, DATAM8_UPDATE_TEST_FEED: feed, DATAM8_DISABLE_AUTO_UPDATES: enabled ? '0' : '1' };
  app = await _electron.launch({ executablePath: path.join(target, 'datam8.exe'), args: [`--user-data-dir=${path.join(temp, 'Profiles', path.basename(target))}`], env, timeout: 60_000 });
  app.process().stdout?.on('data', chunk => logs.push(redact(chunk)));
  app.process().stderr?.on('data', chunk => logs.push(redact(chunk)));
  const page = await app.firstWindow();
  // Use the same real preload/IPC/backend path as packaged acceptance. Only the
  // native dialog is replaced; command-line file events can arrive before the UI.
  if (solution) {
    await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, solution);
    await page.getByTitle('Open', { exact: true }).click({ timeout: 60_000 });
    await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  }
}
async function updateEvent() {
  return app.evaluate(async ({ app }) => {
    const { createRequire } = await import('node:module');
    const require = createRequire(`${app.getAppPath()}/package.json`);
    const updater = require('electron-updater').autoUpdater;
    return await new Promise(resolve => {
      const timeout = setTimeout(() => resolve({ kind: 'timeout' }), 60_000);
      const finish = value => { clearTimeout(timeout); resolve(value); };
      updater.once('update-downloaded', info => finish({ kind: 'downloaded', version: info.version }));
      updater.once('error', error => finish({ kind: 'error', code: error.code, message: error.message }));
      updater.checkForUpdates().catch(error => finish({ kind: 'error', code: error.code, message: error.message }));
    });
  });
}
function prepare(candidate) {
  const dir = path.join(temp, 'feed'); fs.mkdirSync(dir, { recursive: true });
  const name = path.basename(next); const bytes = fs.readFileSync(candidate);
  fs.writeFileSync(path.join(dir, name), bytes);
  const metadata = yaml.load(fs.readFileSync(metadataFile, 'utf8'));
  const hash = createHash('sha512').update(bytes).digest('base64');
  metadata.files = [{ url: name, sha512: hash, size: bytes.length }];
  metadata.path = name; metadata.sha512 = hash;
  // Full downloads exercise signature validation; disable differential download for test fixtures.
  fs.writeFileSync(path.join(dir, 'beta.yml'), yaml.dump(metadata));
  fs.writeFileSync(path.join(dir, 'latest.yml'), yaml.dump(metadata));
  return dir;
}
try {
  const solution = desktopFixture(temp, 'Solution with spaces');
  const entityPath = path.join(path.dirname(solution), 'Model', 'Core', 'Customer.json');
  const feedRoot = path.join(temp, 'feed'); fs.mkdirSync(feedRoot, { recursive: true });
  server = createUpdateFeed(feedRoot);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  feed = `http://127.0.0.1:${server.address().port}`;
  const target = path.join(temp, 'Valid update'); install(target);
  verifyWindows(target, expected.thumbprint);
  phase('Old version installed and all embedded signatures verified');
  await launch(target, true, solution);
  const oldPage = await app.firstWindow();
  await oldPage.getByText('Customer', { exact: true }).first().click({ timeout: 60_000 });
  const oldDescription = oldPage.getByPlaceholder('Describe this entity');
  await oldDescription.fill('Preserved through signed update'); await oldDescription.press('Tab');
  await until(() => JSON.parse(fs.readFileSync(entityPath)).description === 'Preserved through signed update', 'old version saves model');
  await oldPage.evaluate(() => localStorage.setItem('desktop-update-regression', 'preserved'));
  phase('Old version opened solution and saved model and profile state');
  prepare(next);
  const downloaded = await updateEvent();
  if (downloaded.kind !== 'downloaded' || downloaded.version !== '2.0.0-beta.6-ci.1') throw new Error(`Valid signed update failed: ${JSON.stringify(downloaded)}`);
  phase('Expected signed update downloaded and accepted by the real updater');
  const closed = app.waitForEvent('close');
  await app.evaluate(async ({ app }) => {
    const { createRequire } = await import('node:module');
    createRequire(`${app.getAppPath()}/package.json`)('electron-updater').autoUpdater.quitAndInstall(true, false);
  }).catch(() => {});
  await closed; app = null;
  const asar = require('@electron/asar');
  await until(() => {
    try { return JSON.parse(asar.extractFile(path.join(target, 'resources', 'app.asar'), 'package.json')).version === '2.0.0-beta.6-ci.1'; } catch { return false; }
  }, 'signed update installation');
  verifyWindows(target, expected.thumbprint);
  phase('New version installed and all embedded signatures verified');
  await launch(target, false, solution);
  const page = await app.firstWindow();
  await until(async () => page.evaluate(async () => {
    try { const response = await fetch(`${window.desktop.apiBase}/config`, { headers: { Authorization: `Bearer ${window.desktop.token}` } }); return response.ok; } catch { return false; }
  }), 'updated app loads a solution');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('desktop-update-regression'))).toBe('preserved');
  await page.getByText('Customer', { exact: true }).first().click({ timeout: 60_000 });
  await expect(page.getByPlaceholder('Describe this entity')).toHaveValue('Preserved through signed update');
  await app.close(); app = null;
  phase('Updated app reopened solution with saved model and profile state');
  const unsigned = path.join(temp, 'unsigned.exe');
  const pe = Buffer.from(fs.readFileSync(next)); const header = pe.readUInt32LE(0x3c) + 24;
  const table = header + (pe.readUInt16LE(header) === 0x20b ? 112 : 96) + 32;
  const certificateOffset = pe.readUInt32LE(table); if (!certificateOffset) throw new Error('Next update fixture lacks Authenticode certificate');
  pe.fill(0, table, table + 8); fs.writeFileSync(unsigned, pe.subarray(0, certificateOffset));
  for (const kind of ['unsigned', 'wrong-publisher']) {
    const candidate = path.join(temp, `${kind}.exe`); fs.copyFileSync(unsigned, candidate);
    if (kind === 'wrong-publisher') {
      const ps = `$ErrorActionPreference='Stop'; Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security'); $c=New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=Disposable DataM8 CI Publisher' -CertStoreLocation Cert:\\CurrentUser\\My; try { $s=Set-AuthenticodeSignature -FilePath $env:DATAM8_WRONG_UPDATE -Certificate $c -HashAlgorithm SHA256; if (!$s.SignerCertificate) { throw 'Disposable signing failed' } } finally { Remove-Item ('Cert:\\CurrentUser\\My\\'+$c.Thumbprint) }`;
      checked('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { env: { ...process.env, DATAM8_WRONG_UPDATE: candidate } });
    }
    prepare(candidate);
    const rejectedTarget = path.join(temp, kind); install(rejectedTarget); await launch(rejectedTarget);
    const event = await updateEvent();
    if (event.kind !== 'error' || !/signature|publisher|signed/i.test(event.message || '')) throw new Error(`Updater did not reject ${kind} by signature: ${JSON.stringify(event)}`);
    await app.close(); app = null;
    phase(`Real updater rejected ${kind}: ${event.code || 'signature error'}`);
  }
  console.log(`Signed update installed and reopened; unsigned and wrong-publisher updates rejected. Expected publisher: ${expected.publisher}`);
} catch (error) {
  failure = error;
  console.error(error);
  logs.push(redact(error.stack || error));
  if (app) {
    const page = app.windows()[0];
    if (page) await page.screenshot({ path: path.join(diagnostics, 'failure.png') }).catch(() => {});
  }
} finally {
  if (app) await app.close().catch(error => cleanupFailures.push(error));
  if (server) await new Promise(resolve => server.close(resolve));
  for (const name of ['Valid update', 'unsigned', 'wrong-publisher']) {
    const target = path.join(temp, name);
    try {
      if (fs.existsSync(target)) {
        const uninstaller = files(target).find(file => /uninstall.*\.exe$/i.test(path.basename(file)));
        if (uninstaller) {
          checked(uninstaller, ['/S']);
          // NSIS may exit its original process before its temporary uninstaller.
          await until(() => !fs.existsSync(path.join(target, 'datam8.exe')), `uninstall ${name}`);
        }
      }
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
  try { await fs.promises.rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); }
  catch (error) { cleanupFailures.push(error); }
  fs.writeFileSync(path.join(diagnostics, 'update.log'), logs.join('\n'));
}
if (failure || cleanupFailures.length) throw new AggregateError([failure, ...cleanupFailures].filter(Boolean), 'Signed update acceptance failed');
