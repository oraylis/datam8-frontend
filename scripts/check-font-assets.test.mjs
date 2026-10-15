import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFontAssets } from './check-font-assets.mjs';

function fixture() {
  const tempRoot = fs.realpathSync.native(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(tempRoot, 'DataM8 font dependencies '));
  assert.equal(path.dirname(directory), tempRoot);
  fs.writeFileSync(path.join(directory, 'package.json'), '{"name":"font-fixture"}');
  const fonts = path.join(directory, 'node_modules/@fontsource/manrope');
  const install = () => {
    fs.mkdirSync(fonts, { recursive: true });
    fs.writeFileSync(path.join(fonts, 'package.json'), '{"name":"@fontsource/manrope"}');
    for (const weight of [400, 500, 600, 700]) fs.writeFileSync(path.join(fonts, `${weight}.css`), '@font-face {}');
  };
  return { directory, fonts, install, remove: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

test('missing font dependency reports npm ci before the desktop is started', () => {
  const f = fixture();
  try {
    assert.throws(() => assertFontAssets(f.directory), /Missing local font asset.*400\.css.*npm ci.*repository root/);
  } finally { f.remove(); }
});

test('complete local font installation is accepted and an incomplete weight is rejected', () => {
  const f = fixture();
  try {
    f.install();
    assert.doesNotThrow(() => assertFontAssets(f.directory));
    fs.unlinkSync(path.join(f.fonts, '600.css'));
    assert.throws(() => assertFontAssets(f.directory), /Missing local font asset.*600\.css.*npm ci/);
  } finally { f.remove(); }
});
