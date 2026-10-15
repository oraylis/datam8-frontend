import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateFeed } from './desktop-update-feed.mjs';
test('Windows update feed serves an installer with URL-encoded spaces', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 feed '));
  const name = 'DataM8 Setup 2.0.0-beta.6-ci.1.exe';
  const bytes = Buffer.from('installer bytes for the update transport regression');
  fs.writeFileSync(path.join(root, name), bytes);
  const server = createUpdateFeed(root);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/${encodeURIComponent(name)}`);
    assert.equal(response.status, 200);
    assert.equal(Number(response.headers.get('content-length')), bytes.length);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await fetch(`${base}/missing.exe`)).status, 404);
    assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
