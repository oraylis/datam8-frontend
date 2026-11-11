import type { BaseEntity, BaseZone, FolderEntity } from "./model-types";
import { detectBaseType, hasFolderPropertiesFile, normalizeFolderPath } from "./model-utils";

function stableFolderId(folderPath: string): number {
  let hash = 0;
  for (let index = 0; index < folderPath.length; index += 1) {
    hash = (hash << 5) - hash + folderPath.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

export function createMissingZoneFolderEntities(
  baseEntities: BaseEntity[],
  folderEntities: FolderEntity[],
): FolderEntity[] {
  const zonesEntity = baseEntities.find(
    (entry) => detectBaseType(entry.content, entry.relPath).type === "zones",
  );
  const zones = (zonesEntity?.content.zones || []) as BaseZone[];
  const existingPaths = new Set(
    folderEntities
      .filter(hasFolderPropertiesFile)
      .map((entry) => normalizeFolderPath(entry.folderPath || "")),
  );
  const createdPaths = new Set<string>();
  const created: FolderEntity[] = [];

  zones.forEach((zone) => {
    const zonePath = normalizeFolderPath(zone?.localFolderName || "");
    if (!zonePath) return;

    const segments = zonePath.split("/");
    for (let depth = 1; depth <= segments.length; depth += 1) {
      const folderPath = segments.slice(0, depth).join("/");
      if (existingPaths.has(folderPath) || createdPaths.has(folderPath)) continue;

      const name = segments[depth - 1];
      createdPaths.add(folderPath);
      created.push({
        locator: `/folders/${folderPath}`,
        name,
        relPath: `Model/${folderPath}/.properties.json`,
        folderPath,
        content: {
          id: stableFolderId(folderPath),
          name,
          path: folderPath,
          properties: [],
        },
      });
    }
  });

  return created;
}
