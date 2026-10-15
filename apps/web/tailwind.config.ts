import type { Config } from "tailwindcss";
import uiConfig from "../../packages/ui/tailwind.config";

const config: Config = {
  presets: [uiConfig],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};

export default config;
