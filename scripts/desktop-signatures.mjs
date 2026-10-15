import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { checked, files } from './mac-runtime.mjs';
import { verifyMac, verifyWindows } from './desktop-verification.mjs';
const [operation, location = 'artifacts/desktop-final'] = process.argv.slice(2);
const root = path.resolve(location);
const packages = () => files(root).filter(name => /\.(exe|dmg|zip|AppImage|deb)$/.test(name));
function gpg(args, options = {}) { return checked('gpg', ['--batch', ...args], options); }
function fingerprint() {
  const value = (process.env.DATAM8_GPG_FINGERPRINT || '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-F0-9]{40,64}$/.test(value)) throw new Error('Expected DataM8 GPG fingerprint required');
  return value;
}
function verifyGpg(name, home) {
  const result = gpg(['--homedir', home, '--status-fd', '1', '--verify', `${name}.asc`, name]);
  const identity = fingerprint();
  if (!result.split('\n').some(line => line.startsWith('[GNUPG:] VALIDSIG ') && line.split(' ').includes(identity))) throw new Error(`Unexpected GPG signing identity for ${path.basename(name)}`);
}
if (operation === 'sign') {
  const assets = packages();
  if (!assets.length) throw new Error('No distribution files to sign');
  const home = process.env.GNUPGHOME;
  if (!home) throw new Error('Temporary GNUPGHOME required');
  const checksum = path.join(root, 'SHA256SUMS');
  const checksumFiles = files(root).filter(name => !name.endsWith('.asc') && !['SHA256SUMS', 'GPG-FINGERPRINT.txt'].includes(path.basename(name)));
  fs.writeFileSync(checksum, checksumFiles.sort().map(name => `${createHash('sha256').update(fs.readFileSync(name)).digest('hex')}  ${path.basename(name)}`).join('\n') + '\n');
  for (const name of [...assets.filter(name => !name.endsWith('.exe')), checksum]) {
    gpg(['--homedir', home, '--yes', '--pinentry-mode', 'loopback', '--passphrase-file', path.join(home, 'passphrase'), '--local-user', fingerprint(), '--armor', '--detach-sign', name]);
  }
  fs.writeFileSync(path.join(root, 'datam8-release-public.asc'), gpg(['--homedir', home, '--armor', '--export', fingerprint()]));
  fs.writeFileSync(path.join(root, 'GPG-FINGERPRINT.txt'), `${fingerprint()}\n`);
} else if (operation === 'verify-gpg') {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'datam8-gpg-verify-'));
  fs.chmodSync(home, 0o700);
  try {
    gpg(['--homedir', home, '--import', path.join(root, 'datam8-release-public.asc')]);
    const checksum = path.join(root, 'SHA256SUMS');
    verifyGpg(checksum, home);
    for (const line of fs.readFileSync(checksum, 'utf8').trim().split('\n')) {
      const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
      if (!match) throw new Error('Invalid checksum manifest entry');
      const name = path.join(root, match[2]);
      if (createHash('sha256').update(fs.readFileSync(name)).digest('hex') !== match[1]) throw new Error(`Checksum mismatch: ${match[2]}`);
      if (/\.(dmg|zip|AppImage|deb)$/.test(name)) verifyGpg(name, home);
    }
    const signed = packages().find(name => !name.endsWith('.exe'));
    if (!signed) throw new Error('Missing signed macOS/Linux distribution');
    const corrupt = path.join(home, `tampered-${randomUUID()}`);
    const bytes = fs.readFileSync(signed); bytes[0] ^= 1; fs.writeFileSync(corrupt, bytes);
    const bad = spawnSync('gpg', ['--batch', '--homedir', home, '--verify', `${signed}.asc`, corrupt], { stdio: 'ignore' });
    if (bad.status === 0 || bad.error) throw new Error('Tampering verification did not reject altered bytes');
    // A signature made with an unrelated key must be rejected by the trusted keyring.
    const wrong = path.join(home, 'wrong'); fs.mkdirSync(wrong, { mode: 0o700 });
    gpg(['--homedir', wrong, '--pinentry-mode', 'loopback', '--passphrase', '', '--quick-generate-key', 'Disposable CI key', 'ed25519', 'sign', '1d']);
    gpg(['--homedir', wrong, '--armor', '--detach-sign', '--output', `${corrupt}.asc`, checksum]);
    const unrelated = spawnSync('gpg', ['--batch', '--homedir', home, '--verify', `${corrupt}.asc`, checksum], { stdio: 'ignore' });
    if (unrelated.status === 0 || unrelated.error) throw new Error('Verification accepted an unrelated signing key');
    console.log('GPG signatures, expected identity, checksums and negative cases passed');
  } finally {
    for (const dir of [path.join(home, 'wrong'), home]) spawnSync('gpgconf', ['--homedir', dir, '--kill', 'all'], { stdio: 'ignore' });
    fs.rmSync(home, { recursive: true, force: true });
  }
} else if (operation === 'verify') {
  if (process.platform === 'win32') verifyWindows(root, process.env.DATAM8_WINDOWS_THUMBPRINT);
  else if (process.platform === 'darwin') verifyMac(root);
  else throw new Error('Use verify-gpg for Linux distributions');
} else if (operation !== undefined) throw new Error(`Unknown signature operation: ${operation}`);
