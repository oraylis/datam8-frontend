import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { readSolutionText, writeSolutionText } from '../apps/desktop/dist/solutionEncoding.js';

function withFile(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'datam8-cp1252-'));
  try {
    run(path.join(directory, 'Test.dm8s'));
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('datam8-cp1252-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('solution files round-trip all defined Windows-1252 bytes including euro and quotes', () => {
  withFile(file => {
    const undefinedBytes = [0x81, 0x8d, 0x8f, 0x90, 0x9d];
    const bytes = Buffer.from(Array.from({ length: 256 }, (_, byte) => byte)
      .filter(byte => !undefinedBytes.includes(byte)));
    fs.writeFileSync(file, bytes);
    const text = readSolutionText(file);
    assert.ok(text.includes('ü'));
    assert.ok(text.includes('€'));
    assert.ok(text.includes('“'));
    writeSolutionText(file, text);
    assert.deepEqual(fs.readFileSync(file), bytes);
  });
});

test('unsupported text and invalid bytes fail without overwriting an existing file', () => {
  withFile(file => {
    writeSolutionText(file, 'für Größe €');
    const before = fs.readFileSync(file);
    assert.throws(() => writeSolutionText(file, '東京'), /Cannot write U\+6771 as Windows-1252/);
    assert.deepEqual(fs.readFileSync(file), before);
    fs.writeFileSync(file, Uint8Array.of(0x81));
    assert.throws(() => readSolutionText(file), /Invalid Windows-1252 byte/);
  });
});

test('Windows backend reads desktop JSON and its saved file remains readable in the desktop', {
  skip: process.platform !== 'win32' ? 'Pinned backend uses the platform default; this variant targets Windows.' : false,
}, () => {
  withFile(file => {
    const root = path.resolve(import.meta.dirname, '..');
    const backend = path.join(root, 'submodules/datam8-generator');
    const python = process.env.DATAM8_TEST_PYTHON || path.join(backend, '.venv/Scripts/python.exe');
    const solution = {
      schemaVersion: '2.0.0', basePath: 'Basis für Größe €', modelPath: 'Model', pluginsPath: 'Plugins',
      generatorTargets: [{ name: 'test', sourcePath: 'Generate', outputPath: 'Output' }],
    };
    writeSolutionText(file, JSON.stringify(solution));
    const result = execFileSync(python, ['-X', 'utf8=0', '-c', `
import json, sys
from pathlib import Path
from datam8_model.solution import Solution
path = Path(sys.argv[1])
solution = Solution.from_json_file(path)
solution.to_json_file(path, "w", {"exclude_none": True})
print(json.dumps(str(solution.basePath)))
`, file], { cwd: backend, encoding: 'utf8', env: { ...process.env, PYTHONPATH: path.join(backend, 'src') } });
    assert.equal(JSON.parse(result), solution.basePath);
    assert.equal(JSON.parse(readSolutionText(file)).basePath, solution.basePath);
    assert.ok(fs.readFileSync(file).includes(0xfc));
    assert.ok(fs.readFileSync(file).includes(0x80));
  });
});
