import fs from "fs";
import path from "path";
import { z } from "zod";

const settingsFileName = ".user-settings.json";

const schema = z.object({
  pythonPath: z.string().optional(),
  backendModule: z.string().optional(),
});

export type UserSettings = z.infer<typeof schema>;

export namespace UserSettings {
  export function parseFromSolution(solutionDir: string): UserSettings  {
    const filePath = path.join(solutionDir, settingsFileName);
    if (!fs.existsSync(filePath)) return {};

    console.log(`[datam8] User settings found: ${filePath}`);

    try {
      const settings = schema.parse(JSON.parse(fs.readFileSync(filePath, "utf8")));

      if (settings.pythonPath && !path.isAbsolute(settings.pythonPath)) {
        settings.pythonPath = path.resolve(solutionDir, settings.pythonPath);
      }

      console.log("[datam8] User settings parsed.");

      return settings;
    } catch (err) {
      console.error(`[datam8] Could not read user settings: ${String(err)}`);
      throw new Error(`${settingsFileName} could not be parsed: ${String(err)}`);
    }
  }
}
