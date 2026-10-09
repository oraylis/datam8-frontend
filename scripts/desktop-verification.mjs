import { checked, validateMacBinaries } from './mac-runtime.mjs';
export function verifyWindows(root, thumbprint) {
  if (!thumbprint || !/^[A-F0-9]{40}$/i.test(thumbprint)) throw new Error('Expected Windows certificate thumbprint required');
  const script = `$ErrorActionPreference='Stop'; Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security'); $files=Get-ChildItem -LiteralPath $env:DATAM8_VERIFY_ROOT -Recurse -File | Where-Object { $_.Extension -match '^\\.(exe|dll|node|pyd)$' }; if (!$files) { throw 'No Windows binaries found' }; foreach ($file in $files) { $s=Get-AuthenticodeSignature -LiteralPath $file.FullName; if ($s.Status -ne 'Valid' -or $s.SignerCertificate.Thumbprint -ne $env:DATAM8_WINDOWS_THUMBPRINT -or !$s.TimeStamperCertificate) { throw ('Invalid/incorrect/untimestamped signature: '+$file.FullName+'; status='+$s.Status+'; '+$s.StatusMessage) } }; Write-Output ('Verified '+$files.Count+' Windows signatures')`;
  const env = { ...process.env, DATAM8_VERIFY_ROOT: root, DATAM8_WINDOWS_THUMBPRINT: thumbprint };
  // A Node process launched from pwsh inherits its incompatible PS7 module path.
  // Let Windows PowerShell reconstruct its own module search paths.
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'PSMODULEPATH') delete env[key];
  checked('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { env });
}
export function verifyMac(root) {
  checked('codesign', ['--verify', '--deep', '--strict', root]);
  const description = checked('codesign', ['-d', '--verbose=4', root], { stdio: ['ignore', 'pipe', 'pipe'] });
  // codesign writes its description on stderr; strict verification above is authoritative.
  void description;
  validateMacBinaries(root);
}
