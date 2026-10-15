import type { ModelEntity } from "../model-types";

export type FolderRename = {
  fromFolder: string;
  toFolder: string;
};

type NamedObject = { name?: unknown; localFolderName?: unknown; dataModules?: unknown };

function asObjectList(value: unknown): NamedObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is NamedObject => !!item && typeof item === "object");
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function zoneFolderSegment(zone: NamedObject): string | null {
  const zoneName = asNonEmptyString(zone.name);
  if (!zoneName) return null;
  return asNonEmptyString(zone.localFolderName) || zoneName;
}

export function collectZoneFolderRenames(prevContent: unknown, nextContent: unknown): FolderRename[] {
  const prevZones = asObjectList((prevContent as { zones?: unknown } | null | undefined)?.zones);
  const nextZones = asObjectList((nextContent as { zones?: unknown } | null | undefined)?.zones);
  const nextByName = new Map<string, string>();
  nextZones.forEach((zone) => {
    const zoneName = asNonEmptyString(zone.name);
    if (!zoneName) return;
    const folder = asNonEmptyString(zone.localFolderName) || zoneName;
    nextByName.set(zoneName, folder);
  });

  const out: FolderRename[] = [];
  prevZones.forEach((zone) => {
    const zoneName = asNonEmptyString(zone.name);
    if (!zoneName) return;
    const prevFolder = asNonEmptyString(zone.localFolderName) || zoneName;
    const nextFolder = nextByName.get(zoneName);
    if (nextFolder && nextFolder !== prevFolder) {
      out.push({ fromFolder: `Model/${prevFolder}`, toFolder: `Model/${nextFolder}` });
    }
  });
  return out;
}

export function collectZoneFolderDeletes(prevContent: unknown, nextContent: unknown): string[] {
  const prevZones = asObjectList((prevContent as { zones?: unknown } | null | undefined)?.zones);
  const nextZones = asObjectList((nextContent as { zones?: unknown } | null | undefined)?.zones);
  const renameFrom = new Set(
    collectZoneFolderRenames(prevContent, nextContent).map((item) => item.fromFolder),
  );
  const nextFolders = new Set(
    nextZones
      .map((zone) => zoneFolderSegment(zone))
      .filter((segment): segment is string => !!segment),
  );

  const deletes = new Set<string>();
  prevZones.forEach((zone) => {
    const segment = zoneFolderSegment(zone);
    if (!segment) return;
    const folderPath = `Model/${segment}`;
    if (renameFrom.has(folderPath)) return;
    if (!nextFolders.has(segment)) {
      deletes.add(folderPath);
    }
  });

  return Array.from(deletes).sort((a, b) => b.localeCompare(a));
}

export function collectDataProductFolderRenames(params: {
  prevContent: unknown;
  nextContent: unknown;
  modelEntities: ModelEntity[];
}): FolderRename[] {
  const { prevContent, nextContent, modelEntities } = params;
  const prevProducts = asObjectList((prevContent as { dataProducts?: unknown } | null | undefined)?.dataProducts);
  const nextProducts = asObjectList((nextContent as { dataProducts?: unknown } | null | undefined)?.dataProducts);

  const zonesForProduct = (name: string) => {
    const out = new Set<string>();
    modelEntities.forEach((entity) => {
      const parts = (entity.relPath || "").split("/");
      if (parts[2] === name && parts[1]) out.add(parts[1]);
    });
    return Array.from(out);
  };

  const renames: FolderRename[] = [];
  const pairCount = Math.min(prevProducts.length, nextProducts.length);
  for (let i = 0; i < pairCount; i += 1) {
    const prevProd = prevProducts[i];
    const nextProd = nextProducts[i];
    const prevName = asNonEmptyString(prevProd?.name);
    const nextName = asNonEmptyString(nextProd?.name);
    const zones = prevName ? zonesForProduct(prevName) : [];

    if (prevName && nextName && prevName !== nextName) {
      zones.forEach((zone) => {
        renames.push({
          fromFolder: `Model/${zone}/${prevName}`,
          toFolder: `Model/${zone}/${nextName}`,
        });
      });
    }

    const prevModules = asObjectList(prevProd?.dataModules);
    const nextModules = asObjectList(nextProd?.dataModules);
    const modulePairCount = Math.min(prevModules.length, nextModules.length);
    for (let mi = 0; mi < modulePairCount; mi += 1) {
      const prevModuleName = asNonEmptyString(prevModules[mi]?.name);
      const nextModuleName = asNonEmptyString(nextModules[mi]?.name);
      if (!prevModuleName || !nextModuleName || prevModuleName === nextModuleName) continue;

      const baseProductName = nextName || prevName || "";
      zones.forEach((zone) => {
        renames.push({
          fromFolder: `Model/${zone}/${baseProductName}/${prevModuleName}`,
          toFolder: `Model/${zone}/${baseProductName}/${nextModuleName}`,
        });
      });
    }
  }

  return renames;
}
