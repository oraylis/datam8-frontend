import fs from 'node:fs';
import path from 'node:path';
import { checked } from './mac-runtime.mjs';
const operation = process.argv[2];
const fixture = path.resolve('artifacts/manual-fixture');
if (operation === 'pack') {
  const source = path.resolve('artifacts/manual-old');
  const relative = process.platform === 'darwin' ? `mac-${process.arch}/datam8.app` : 'linux-unpacked';
  if (!fs.existsSync(path.join(source, relative))) throw new Error('Previous app bundle missing');
  fs.mkdirSync(fixture, { recursive: true });
  checked('tar', ['-czf', path.join(fixture, 'previous-app.tar.gz'), '-C', source, relative]);
  fs.writeFileSync(path.join(fixture, 'previous.json'), JSON.stringify({ relative, version: '2.0.0-beta.6-ci.0' }));
} else if (operation === 'install') {
  const previous = JSON.parse(fs.readFileSync(path.join(fixture, 'previous.json')));
  const target = path.join(fixture, 'extracted'); fs.mkdirSync(target, { recursive: true });
  checked('tar', ['-xzf', path.join(fixture, 'previous-app.tar.gz'), '-C', target]);
  const root = path.join(target, previous.relative);
  const executable = path.join(root, ...(process.platform === 'darwin' ? ['Contents', 'MacOS'] : []), 'datam8');
  if (!fs.existsSync(executable)) throw new Error('Previous executable missing');
  const manifest = path.resolve('artifacts/installed/installed.json');
  const installed = JSON.parse(fs.readFileSync(manifest));
  for (const distribution of installed) Object.assign(distribution, { previousExecutable: executable, previousAppRoot: root, previousVersion: previous.version });
  fs.writeFileSync(manifest, JSON.stringify(installed, null, 2));
} else throw new Error('Expected pack/install');
