import { defineConfig } from "@playwright/test";

const apiBase = (process.env.DATAM8_RELEASE_API_BASE || "http://127.0.0.1:4318").trim();
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
    baseURL: "http://127.0.0.1:4320",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4320",
    url: "http://127.0.0.1:4320",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
