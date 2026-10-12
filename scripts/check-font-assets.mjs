import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export function assertFontAssets(uiRoot = path.resolve(import.meta.dirname, '../packages/ui')) {
  const require = createRequire(path.join(uiRoot, 'package.json'));
  for (const weight of [400, 500, 600, 700]) {
    const asset = `@fontsource/manrope/${weight}.css`;
    try {
      if (!fs.statSync(require.resolve(asset)).isFile()) throw new Error('Not a file');
    } catch (cause) {
      throw new Error(`[dev-desktop] Missing local font asset ${asset}. Run \`npm ci\` in the repository root, then restart \`npm run dev:desktop\`.`, { cause });
    }
  }
}
