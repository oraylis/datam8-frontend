import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e-packaged', workers: 1, retries: 0, timeout: 300_000,
  expect: { timeout: 30_000 },
  outputDir: '../../artifacts/desktop-test-results',
  reporter: [['list'], ['junit', { outputFile: '../../artifacts/desktop-junit.xml' }]],
});
