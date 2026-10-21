import assert from 'node:assert/strict';
import test from 'node:test';
import { source, artifactNames, validateSource, checkTestCorrection } from './recover-v2.1.0.mjs';

const fixture = () => ({
  run: { id: source.run, repository: { full_name: source.repository }, head_repository: { full_name: source.repository },
    path: '.github/workflows/release.yml', event: 'push', head_branch: source.tag, head_sha: source.commit, status: 'completed' },
  jobs: ['validate', 'verified / quality / scope', 'verified / quality / ci', 'verified / quality / CI result',
    'verified / build (windows-2025, win, x64)', 'verified / build (macos-15-intel, mac, x64)',
    'verified / build (macos-15, mac, arm64)', 'verified / build (ubuntu-24.04, linux, x64)'].map(name => ({ name, conclusion: 'success' })),
  artifacts: artifactNames.map((name, id) => ({ id: id + 1, name, expired: false, size_in_bytes: 100,
    digest: 'sha256:' + 'a'.repeat(64), workflow_run: { id: source.run, head_sha: source.commit } })),
});
test('recovery accepts only completed release builds with all eight immutable source artifacts', () => {
  const { run, jobs, artifacts } = fixture();
  assert.equal(validateSource(run, jobs, artifacts).length, 8);
});
test('recovery rejects foreign sources, failed builds, missing, expired and mismatched artifacts', () => {
  for (const mutate of [
    f => { f.run.head_repository.full_name = 'other/repo'; },
    f => { f.run.head_sha = 'b'.repeat(40); },
    f => { f.run.event = 'pull_request'; },
    f => { f.run.status = 'in_progress'; },
    f => { f.jobs[4].conclusion = 'failure'; },
    f => { f.artifacts.pop(); },
    f => { f.artifacts.push(f.artifacts[0]); },
    f => { f.artifacts[0].expired = true; },
    f => { f.artifacts[0].digest = null; },
    f => { f.artifacts[0].workflow_run.id++; },
    f => { f.artifacts[0].workflow_run.head_sha = 'c'.repeat(40); },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => validateSource(f.run, f.jobs, f.artifacts));
  }
});
test('native-test recovery rejects removed assertions and any additional test changes', () => {
  const before = "expect(link).toBe('https://github.com/oraylis/datam8-frontend/releases/tag/v2.1.0');\nexpect(state.phase).toBe('available');\n";
  const after = "expect(link).toBe(`https://github.com/oraylis/datam8-frontend/releases/tag/v${state.version}`);\nexpect(state.phase).toBe('available');\n";
  assert.doesNotThrow(() => checkTestCorrection(before, after));
  assert.throws(() => checkTestCorrection(before, after.replace("expect(state.phase).toBe('available');", '')));
  assert.throws(() => checkTestCorrection(before, before));
});
