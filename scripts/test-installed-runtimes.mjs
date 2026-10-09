import fs from 'node:fs';
import path from 'node:path';
import { checked } from './mac-runtime.mjs';
const installed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!installed.length) throw new Error('No installed distributions');
for (const item of installed) checked(process.execPath, [path.resolve('scripts/smoke-python-runtime.mjs'), '--runtime-root', item.runtimeRoot], { stdio: 'inherit' });
