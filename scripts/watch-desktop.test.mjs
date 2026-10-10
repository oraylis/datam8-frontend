import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { watchDesktop } from './watch-desktop.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await sleep(100);
  }
  assert.fail('Development process did not reach the expected state');
}
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 compiler watch '));
  fs.mkdirSync(path.join(directory, 'src'));
  fs.mkdirSync(path.join(directory, 'resources'));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ main: 'dist/main.js' }));
  fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'es2022', module: 'commonjs', outDir: 'dist', rootDir: 'src', types: [], skipLibCheck: true }, include: ['src'] }));
  const trace = path.join(directory, 'trace.log');
  const main = path.join(directory, 'src/main.ts');
  const code = `declare const process: any; declare function require(name: string): any;
const fs = require('node:fs');
const record = (state: string) => fs.appendFileSync(${JSON.stringify(trace)}, state + ':' + process.pid + '\\n');
record('start');
const shutdown = () => setTimeout(() => { record('stop'); process.exit(0); }, 150);
process.on('SIGTERM', shutdown);
process.on('message', (message: any) => { if (message.type === 'development:shutdown') shutdown(); });
setInterval(() => {}, 1000);
`;
  const records = () => fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n') : [];
  return { directory, main, code, records, remove: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

test('waits for valid compilation, ignores identical emissions, and restarts after the previous process exits', async () => {
  const f = fixture();
  fs.writeFileSync(f.main, `${f.code}\nconst invalid: number = 'error';\n`);
  const messages = [];
  const watcher = watchDesktop({ appDir: f.directory, executablePath: process.execPath, log: message => messages.push(message) });
  try {
    await sleep(400);
    assert.deepEqual(f.records(), []);
    assert.equal(fs.existsSync(path.join(f.directory, 'dist/main.js')), false);
    fs.writeFileSync(f.main, f.code);
    await until(() => f.records().length === 1);
    assert.match(f.records()[0], /^start:/);
    const mainOutput = path.join(f.directory, 'dist/main.js');
    for (let i = 0; i < 5; i++) fs.writeFileSync(mainOutput, fs.readFileSync(mainOutput));
    await sleep(700);
    assert.equal(f.records().length, 1, 'An identical rebuild must not restart');
    fs.writeFileSync(f.main, `${f.code}\nconst invalidAgain: number = 'error';\n`);
    await sleep(1200);
    assert.equal(f.records().length, 1, 'A failed compilation keeps the current process');
    fs.writeFileSync(f.main, `${f.code}\nconsole.log('valid changed build');\n`);
    await until(() => f.records().length === 3);
    assert.match(f.records()[1], /^stop:/);
    assert.match(f.records()[2], /^start:/);
    assert.notEqual(f.records()[0], f.records()[2]);
    // Several output changes, including preload, are a single completed batch.
    fs.appendFileSync(mainOutput, '\n// changed main output\n');
    fs.writeFileSync(path.join(f.directory, 'dist/preload.js'), '// changed preload\n');
    fs.writeFileSync(path.join(f.directory, 'resources/example.cjs'), '// changed resource\n');
    await until(() => f.records().length === 5);
    await sleep(600);
    assert.equal(f.records().length, 5, 'One restart for main/preload/resource batch');
    fs.writeFileSync(path.join(f.directory, 'resources/example.cjs'), '// second resource\n');
    await until(() => f.records().length === 7);
    assert.equal(messages.filter(message => message.includes('Starting Electron.')).length, 4);
  } finally {
    await watcher.close();
    assert.match(f.records().at(-1), /^stop:/);
    f.remove();
  }
});

test('closing before the initial launch cancels it and is idempotent', async () => {
  const f = fixture();
  fs.writeFileSync(f.main, f.code);
  const watcher = watchDesktop({ appDir: f.directory, executablePath: process.execPath, log: () => {} });
  try {
    await Promise.all([watcher.close(), watcher.close()]);
    await sleep(400);
    assert.deepEqual(f.records(), []);
  } finally { f.remove(); }
});

test('coalesces changes received during shutdown and cancels an in-flight restart on close', async () => {
  const f = fixture();
  // A slower shutdown makes the ordering and cancellation observable.
  fs.writeFileSync(f.main, f.code.replace('}, 150)', '}, 700)'));
  const messages = [];
  const watcher = watchDesktop({ appDir: f.directory, executablePath: process.execPath, settleMs: 50, log: message => messages.push(message) });
  const resource = path.join(f.directory, 'resources/example.cjs');
  try {
    await until(() => f.records().length === 1);
    fs.writeFileSync(resource, '// first change\n');
    await until(() => messages.some(message => message.includes('Restarting Electron')));
    fs.writeFileSync(resource, '// latest change during shutdown\n');
    await until(() => f.records().length === 3);
    await sleep(500);
    assert.equal(f.records().length, 3, 'The replacement starts with the latest complete files');
    fs.writeFileSync(resource, '// pending restart to cancel\n');
    await until(() => messages.filter(message => message.includes('Restarting Electron')).length === 2);
    await watcher.close();
    assert.equal(f.records().length, 4);
    assert.match(f.records()[3], /^stop:/);
  } finally { await watcher.close(); f.remove(); }
});


test('a resource edit cannot restart ahead of a pending failed source compilation', async () => {
  const f = fixture();
  fs.writeFileSync(f.main, f.code);
  const watcher = watchDesktop({ appDir: f.directory, executablePath: process.execPath, settleMs: 50, log: () => {} });
  try {
    await until(() => f.records().length === 1);
    fs.writeFileSync(f.main, `${f.code}\nconst invalid: number = 'error';\n`);
    fs.writeFileSync(path.join(f.directory, 'resources/example.cjs'), '// resource in the same edit\n');
    await sleep(1000);
    assert.equal(f.records().length, 1, 'The last valid process must remain running');
    fs.writeFileSync(f.main, `${f.code}\n// repaired source\n`);
    await until(() => f.records().length === 3);
  } finally { await watcher.close(); f.remove(); }
});
