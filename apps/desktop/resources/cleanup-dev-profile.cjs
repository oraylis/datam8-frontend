// An orphaned development child cannot delete Chromium's open profile on
// Windows. This detached helper waits for that child to exit before cleanup.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = process.argv[2];
const pid = Number(process.argv[3]);
if (!root || !Number.isInteger(pid) || pid <= 0 || path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('DataM8 update simulation ')) process.exit(1);
(async () => {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { process.kill(pid, 0); } catch (error) {
      if (error.code !== 'ESRCH') process.exit(1);
      await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  process.exitCode = 1;
})().catch(() => { process.exitCode = 1; });
