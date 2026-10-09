import path from 'node:path';
import { checked } from './mac-runtime.mjs';
const manifest = path.resolve(process.argv[2] || 'artifacts/installed/installed.json');
checked(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'apps/desktop/playwright.packaged.config.mjs'], {
  stdio: 'inherit', env: { ...process.env, DATAM8_INSTALLED_MANIFEST: manifest, DATAM8_DISABLE_AUTO_UPDATES: '1' },
});
