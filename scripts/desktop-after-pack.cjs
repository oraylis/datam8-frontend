module.exports = async context => {
  // Windows signing is handled by electron-builder's signExts and custom
  // signtool hook, after it edits the main executable's resources. Signing
  // that executable in afterPack prevents the resource editor from opening it.
  if (context.electronPlatformName !== 'darwin') return;
  const path = require('node:path');
  const { validateMacBinaries, signMacRuntime } = await import('./mac-runtime.mjs');
  const root = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const runtime = path.join(root, 'Contents', 'Resources', 'python-runtime');
  const arch = context.arch === 3 ? 'arm64' : 'x64';
  validateMacBinaries(runtime, arch);
  signMacRuntime(runtime);
};
