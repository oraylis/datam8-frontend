import { checked, validateMacBinaries } from './mac-runtime.mjs';
import path from 'node:path';
export function verifyWindows(root, thumbprint) {
  if (!thumbprint || !/^[A-F0-9]{40}$/i.test(thumbprint)) throw new Error('Expected Windows certificate thumbprint required');
  const env = { ...process.env, DATAM8_VERIFY_ROOT: root, DATAM8_WINDOWS_THUMBPRINT: thumbprint };
  // A Node process launched from pwsh inherits its incompatible PS7 module path.
  // Let Windows PowerShell reconstruct its own module search paths.
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'PSMODULEPATH') delete env[key];
  checked('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(import.meta.dirname, 'verify-windows-signatures.ps1')], { env });
}
export function verifyMac(root) {
  checked('codesign', ['--verify', '--deep', '--strict', root]);
  validateMacBinaries(root);
}
