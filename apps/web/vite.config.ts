import { resolve } from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isElectron = mode === "electron" || process.env.VITE_APP_MODE === "electron";
  const apiTarget = (process.env.VITE_API_URL || "http://127.0.0.1:51092").trim();

  const proxyPrefixes = [
    "/health",
    "/version",
    "/config",
    "/solution",
    "/migration",
    "/model",
    "/base",
    "/index",
    "/refactor",
    "/fs",
    "/search",
    "/connectors",
    "/plugins",
    "/datasources",
    "/http",
    "/secrets",
    "/sources",
    "/generate",
    "/validate",
    "/entities",
  ];

  const proxy = Object.fromEntries(proxyPrefixes.map((prefix) => [prefix, { target: apiTarget, changeOrigin: true }]));

  return {
    base: isElectron ? "./" : "/",
    plugins: [react()],
    resolve: {
      alias: {
        "@datam8/ui": resolve(__dirname, "../../packages/ui/src"),
        "@datam8/types": resolve(__dirname, "../../packages/types/src"),
      },
    },
    server: {
      port: 4320,
      strictPort: true,
      proxy,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
