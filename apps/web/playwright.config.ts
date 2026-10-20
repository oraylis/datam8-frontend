import { defineConfig } from "@playwright/test";

const webPort = Number(process.env.DATAM8_E2E_WEB_PORT || "4320");
const webBase = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: webBase,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
    url: webBase,
    reuseExistingServer: !process.env.DATAM8_E2E_WEB_PORT,
    timeout: 120_000,
  },
});

