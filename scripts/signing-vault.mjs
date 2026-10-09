import fs from 'node:fs';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
import { checked } from './mac-runtime.mjs';

const mode = process.argv[2];
const output = path.resolve(process.argv[3] || 'artifacts/signing-public');
const required = name => { const value = process.env[name]; if (!value) throw new Error(`Missing signing configuration: ${name}`); return value; };
const vault = required('AZURE_KEY_VAULT_URL').replace(/\/$/, '');
if (!/^https:\/\/[a-zA-Z0-9-]+\.vault\.azure\.net$/.test(vault)) throw new Error('Expected an Azure Key Vault HTTPS endpoint');
const tokenArgs = ['account', 'get-access-token', '--resource', 'https://vault.azure.net', '--query', 'accessToken', '--output', 'tsv'];
// Azure CLI is an az.cmd shim on hosted Windows runners. All arguments here are fixed.
const token = (process.platform === 'win32' ? checked('cmd.exe', ['/d', '/s', '/c', `az ${tokenArgs.join(' ')}`]) : checked('az', tokenArgs)).trim();
if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${token}`);
async function get(route) {
  const response = await fetch(`${vault}/${route}?api-version=7.4`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Key Vault ${route.split('/')[0]} request failed (${response.status}); check identity permissions and network access`);
  return response.json();
}
function exportEnv(name, value) {
  if (/[\r\n]/.test(value)) throw new Error(`Invalid multiline value: ${name}`);
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}
if (mode === 'windows') {
  const cert = await get(`certificates/${encodeURIComponent(required('AZURE_KEY_VAULT_NAME'))}`);
  const publicCert = new X509Certificate(Buffer.from(cert.cer, 'base64'));
  if (!cert.attributes?.enabled || Date.parse(publicCert.validFrom) > Date.now() || Date.parse(publicCert.validTo) <= Date.now()) throw new Error('Windows signing certificate is disabled, expired or not yet valid');
  const issuer = new X509Certificate(fs.readFileSync(path.resolve(import.meta.dirname, '../docs/signing/oraylis-signing-root.cer')));
  if (!publicCert.checkIssued(issuer) || !publicCert.verify(issuer.publicKey)) throw new Error('Windows certificate is not issued by the pinned ORAYLIS CA');
  if (!publicCert.keyUsage?.includes('1.3.6.1.5.5.7.3.3')) throw new Error('Certificate lacks code-signing extended key usage');
  if (!cert.kid?.startsWith(`${vault}/keys/`)) throw new Error('Certificate has no signing key in this vault');
  const publisher = publicCert.subject.split('\n').find(line => line.startsWith('CN='))?.slice(3);
  if (!publisher) throw new Error('Windows certificate has no publisher CN');
  const thumbprint = publicCert.fingerprint.replaceAll(':', '').toUpperCase();
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'windows.cer'), publicCert.raw);
  fs.writeFileSync(path.join(output, 'windows.json'), JSON.stringify({ publisher, thumbprint, fingerprint256: publicCert.fingerprint256, validTo: publicCert.validTo }, null, 2));
  exportEnv('KEYVAULT_ACCESS_TOKEN', token);
  exportEnv('DATAM8_WINDOWS_PUBLISHER', publisher);
  exportEnv('DATAM8_WINDOWS_THUMBPRINT', thumbprint);
  console.log(`Windows signing certificate verified; expires ${publicCert.validTo}`);
} else if (mode === 'gpg') {
  const fingerprint = required('DATAM8_GPG_FINGERPRINT').replace(/\s/g, '').toUpperCase();
  if (!/^[A-F0-9]{40,64}$/.test(fingerprint)) throw new Error('Invalid expected GPG fingerprint');
  const secret = await get(`secrets/${encodeURIComponent(required('DATAM8_GPG_KEY_SECRET'))}`);
  const password = await get(`secrets/${encodeURIComponent(required('DATAM8_GPG_PASSPHRASE_SECRET'))}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${password.value}`);
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  fs.chmodSync(output, 0o700);
  const key = path.join(output, 'private.asc');
  fs.writeFileSync(key, secret.value, { mode: 0o600 });
  fs.writeFileSync(path.join(output, 'passphrase'), password.value, { mode: 0o600 });
  try { checked('gpg', ['--batch', '--homedir', output, '--import', key]); }
  finally { fs.rmSync(key, { force: true }); }
  const listing = checked('gpg', ['--homedir', output, '--with-colons', '--list-secret-keys', fingerprint]);
  if (!listing.split('\n').some(line => line.startsWith('fpr:') && line.split(':')[9] === fingerprint)) throw new Error('Vault GPG key does not match expected fingerprint');
  // Reject disabled, revoked and expired primary keys or signing subkeys.
  if (listing.split('\n').some(line => /^(sec|ssb):/.test(line) && /^(r|e|d)$/.test(line.split(':')[1]))) throw new Error('GPG signing key is revoked, expired or disabled');
  exportEnv('GNUPGHOME', output);
} else throw new Error(`Unknown vault operation: ${mode}`);
