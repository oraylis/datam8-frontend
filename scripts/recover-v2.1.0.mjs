// One-time recovery of immutable v2.1.0 packages; never rebuild or move the tag.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const source = Object.freeze({ repository: 'oraylis/datam8-frontend', run: 39659653648,
  commit: 'fd8ef498c4a87dfd49f36a7e5ebd0f6a38d04b42', tag: 'v2.1.0' });
export const artifactNames = ['internal-platform-win-x64', 'internal-platform-mac-x64',
  'internal-platform-mac-arm64', 'internal-platform-linux-x64', 'internal-manual-mac-x64',
  'internal-manual-mac-arm64', 'internal-manual-linux-x64', 'internal-update-fixtures'];
const api = endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
const paged = (endpoint, key) => JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', endpoint], { encoding: 'utf8' })).flatMap(page => page[key]);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const provenancePath = 'artifacts/recovery-source/RECOVERY-PROVENANCE.json';

export function validateSource(run, jobs, artifacts) {
  assert.equal(run.id, source.run);
  assert.equal(run.repository.full_name, source.repository);
  assert.equal(run.head_repository.full_name, source.repository);
  assert.equal(run.path, '.github/workflows/release.yml');
  assert.equal(run.event, 'push');
  assert.equal(run.head_branch, source.tag);
  assert.equal(run.head_sha, source.commit);
  assert.equal(run.status, 'completed');
  const required = ['validate', 'verified / quality / scope', 'verified / quality / ci',
    'verified / quality / CI result', 'verified / build (windows-2025, win, x64)',
    'verified / build (macos-15-intel, mac, x64)', 'verified / build (macos-15, mac, arm64)',
    'verified / build (ubuntu-24.04, linux, x64)'];
  for (const name of required) {
    const matching = jobs.filter(job => job.name === name);
    assert.equal(matching.length, 1, `Ambiguous or missing job: ${name}`);
    assert.equal(matching[0].conclusion, 'success', `Required source job failed: ${name}`);
  }
  return artifactNames.map(name => {
    const matching = artifacts.filter(artifact => artifact.name === name);
    assert.equal(matching.length, 1, `Ambiguous or missing artifact: ${name}`);
    const artifact = matching[0];
    assert.equal(artifact.expired, false, `Expired artifact: ${name}`);
    assert.ok(artifact.size_in_bytes > 0);
    assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(artifact.workflow_run.id, source.run);
    assert.equal(artifact.workflow_run.head_sha, source.commit);
    return { id: artifact.id, name, digest: artifact.digest, bytes: artifact.size_in_bytes };
  });
}

export function checkTestCorrection(original, actual) {
  const oldExpectation = ".toBe('https://github.com/oraylis/datam8-frontend/releases/tag/v2.1.0')";
  const newExpectation = '.toBe(`https://github.com/oraylis/datam8-frontend/releases/tag/v${state.version}`)';
  assert.ok(original.includes(oldExpectation));
  assert.equal(actual.replaceAll('\r\n', '\n'), original.replace(oldExpectation, newExpectation).replaceAll('\r\n', '\n'), 'Only the reviewed URL expectation may change');
}
export function checkTree() {
  assert.equal(git('rev-parse', `${source.tag}^{commit}`), source.commit, 'Release tag changed');
  git('merge-base', '--is-ancestor', source.commit, 'HEAD');
  const allowed = new Set(['apps/desktop/e2e-packaged/solution.spec.mjs',
    '.github/workflows/recover-v2.1.0.yml', '.github/workflows/ci.yml',
    'scripts/recover-v2.1.0.mjs', 'scripts/recover-v2.1.0.test.mjs', 'docs/release.md']);
  for (const name of git('diff', '--name-only', source.commit, 'HEAD').split('\n').filter(Boolean)) {
    assert.ok(allowed.has(name), `Recovery cannot change build inputs: ${name}`);
  }
  const testFile = 'apps/desktop/e2e-packaged/solution.spec.mjs';
  const original = execFileSync('git', ['show', `${source.commit}:${testFile}`], { encoding: 'utf8' });
  checkTestCorrection(original, fs.readFileSync(testFile, 'utf8'));
}

async function main() {
  const [operation, name, destination] = process.argv.slice(2);
  if (operation === 'validate') {
    assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
    assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
    assert.equal(process.env.REF_PROTECTED, 'true');
    assert.equal(process.env.GITHUB_REPOSITORY, source.repository);
    checkTree();
    const prefix = `repos/${source.repository}/actions/runs/${source.run}`;
    const run = api(prefix);
    const artifacts = validateSource(run, paged(`${prefix}/jobs?filter=latest&per_page=100`, 'jobs'), paged(`${prefix}/artifacts?per_page=100`, 'artifacts'));
    // The tag, CLI pin, npm lock and all package inputs are unchanged by checkTree.
    const provenance = { build: { ...source, attempt: run.run_attempt },
      verification: { commit: process.env.GITHUB_SHA, workflow: `https://github.com/${source.repository}/actions/runs/${process.env.GITHUB_RUN_ID}` }, artifacts };
    fs.mkdirSync(path.dirname(provenancePath), { recursive: true });
    fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
    console.log(JSON.stringify(provenance));
  } else if (operation === 'download') {
    const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
    assert.deepEqual(provenance.build.repository, source.repository);
    assert.equal(provenance.build.commit, source.commit);
    assert.equal(provenance.build.run, source.run);
    assert.equal(provenance.verification.commit, process.env.GITHUB_SHA);
    const artifact = provenance.artifacts.find(item => item.name === name);
    assert.ok(artifact && artifactNames.includes(name), 'Unapproved source artifact');
    const archive = path.resolve(`artifacts/recovery-${artifact.id}.zip`);
    const fd = fs.openSync(archive, 'w');
    try {
      execFileSync('gh', ['api', `repos/${source.repository}/actions/artifacts/${artifact.id}/zip`, '--allow-escape-sequences'], { stdio: ['ignore', fd, 'inherit'] });
    } finally { fs.closeSync(fd); }
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
    assert.equal(`sha256:${hash.digest('hex')}`, artifact.digest, `Source archive changed: ${name}`);
    fs.mkdirSync(destination, { recursive: true });
    execFileSync('python', ['-m', 'zipfile', '-e', archive, destination], { stdio: 'inherit' });
    fs.unlinkSync(archive);
    console.log(`Verified immutable source artifact: ${name} (${artifact.digest})`);
  } else if (operation === 'manifest') {
    execFileSync(process.execPath, ['scripts/final-desktop-manifest.mjs', name], { env: { ...process.env, GITHUB_SHA: source.commit }, stdio: 'inherit' });
    const manifestPath = path.join(name, 'BUILD-MANIFEST.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
    assert.equal(manifest.commit, source.commit);
    assert.equal(manifest.version, '2.1.0');
    assert.equal(provenance.verification.commit, process.env.GITHUB_SHA);
    manifest.recovery = provenance;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  } else throw new Error(`Unknown recovery operation: ${operation}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
