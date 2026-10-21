import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function documentationOnly(files) {
  return files.length > 0 && files.every(file =>
    !file.startsWith('docs/signing/') &&
    (/^[^/]+\.md$/i.test(file) || /^docs\/.*\.(?:md|png|jpe?g|gif|webp|svg)$/i.test(file)));
}

export function checkResults(needs) {
  const scope = needs.scope;
  const flag = scope?.outputs?.docs_only;
  if (scope?.result !== 'success' || !['true', 'false'].includes(flag)) {
    throw new Error('Scope and documentation checks did not succeed');
  }
  const checks = Object.entries(needs).filter(([name]) => name !== 'scope');
  if (!checks.length) throw new Error('No quality checks declared');
  const expected = flag === 'true' ? 'skipped' : 'success';
  for (const [name, job] of checks) {
    if (job.result !== expected) throw new Error(`${name}: expected ${expected}, received ${job.result}`);
  }
}

function classifyEvent() {
  if (!['push', 'pull_request'].includes(process.env.GITHUB_EVENT_NAME) ||
      process.env.GITHUB_REF?.startsWith('refs/tags/')) return false;
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const base = process.env.GITHUB_EVENT_NAME === 'pull_request' ? event.pull_request.base.sha : event.before;
  if (!/^[a-f0-9]{40}$/.test(base || '') || /^0+$/.test(base)) return false;
  // Fetch only the comparison commit; do not require the repository's full history.
  execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', base], { stdio: 'inherit' });
  const files = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, 'HEAD'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
  return documentationOnly(files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'result') {
    checkResults(JSON.parse(process.env.NEEDS));
    console.log('All required checks passed');
  } else {
    const docsOnly = classifyEvent();
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${docsOnly}\n`);
    console.log(`Documentation only: ${docsOnly}`);
  }
}
