import fs from 'node:fs';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
import { checked } from './mac-runtime.mjs';
if (process.platform !== 'win32') throw new Error('Windows CI trust setup requires Windows');
if (!process.env.GITHUB_ACTIONS) throw new Error('This trust setup is limited to disposable GitHub runners');
const operation = process.argv[2];
const certificate = path.resolve('docs/signing/oraylis-signing-root.cer');
const root = new X509Certificate(fs.readFileSync(certificate));
const fingerprint = 'AB:79:A5:DE:F9:90:BB:CC:BA:33:29:CA:B0:5D:07:E5:D0:77:96:67:66:9E:6F:81:BC:2E:58:26:BD:4F:B0:FD';
if (root.fingerprint256 !== fingerprint || !root.ca || !root.verify(root.publicKey) || Date.parse(root.validTo) <= Date.now()) throw new Error('Unexpected or invalid pinned ORAYLIS CA');
const thumbprint = root.fingerprint.replaceAll(':', '');
const script = operation === 'install'
  ? `$ErrorActionPreference='Stop'; Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security'); if (!(Test-Path ('Cert:\\LocalMachine\\Root\\'+$env:DATAM8_TEST_ROOT_THUMBPRINT))) { Import-Certificate -FilePath $env:DATAM8_TEST_ROOT -CertStoreLocation Cert:\\LocalMachine\\Root | Out-Null }; Write-Output 'CI uses explicit ORAYLIS CA trust; public Windows trust is not asserted'`
  : operation === 'remove' ? `Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security'); if (Test-Path ('Cert:\\LocalMachine\\Root\\'+$env:DATAM8_TEST_ROOT_THUMBPRINT)) { Remove-Item ('Cert:\\LocalMachine\\Root\\'+$env:DATAM8_TEST_ROOT_THUMBPRINT) -Force }` : null;
if (!script) throw new Error('Expected install/remove');
checked('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { stdio: 'inherit', env: { ...process.env, DATAM8_TEST_ROOT: certificate, DATAM8_TEST_ROOT_THUMBPRINT: thumbprint } });
