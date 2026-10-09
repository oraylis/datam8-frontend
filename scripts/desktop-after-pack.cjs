module.exports = async context => {
  if (context.electronPlatformName === 'win32' && process.env.DATAM8_REQUIRE_SIGNING === '1') {
    const { files } = await import('./mac-runtime.mjs');
    const sign = require('./sign-windows.cjs');
    for (const name of files(context.appOutDir).filter(name => /\.(exe|dll|node|pyd)$/i.test(name))) await sign({ path: name });
  }
  if (context.electronPlatformName !== 'darwin') return;
  const path = require('node:path');
  const { validateMacBinaries, signMacRuntime } = await import('./mac-runtime.mjs');
  const root = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const runtime = path.join(root, 'Contents', 'Resources', 'python-runtime');
  const arch = context.arch === 3 ? 'arm64' : 'x64';
  validateMacBinaries(runtime, arch);
  signMacRuntime(runtime);
};
