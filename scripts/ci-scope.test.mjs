import assert from 'node:assert/strict';
import test from 'node:test';
import { checkResults, documentationOnly } from './ci-scope.mjs';

test('only prose and documentation images take the documentation path', () => {
  for (const files of [['README.md'], ['AGENTS.md', 'docs/guide.md'], ['docs/images/screen.png', 'docs/diagram.svg']]) {
    assert.equal(documentationOnly(files), true);
  }
  for (const files of [
    [], ['docs/guide.md', 'src/app.py'], ['docs/signing/README.md'],
    ['docs/signing/key.asc'], ['submodules/datam8-generator'], ['datam8-model'],
    ['.github/workflows/ci.yml'], ['scripts/example.md'], ['schema/example.json'],
    ['uv.lock'], ['docs/settings.json'],
  ]) assert.equal(documentationOnly(files), false, JSON.stringify(files));
});

test('the required result accepts only the declared successful or documentation-only path', () => {
  const needs = (docs, result) => ({
    scope: { result: 'success', outputs: { docs_only: docs } },
    quality: { result },
  });
  assert.doesNotThrow(() => checkResults(needs('false', 'success')));
  assert.doesNotThrow(() => checkResults(needs('true', 'skipped')));
  for (const docs of ['true', 'false']) {
    for (const result of ['failure', 'cancelled', undefined]) {
      assert.throws(() => checkResults(needs(docs, result)));
    }
  }
  assert.throws(() => checkResults(needs('false', 'skipped')));
  assert.throws(() => checkResults(needs('true', 'success')));
  assert.throws(() => checkResults(needs(undefined, 'success')));
  assert.throws(() => checkResults({ ...needs('false', 'success'), scope: { result: 'failure' } }));
  assert.throws(() => checkResults({ scope: { result: 'success', outputs: { docs_only: 'true' } } }));
});
