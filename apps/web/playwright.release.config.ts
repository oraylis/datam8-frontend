import { defineConfig } from "@playwright/test";

const apiBase = (process.env.DATAM8_RELEASE_API_BASE || "http://127.0.0.1:4318").trim();
const webPort = Number(process.env.DATAM8_RELEASE_WEB_PORT || "4320");
const webBase = `http://127.0.0.1:${webPort}`;
process.env.VITE_API_URL = apiBase;

export default defineConfig({
  testDir: "./e2e-release",
  timeout: 240_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: webBase,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
    url: webBase,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
