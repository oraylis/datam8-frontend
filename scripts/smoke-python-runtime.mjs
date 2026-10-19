import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildPythonEnv } from '../apps/desktop/resources/backend-env.cjs';
import { waitForBackendReady, waitForBackendHealth } from '../apps/desktop/resources/backend-startup.cjs';
import { terminateChild } from '../apps/desktop/resources/backend-lifecycle.cjs';
import { validateMacBinaries } from './mac-runtime.mjs';
import { unusedLoopbackPort } from './test-port.mjs';
import { desktopFixture } from './desktop-fixture.mjs';
import { installRuntimePlugin, legacyRuntimeFixture } from './runtime-test-fixtures.mjs';
import { assertReportOutsideRuntime, assertRuntimeUnchanged, selectRuntimePython, snapshotRuntime } from './runtime-test-support.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const redact = text => String(text).replace(/(--token[\s=]+|Bearer\s+)[^\s"']+/gi, '$1[redacted]');
function fail(message) { throw new Error(`[smoke-python-runtime] ${message}`); }
function parseArgs(argv) {
  const parsed = {};
  const values = new Set(['runtime-root', 'resources', 'release-dir', 'python', 'fixture', 'port', 'report']);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (argv[i] === '--secrets-roundtrip') { parsed[key] = true; continue; }
    if (!argv[i].startsWith('--') || !values.has(key)) fail(`Unknown argument: ${argv[i]}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) fail(`Missing value for --${key}`);
    parsed[key] = value;
  }
  return parsed;
}
function resolveRuntimeRoot(args) {
  if (args['runtime-root']) return fs.realpathSync(args['runtime-root']);
  const search = path.resolve(args.resources || args['release-dir'] || path.join(repoRoot, 'apps/desktop/release'));
  const matches = [];
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    if (path.basename(dir) === 'python-runtime') { matches.push(fs.realpathSync(dir)); return; }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) visit(path.join(dir, entry.name));
  }
  visit(search);
  if (matches.length !== 1) fail(`Expected one python-runtime under ${search}, found ${matches.length}; select --runtime-root explicitly`);
  return matches[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtimeRoot = resolveRuntimeRoot(args);
  const python = selectRuntimePython(runtimeRoot, args.python);
  const reportPath = args.report && path.resolve(args.report);
  if (reportPath) assertReportOutsideRuntime(runtimeRoot, reportPath);
  const before = snapshotRuntime(runtimeRoot);
  const report = { runtimeRoot, python, platform: process.platform, arch: process.arch,
    inventory: { files: before.files, bytes: before.bytes, symlinks: before.symlinks }, cases: [] };
  // Original regular-file inventories from the published v2.0.1 distributions.
  const originals = { 'win32-x64': 8698, 'darwin-arm64': 4945, 'darwin-x64': 4963, 'linux-x64': 11697 };
  const baseline = originals[`${process.platform}-${process.arch}`];
  if (baseline) report.comparison = { release: 'v2.0.1', originalRegularFiles: baseline,
    reductionPercent: Number(((1 - before.files / baseline) * 100).toFixed(1)),
    scope: 'Python runtime regular files; distribution and dependency versions may differ',
    source: 'https://github.com/oraylis/datam8-frontend/releases/tag/v2.0.1' };
  const manifest = path.join(runtimeRoot, 'runtime-manifest.json');
  if (fs.existsSync(manifest)) report.preparation = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 runtime ü '));
  const env = buildPythonEnv(python, runtimeRoot, { ...process.env,
    PYTHONHOME: '/invalid/host-python', PYTHONPATH: '/invalid/host-modules',
    PYTHONUSERBASE: '/invalid/user-python', VIRTUAL_ENV: '/invalid/venv' });
  const fixture = desktopFixture(temp, 'Solution copy');
  const solutionDir = path.dirname(fixture);
  const legacy = legacyRuntimeFixture(temp);
  const legacyBefore = snapshotRuntime(path.dirname(legacy));
  const migrated = path.join(temp, 'Migrated solution', path.basename(legacy));
  const created = path.join(temp, 'Created solution', 'Created.dm8s');
  const verifyScript = path.join(repoRoot, 'scripts/verify-python-runtime.py');
  let pluginDir;
  const run = commandArgs => {
    const result = spawnSync(python, commandArgs, { env, cwd: temp, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    if (result.error || result.status !== 0) fail(`${commandArgs[0]} failed: ${redact(result.error?.message || result.stderr || result.stdout || `exit ${result.status}`)}`);
    if (result.stdout.trim()) console.log(redact(result.stdout.trim()));
  };
  const cli = (...commandArgs) => run(['-m', 'datam8', ...commandArgs]);
  const check = (name, ...extra) => run([verifyScript, runtimeRoot, name, ...extra]);
  async function test(name, fn) {
    try { await fn(); report.cases.push({ name, status: 'passed' }); console.log(`PASS: ${name}`); }
    catch (error) { const detail = redact(error.stack || error.message); report.cases.push({ name, status: 'failed', detail }); console.error(`FAIL: ${name}\n${detail}`); }
  }
  async function backend(solution, verify) {
    const port = args.port || await unusedLoopbackPort();
    const token = randomBytes(24).toString('hex');
    const proc = spawn(python, ['-u', '-m', 'datam8', 'serve', '--host', '127.0.0.1', '--port', String(port),
      '--token', token, '--solution', solution, '--workspace-switch', '--log-level', 'warning'],
    { env, cwd: temp, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    const append = chunk => { output = (output + chunk).slice(-8192); };
    proc.stdout.on('data', append); proc.stderr.on('data', append);
    try {
      const ready = await waitForBackendReady(proc);
      const expected = `http://127.0.0.1:${port}`;
      assert.equal(ready.baseUrl.replace(/\/$/, ''), expected);
      await waitForBackendHealth(expected, token);
      let workspaceId;
      async function request(route, method = 'GET', body, status = 200, authenticated = true) {
        const response = await fetch(`${expected}${route}`, { method,
          headers: { ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
            ...(workspaceId ? { 'X-DataM8-Workspace': workspaceId } : {}), 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000) });
        const text = await response.text();
        assert.equal(response.status, status, `${method} ${route}: ${text}`);
        return text ? JSON.parse(text) : null;
      }
      workspaceId = (await request('/workspace')).workspaceId;
      assert.ok(workspaceId);
      await verify(request);
    } catch (error) { throw new Error(`${error.message}\n${redact(output)}`, { cause: error }); }
    finally { await terminateChild(proc); }
  }
  try {
    await test('bootstrap, retained resources, native drivers and builtin plugins', () => {
      if (process.platform === 'darwin') validateMacBinaries(runtimeRoot);
      check('resources');
    });
    await test('CLI init creates a loadable solution', async () => {
      fs.mkdirSync(path.dirname(created));
      cli('init', 'Created', '--solution', created, '--type', 'empty');
      const solution = JSON.parse(fs.readFileSync(created, 'utf8'));
      assert.equal(solution.schemaVersion, '2.0.0');
      assert.ok(fs.existsSync(path.join(path.dirname(created), solution.basePath, 'DataTypes.json')));
      await backend(created, async request => { await request('/solution/full'); });
    });
    await test('CLI migration preserves source and converts model and Python payload', async () => {
      try { cli('migrate', 'v1-to-v2', '--solution', legacy, '--output-dir', path.dirname(migrated)); }
      finally { assertRuntimeUnchanged(legacyBefore, snapshotRuntime(path.dirname(legacy))); }
      const entity = JSON.parse(fs.readFileSync(path.join(path.dirname(migrated), 'Model/Core/Sales/Customers/Customer.json'), 'utf8'));
      assert.equal(entity.name, 'Customer');
      assert.equal(entity.description, 'Migrated runtime fixture');
      assert.equal(entity.attributes[0].name, 'CustomerId');
      assert.equal(entity.attributes[0].dataType.type, 'int');
      assert.equal(fs.readFileSync(path.join(path.dirname(migrated), 'Model/Core/Sales/Customers/Customer.py'), 'utf8'), '# Retained migration payload\n');
      await backend(migrated, async request => { await request('/solution/full'); });
    });
    await test('CLI generation executes custom Python payload and Jinja template', () => {
      cli('generate', 'test', '--solution', fixture, '--clean-output');
      assert.equal(fs.readFileSync(path.join(solutionDir, 'Output/generated/hello.txt'), 'utf8').trim(), 'Hello world');
    });
    await test('secret backend available', () => check('secrets', fixture));
    await test('encrypted secret set, read, overwrite and delete across independent runs', () => {
      check('encrypted-secrets-roundtrip', fixture);
      check('encrypted-secrets-roundtrip', fixture);
      assert.deepEqual(fs.readdirSync(solutionDir).filter(name => name.startsWith('test-keyring-')), []);
    });
    if (args['secrets-roundtrip']) await test('isolated secret set, read, overwrite and delete', () => check('secrets-roundtrip', fixture));
    else {
      const reason = 'Enable --secrets-roundtrip on a disposable test account';
      report.cases.push({ name: 'isolated secret set, read, overwrite and delete', status: 'skipped', reason });
      console.log(`SKIP: isolated secret set, read, overwrite and delete (${reason})`);
    }
    await test('local source fixture setup', () => { check('prepare-sources', fixture); pluginDir = installRuntimePlugin(solutionDir); });
    await test('serve readiness, API authentication and persisted editor changes', async () => {
      await backend(fixture, async request => {
        await request('/health', 'GET', undefined, 204, false);
        await request('/version'); await request('/config'); await request('/solution/full');
        await request('/config', 'GET', undefined, 401, false);
        const locator = 'modelEntities/Core/Customer';
        await request(`/entities/${locator}`, 'PATCH', { description: 'Saved by runtime test' });
        await request('/model/save', 'POST', { locator }, 204);
        const file = path.join(solutionDir, 'Model/Core/Customer.json');
        assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).description, 'Saved by runtime test');
        await request('/model/reload?force=true', 'POST');
        assert.equal((await request(`/entities/${locator}`)).items[0].entity.description, 'Saved by runtime test');
      });
    });
    await test('custom plugin resources and reload', async () => {
      assert.ok(pluginDir, 'Source fixture setup must pass');
      await backend(fixture, async request => {
        assert.ok((await request('/plugins')).items.some(item => item.id === 'runtime_fixture'));
        const route = '/plugins/runtime_fixture/connection-properties';
        assert.equal((await request(route)).items.at(-1).default, 'first');
        fs.writeFileSync(path.join(pluginDir, 'resource.txt'), JSON.stringify({ marker: 'reloaded' }));
        const source = path.join(pluginDir, '__init__.py');
        fs.writeFileSync(source, fs.readFileSync(source, 'utf8').replace('default=marker', 'default="updated-" + marker'));
        await request('/plugins/reload', 'POST');
        assert.equal((await request(route)).items.at(-1).default, 'updated-reloaded');
      });
    });
    await test('local CSV and ODCS metadata, preview, import and reload', async () => {
      await backend(fixture, async request => {
        for (const [source, location, name, types] of [
          ['Csv', 'orders.csv', 'Orders', ['decimal', 'string']],
          ['Odcs', 'contract.json#customers', 'ContractCustomers', ['long', 'string']],
        ]) {
          await request(`/sources/${source}/test`);
          const metadata = await request(`/sources/${source}/locations/metadata?source_location=${encodeURIComponent(location)}`);
          assert.deepEqual(metadata.items.map(field => field.name), ['id', 'name']);
          if (source === 'Csv') {
            const preview = await request(`/sources/Csv/locations/preview?source_location=${location}&limit=1`);
            assert.deepEqual(preview.items, [{ id: 1, name: 'Müller' }]);
          }
          await request(`/sources/${source}/import`, 'PUT', { locator: `modelEntities/Core/${name}`, sourceLocation: location });
          const file = path.join(solutionDir, 'Model/Core', `${name}.json`);
          const entity = JSON.parse(fs.readFileSync(file, 'utf8'));
          assert.deepEqual(entity.attributes.map(attribute => attribute.dataType.type), types);
          await request('/model/reload?force=true', 'POST');
          assert.equal((await request(`/entities/modelEntities/Core/${name}`)).items[0].entity.sources[0].sourceLocation, location);
        }
      });
    });
    if (args.fixture || process.env.DATAM8_RUNTIME_SMOKE_SOLUTION) await test('additional supplied solution loads', async () => {
      const source = path.resolve(args.fixture || process.env.DATAM8_RUNTIME_SMOKE_SOLUTION);
      const copy = path.join(temp, 'Additional solution');
      fs.cpSync(path.dirname(source), copy, { recursive: true });
      await backend(path.join(copy, path.basename(source)), async request => { await request('/solution/full'); });
    });
  } finally {
    await test('runtime files and native bundle remain unchanged', () => {
      assertRuntimeUnchanged(before, snapshotRuntime(runtimeRoot));
      if (process.platform === 'darwin') validateMacBinaries(runtimeRoot);
    });
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    const failed = report.cases.filter(item => item.status === 'failed').length;
    console.log(`[smoke-python-runtime] ${report.cases.filter(item => item.status === 'passed').length} passed, ${failed} failed, ${report.cases.filter(item => item.status === 'skipped').length} skipped; ${before.files} files, ${before.bytes} bytes`);
    if (reportPath) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); }
    if (failed) process.exitCode = 1;
  }
}
main().catch(error => { console.error(redact(error.stack || error)); process.exitCode = 1; });
