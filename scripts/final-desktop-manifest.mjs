import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(process.argv[2]);
const names = fs.readdirSync(root);
for (const pattern of [/\.exe$/, /mac-x64\.dmg$/, /mac-x64\.zip$/, /mac-arm64\.dmg$/, /mac-arm64\.zip$/, /\.AppImage$/, /\.deb$/]) {
  if (names.filter(name => pattern.test(name)).length !== 1) throw new Error(`Missing or ambiguous final distribution: ${pattern}`);
}
if (names.some(name => /^(latest|beta|alpha)-mac\.yml$/.test(name))) throw new Error('macOS updater feed must not be published without Developer ID');
const version = JSON.parse(fs.readFileSync('apps/desktop/package.json', 'utf8')).version;
const generatorCommit = execFileSync('git', ['-C', 'submodules/datam8-generator', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const modelCommit = execFileSync('git', ['-C', 'submodules/datam8-generator/datam8-model', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const manifest = { version, commit: process.env.GITHUB_SHA, generatorCommit, modelCommit, workflow: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`, gpgFingerprint: process.env.DATAM8_GPG_FINGERPRINT, windows: JSON.parse(fs.readFileSync(path.join(root, 'windows.json'), 'utf8')), files: names.sort().map(name => ({ name, bytes: fs.statSync(path.join(root, name)).size })) };
fs.writeFileSync(path.join(root, 'BUILD-MANIFEST.json'), JSON.stringify(manifest, null, 2)+'\n');
const guide = fs.readFileSync('docs/desktop-installation.md', 'utf8').replace(/\]\(signing\/([^)]+)\)/g,
  `](https://github.com/${process.env.GITHUB_REPOSITORY}/blob/${manifest.commit}/docs/signing/$1)`);
fs.writeFileSync(path.join(root, 'INSTALL-AND-VERIFY.md'), guide);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `All four platform targets verified at ${manifest.commit}.\n\nGPG: ${manifest.gpgFingerprint}\n\nWindows: ${manifest.windows.thumbprint}\n`);
