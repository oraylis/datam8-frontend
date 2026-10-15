import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('final delivery records the version and pinned source identities and rejects incomplete distributions', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 final manifest '));
  const run = () => spawnSync(process.execPath, ['scripts/final-desktop-manifest.mjs', temporary], {
    encoding: 'utf8', env: { ...process.env, GITHUB_SHA: 'reviewed-frontend-commit', GITHUB_REPOSITORY: 'oraylis/datam8-frontend', GITHUB_RUN_ID: '123', DATAM8_GPG_FINGERPRINT: 'test-fingerprint' },
  });
  try {
    fs.writeFileSync(path.join(temporary, 'windows.json'), JSON.stringify({ thumbprint: 'test-thumbprint' }));
    for (const name of ['DataM8.exe', 'DataM8-mac-x64.dmg', 'DataM8-mac-x64.zip', 'DataM8-mac-arm64.dmg', 'DataM8-mac-arm64.zip', 'DataM8.AppImage']) fs.writeFileSync(path.join(temporary, name), 'fixture');
    assert.notEqual(run().status, 0, 'DEB is required alongside AppImage');
    fs.writeFileSync(path.join(temporary, 'datam8.deb'), 'fixture');
    fs.writeFileSync(path.join(temporary, 'latest-mac.yml'), 'fixture');
    assert.notEqual(run().status, 0, 'a macOS update feed is not supported');
    fs.unlinkSync(path.join(temporary, 'latest-mac.yml'));
    fs.renameSync(path.join(temporary, 'DataM8.exe'), path.join(temporary, 'DataM8 Setup.exe'));
    const unsafe = run();
    assert.notEqual(unsafe.status, 0);
    assert.match(unsafe.stderr, /Release filenames must be GitHub-safe/);
    fs.renameSync(path.join(temporary, 'DataM8 Setup.exe'), path.join(temporary, 'DataM8.exe'));
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(temporary, 'BUILD-MANIFEST.json'), 'utf8'));
    assert.equal(manifest.version, JSON.parse(fs.readFileSync('apps/desktop/package.json', 'utf8')).version);
    assert.equal(manifest.commit, 'reviewed-frontend-commit');
    assert.match(manifest.generatorCommit, /^[0-9a-f]{40}$/);
    assert.match(manifest.modelCommit, /^[0-9a-f]{40}$/);
    assert.equal(manifest.workflow, 'https://github.com/oraylis/datam8-frontend/actions/runs/123');
    assert.equal(manifest.windows.thumbprint, 'test-thumbprint');
    assert.equal(manifest.files.filter(file => file.name !== 'windows.json').length, 7);
    const guide = fs.readFileSync(path.join(temporary, 'INSTALL-AND-VERIFY.md'), 'utf8');
    assert.match(guide, /reviewed-frontend-commit\/docs\/signing\//);
  } finally {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('DataM8 final manifest '));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
