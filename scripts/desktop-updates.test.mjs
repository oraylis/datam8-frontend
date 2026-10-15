import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { releaseFixture } from '../apps/desktop/resources/dev-fixtures.cjs';
const require = createRequire(import.meta.url);
const { selectRelease, compareVersions, notesExcerpt, loopback, requireWindowsPublisher } = require('../apps/desktop/resources/update-policy.cjs');
const { DesktopUpdates } = require('../apps/desktop/dist/updates.js');

test('release selection excludes drafts, incompatible/incomplete packages, downgrades and beta on stable', () => {
  const stable = releaseFixture('2.1.0'), beta = releaseFixture('2.2.0-beta.1'), incomplete = releaseFixture('4.0.0');
  incomplete.assets = incomplete.assets.filter(a => a.name !== 'SHA256SUMS.asc');
  const input = [releaseFixture('9.0.0', 'draft'), beta, incomplete, stable]; input[0].draft = true;
  assert.equal(selectRelease(input, '2.0.0', 'darwin', 'arm64'), stable);
  assert.equal(selectRelease(input, '2.0.0-beta.6', 'darwin', 'x64'), beta);
  assert.equal(selectRelease([releaseFixture('9.0.0-alpha.1'), releaseFixture('9.0.0-rc.1'), beta], '2.0.0-beta.6', 'linux', 'x64'), beta);
  assert.equal(selectRelease(input, '2.3.0', 'linux', 'x64'), null);
  assert.equal(selectRelease(input, '2.0.0', 'darwin', 'ppc'), null);
  assert.equal(selectRelease([stable], '2.0.0', 'win32', 'x64'), stable);
  stable.assets = stable.assets.filter(a => !a.name.endsWith('arm64.zip.asc'));
  assert.equal(selectRelease([stable], '2.0.0', 'darwin', 'arm64'), null);
});
test('semantic version order handles stable, numeric prereleases and build metadata', () => {
  assert(compareVersions('2.0.0-beta.10', '2.0.0-beta.9') > 0);
  assert(compareVersions('2.0.0', '2.0.0-beta.10') > 0);
  assert.equal(compareVersions('2.0.0+local', '2.0.0'), 0);
  assert.throws(() => compareVersions('2.0.0-beta.01', '2.0.0'));
});
test('release notes are bounded plaintext and contain no executable HTML or link destinations', () => {
  const excerpt = notesExcerpt('# Heading\n<script>alert(1)</script>\n**bold** [details](https://evil.example)\n' + 'line\n'.repeat(30));
  assert(excerpt.includes('Heading')); assert(excerpt.includes('bold details')); assert(excerpt.includes('excerpt'));
  assert(!excerpt.includes('<script>')); assert(!excerpt.includes('alert')); assert(!excerpt.includes('evil.example')); assert(!excerpt.includes('**'));
  assert(notesExcerpt('x'.repeat(3000)).length < 1300); assert.equal(notesExcerpt(''), '');
  for (const notes of ['<scr<script>ipt>alert(1)</scr</script>ipt>', '&lt;script&gt;alert(1)&lt;/script&gt;', '<!--<!-->hidden-->']) {
    assert(!notesExcerpt(notes).includes('<'));
  }
  assert.equal(notesExcerpt('&amp;lt;b&amp;gt; &amp; &lt;b&gt;Text&lt;/b&gt;'), '&lt;b&gt; & Text');
});
test('test servers accept only loopback HTTP without credentials or URL fragments', () => {
  assert.equal(loopback('http://127.0.0.1:8123/'), 'http://127.0.0.1:8123');
  for (const url of ['http://localhost:123', 'https://127.0.0.1', 'http://evil.example', 'http://x:y@127.0.0.1', 'http://127.0.0.1/#token']) assert.throws(() => loopback(url));
});
test('Windows refuses configurations that would skip publisher-signature verification', () => {
  for (const config of ['', 'provider: github\n', 'publisherName: null\n', 'publisherName: []\n', 'publisherName: ""\n']) assert.throws(() => requireWindowsPublisher(config));
  requireWindowsPublisher('provider: github\npublisherName: DataM8\n');
  requireWindowsPublisher("publisherName:\n  - 'DataM8'\nupdaterCacheDirName: datam8-updater\n");
});

function harness(overrides = {}) {
  const release = releaseFixture(); const events = [], dialogs = [], requests = [], order = [];
  const host = {
    currentVersion: '2.0.0-beta.6', platform: 'win32', arch: 'x64', packaged: true, demo: false,
    showDialog: async options => { dialogs.push(options); return options.cancelId; }, publish: status => events.push(status), progress: () => {},
    openExternal: async url => order.push(url), checkWindows: async () => release.tag_name.slice(1), downloadWindows: async () => { order.push('download'); },
    prepare: async () => { order.push('save'); return { ok: true }; }, stopBackend: async () => { order.push('stop'); }, installWindows: () => order.push('install'), releasePreparation: () => order.push('unlock'),
    fetch: async url => { requests.push(url); return Response.json(url.includes('/tags/') ? release : [release]); },
    ...overrides,
  };
  return { updates: new DesktopUpdates(host), events, dialogs, requests, order, host, release };
}
test('construction leaves updates idle and makes no release requests', () => {
  const h = harness();
  assert.equal(h.updates.status.phase, 'idle');
  assert.deepEqual(h.requests, []); assert.deepEqual(h.dialogs, []); assert.deepEqual(h.order, []);
});
test('manual checks show exact-version notes without automatic downloads; errors show a dialog', async () => {
  const h = harness(); await h.updates.check();
  assert.equal(h.updates.status.phase, 'available'); assert.equal(h.dialogs.length, 1); assert.deepEqual(h.order, []);
  assert(h.requests[1].endsWith('/releases/tags/v2.1.0'));
  assert(h.dialogs[0].detail.includes('Safer desktop updates'));
  const failed = harness({ fetch: async () => new Response('', { status: 503 }) });
  await failed.updates.check(); assert.equal(failed.dialogs.length, 1); assert.equal(failed.dialogs[0].type, 'error');
});
test('postponed installation is offered again from Check for Updates without downloading twice', async () => {
  const h = harness(); await h.updates.check(); await h.updates.download();
  const requests = h.requests.length;
  await h.updates.check();
  assert.equal(h.dialogs.at(-1).buttons[0], 'Restart and Install');
  assert.equal(h.requests.length, requests); assert.deepEqual(h.order, ['download']);
});
test('notes failure does not block a valid update; metadata mismatch blocks download', async () => {
  const h = harness({ fetch: async url => url.includes('/tags/') ? new Response('', { status: 503 }) : Response.json([releaseFixture()]) });
  await h.updates.check(); assert.equal(h.updates.status.phase, 'available'); assert.equal(h.updates.status.notesUnavailable, true);
  const bad = harness({ checkWindows: async () => '2.2.0' }); await bad.updates.check(); await bad.updates.download();
  assert.equal(bad.updates.status.phase, 'error'); assert.deepEqual(bad.order, []);
});
test('installation waits for saving and backend shutdown, and save failure never installs', async () => {
  let releaseSave; const save = new Promise(resolve => { releaseSave = resolve; });
  const h = harness({ prepare: async () => { h.order.push('save'); return save; } });
  await h.updates.check(); await h.updates.download();
  assert.deepEqual(h.order, ['download']);
  const installing = h.updates.install(true); await Promise.resolve(); assert.deepEqual(h.order, ['download', 'save']);
  releaseSave({ ok: true }); await installing; assert.deepEqual(h.order, ['download', 'save', 'stop', 'install', 'unlock']);
  const bad = harness({ prepare: async () => ({ ok: false, reason: 'Unsaved inactive tab' }) });
  await bad.updates.check(); await bad.updates.download(); await bad.updates.install(true);
  assert(!bad.order.includes('install')); assert(!bad.order.includes('stop')); assert.equal(bad.updates.status.phase, 'ready');
  assert(bad.dialogs.at(-1).detail.includes('Unsaved inactive tab'));
});
test('manual platforms open only a constructed official URL and never invoke the Windows updater', async () => {
  const h = harness({ platform: 'darwin', arch: 'arm64', checkWindows: () => { throw new Error('must not run'); } });
  await h.updates.check(); await h.updates.download(); await h.updates.install(); await h.updates.openRelease();
  assert.deepEqual(h.order, ['https://github.com/oraylis/datam8-frontend/releases/tag/v2.1.0']);
});
test('backend shutdown failure stops installation and keeps the downloaded update available', async () => {
  const h = harness({ stopBackend: async () => { throw new Error('Backend did not terminate'); } });
  await h.updates.check(); await h.updates.download(); await h.updates.install(true);
  assert.equal(h.updates.status.phase, 'ready'); assert(h.updates.status.error.includes('did not terminate'));
  assert(!h.order.includes('install')); assert(h.order.includes('unlock'));
});
test('duplicate checks and concurrent downloads are coalesced', async () => {
  let releaseDownload; const blocked = new Promise(resolve => { releaseDownload = resolve; });
  const h = harness({ downloadWindows: async () => { h.order.push('download'); await blocked; } });
  await Promise.all([h.updates.check(), h.updates.check()]); assert.equal(h.requests.length, 2);
  const pending = h.updates.download(); await h.updates.download(); assert.deepEqual(h.order, ['download']);
  releaseDownload(); await pending;
});
test('an installer-start error releases the editor and asks for a restart before retrying', async () => {
  const h = harness({ installWindows: () => h.updates.installationFailed(new Error('Installer unavailable')) });
  await h.updates.check(); await h.updates.download(); await h.updates.install(true);
  assert.equal(h.updates.status.phase, 'error');
  assert(h.updates.status.error.includes('Restart DataM8')); assert(h.updates.status.error.includes('Installer unavailable'));
  assert(h.order.includes('unlock'));
  const requests = h.requests.length;
  await h.updates.check(); await h.updates.install(true);
  assert.equal(h.requests.length, requests); assert.equal(h.updates.status.phase, 'error');
});
test('another manual check cannot replace the release displayed in an open native dialog', async () => {
  let answer, entered;
  const shown = new Promise(resolve => { entered = resolve; });
  const h = harness({ showDialog: options => { entered(); return new Promise(resolve => { answer = () => resolve(options.cancelId); }); } });
  const checking = h.updates.check(); await shown;
  const requests = h.requests.length;
  await h.updates.check(); assert.equal(h.requests.length, requests);
  answer(); await checking; assert.equal(h.updates.status.version, '2.1.0');
});
