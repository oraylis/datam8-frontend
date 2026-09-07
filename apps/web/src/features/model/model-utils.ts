import type { PropertyAssignment } from "@datam8/types";
import { FolderEntity, ModelEntity, TreeNode } from "./model-types";

export type DataTypeMapping = { sourceType: string; targetType: string };

type FolderMeta = {
  name?: string;
  dataProduct?: string;
  dataModule?: string;
  properties?: PropertyAssignment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export const mergeInheritedProps = (
  productProps: PropertyAssignment[] = [],
  moduleProps: PropertyAssignment[] = [],
  currentProps: PropertyAssignment[] = [],
) => {
  const byName = new Map<string, PropertyAssignment>();
  productProps.forEach((p) => {
    if (p?.property) byName.set(p.property, p);
  });
  moduleProps.forEach((p) => {
    if (p?.property) byName.set(p.property, p);
  });
  currentProps.forEach((p) => {
    if (p?.property) byName.delete(p.property);
  });
  return Array.from(byName.values());
};

export const mergeInheritedDataTypeMappings = (typeMappings: DataTypeMapping[] = [], currentMappings: DataTypeMapping[] = []) => {
  const bySourceType = new Map<string, DataTypeMapping>();
  typeMappings.forEach((m) => {
    if (m?.sourceType) bySourceType.set(m.sourceType, m);
  });
  currentMappings.forEach((m) => {
    if (m?.sourceType) bySourceType.delete(m.sourceType);
  });
  return Array.from(bySourceType.values());
};

export const normalizeFolderPath = (path: string) =>
  (path || "").split(/[\\/]/).join("/").replace(/^\/+|\/+$/g, "");

export const getFolderPathFromModelRelPath = (relPath: string) => {
  const normalized = (relPath || "").split(/[\\/]/).join("/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return "";
  const withoutRoot = parts[0].toLowerCase() === "model" ? parts.slice(1) : parts.slice();
  if (!withoutRoot.length) return "";
  return withoutRoot.slice(0, -1).join("/");
};

export const getFolderMeta = (entry: FolderEntity | null | undefined) => {
  const content = entry?.content;
  if (!isRecord(content)) return null;

  const folders = content.folders;
  if (Array.isArray(folders) && folders.length > 0) {
    const first = folders[0];
    if (isRecord(first)) return first as FolderMeta;
  }

  return content as FolderMeta;
};

const folderPathAncestors = (folderPath: string) => {
  const normalized = normalizeFolderPath(folderPath);
  if (!normalized) return [];
  const parts = normalized.split("/");
  const out: string[] = [];
  for (let i = 1; i <= parts.length; i += 1) {
    out.push(parts.slice(0, i).join("/"));
  }
  return out;
};

export const indexFolderEntities = (folderEntities: FolderEntity[]) => {
  const map = new Map<string, FolderEntity>();
  (folderEntities || []).forEach((entry) => {
    const path = normalizeFolderPath(entry.folderPath || "");
    if (!path) return;
    map.set(path, entry);
  });
  return map;
};

export function resolveFolderInheritance(params: {
  entityRelPath?: string;
  folderPath?: string;
  folderEntities: FolderEntity[];
  includeCurrentFolder?: boolean;
}) {
  const explicitFolderPath =
    typeof params.folderPath === "string" ? normalizeFolderPath(params.folderPath) : "";
  const folderPath = explicitFolderPath || getFolderPathFromModelRelPath(params.entityRelPath || "");
  const byPath = indexFolderEntities(params.folderEntities || []);
  const fullChain = folderPathAncestors(folderPath);
  const chain = params.includeCurrentFolder === false ? fullChain.slice(0, -1) : fullChain;

  const inheritedMap = new Map<string, PropertyAssignment>();
  chain.forEach((path) => {
    const meta = getFolderMeta(byPath.get(path));
    const props = Array.isArray(meta?.properties) ? meta.properties : [];
    props.forEach((prop) => {
      const key = typeof prop?.property === "string" ? prop.property.trim() : "";
      if (!key) return;
      inheritedMap.set(key, prop);
    });
  });

  let effectiveDataProduct = "";
  let effectiveDataModule = "";
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const meta = getFolderMeta(byPath.get(chain[i]));
    if (!meta) continue;
    const dp = typeof meta?.dataProduct === "string" ? meta.dataProduct.trim() : "";
    const dm = typeof meta?.dataModule === "string" ? meta.dataModule.trim() : "";
    if (!effectiveDataProduct && dp) effectiveDataProduct = dp;
    if (!effectiveDataModule && dm) effectiveDataModule = dm;
    if (effectiveDataProduct && effectiveDataModule) break;
  }

  return {
    folderPath,
    folderChain: chain,
    inheritedProps: Array.from(inheritedMap.values()),
    effectiveDataProduct,
    effectiveDataModule,
  };
}

type BaseTypeDetection = {
  type: string;
  items: unknown[];
  propertyValues: unknown[];
};

export const detectBaseType = (content: unknown, relPath: string): BaseTypeDetection => {
  const contentObj = isRecord(content) ? content : {};
  const explicitType = typeof contentObj.type === "string" ? contentObj.type.toLowerCase() : "";
  const rel = (relPath || "").toLowerCase();
  const file = rel.split("/").pop() || rel;
  const matchKey = (name: string) => name.replace(/\.json$/, "").replace(/[^a-z0-9]/g, "");
  const typeByFile: Record<string, string> = {
    attributetypes: "attributeTypes",
    datatypes: "dataTypes",
    datasources: "dataSources",
    datasourcetypes: "dataSourceTypes",
    dataproducts: "dataProducts",
    datamodules: "dataModules",
    zones: "zones",
    properties: "properties",
    propertyvalues: "propertyValues",
  };
  const detectedFromFile = typeByFile[matchKey(file)] || "unknown";
  const detectedFromKeys = explicitType === "propertyvalues"
    ? "propertyValues"
    : explicitType === "properties"
      ? "properties"
      : contentObj?.attributeTypes
    ? "attributeTypes"
    : contentObj?.dataSources
      ? "dataSources"
      : contentObj?.dataSourceTypes
        ? "dataSourceTypes"
        : contentObj?.dataProducts
          ? "dataProducts"
          : contentObj?.dataModules
            ? "dataModules"
          : contentObj?.zones
            ? "zones"
            : contentObj?.properties
              ? "properties"
              : contentObj?.propertyValues
                ? "propertyValues"
          : contentObj?.dataTypes
            ? "dataTypes"
            : "unknown";
  const detectedArrays = Object.entries(contentObj)
    .filter(([k, v]) => Array.isArray(v) && k !== "propertyValues" && k !== "type")
    .map(([k]) => k);
  const detected =
    detectedFromFile !== "unknown"
      ? detectedFromFile
      : detectedFromKeys !== "unknown"
        ? detectedFromKeys
        : detectedArrays[0] || "unknown";
  const items =
    detected === "attributeTypes"
      ? (Array.isArray(contentObj?.attributeTypes) ? contentObj.attributeTypes : [])
      : detected === "dataSources"
        ? (Array.isArray(contentObj?.dataSources) ? contentObj.dataSources : [])
        : detected === "dataSourceTypes"
          ? (Array.isArray(contentObj?.dataSourceTypes) ? contentObj.dataSourceTypes : [])
          : detected === "dataProducts"
            ? (Array.isArray(contentObj?.dataProducts) ? contentObj.dataProducts : [])
            : detected === "dataModules"
              ? (Array.isArray(contentObj?.dataModules) ? contentObj.dataModules : [])
            : detected === "zones"
              ? (Array.isArray(contentObj?.zones) ? contentObj.zones : [])
              : detected === "properties"
                ? (Array.isArray(contentObj?.properties) ? contentObj.properties : [])
                : detected === "propertyValues"
                  ? (Array.isArray(contentObj?.propertyValues) ? contentObj.propertyValues : [])
                : detected === "dataTypes"
                  ? (Array.isArray(contentObj?.dataTypes) ? contentObj.dataTypes : [])
                  : [];
  const propertyValues =
    detected === "propertyValues"
      ? items
      : detected === "properties" && Array.isArray(contentObj?.propertyValues)
        ? contentObj.propertyValues
        : [];
  return { type: detected, items, propertyValues };
};

export function buildTree(
  entities: ModelEntity[],
  folderEntities: FolderEntity[] = [],
  placeholderFolders: string[] = [],
): TreeNode[] {
  const root: TreeNode[] = [];
  const normalizePath = (value: string) => normalizeFolderPath(value).split("/").filter(Boolean).join("/");
  const isSameOrChild = (candidate: string, rootPath: string) =>
    candidate === rootPath || candidate.startsWith(`${rootPath}/`);

  const modelFolderPaths = new Set<string>();
  entities.forEach((ent) => {
    const path = normalizePath(ent.relPath.split("/").slice(1, -1).join("/"));
    if (path) modelFolderPaths.add(path);
  });
  const placeholderRoots = new Set(
    (placeholderFolders || [])
      .map((value) => normalizePath(value))
      .filter(Boolean),
  );

  const visibleFolderEntities = (folderEntities || []).filter((entry) => {
    const folderPath = normalizePath(entry.folderPath || "");
    if (!folderPath) return false;
    for (const modelPath of modelFolderPaths) {
      if (isSameOrChild(modelPath, folderPath) || isSameOrChild(folderPath, modelPath)) return true;
    }
    for (const zoneRoot of placeholderRoots) {
      if (isSameOrChild(folderPath, zoneRoot) || isSameOrChild(zoneRoot, folderPath)) return true;
    }
    return false;
  });

  const folderMetaByPath = indexFolderEntities(visibleFolderEntities);

  const ensureChild = (list: TreeNode[], label: string, pathParts: string[]): TreeNode => {
    const pathKey = pathParts.join("/");
    const fallbackLabel = pathParts[pathParts.length - 1] || label;
    const meta = folderMetaByPath.get(pathKey);
    const folderMeta = getFolderMeta(meta);
    const metaNameRaw = typeof folderMeta?.name === "string" ? folderMeta.name.trim() : "";
    const metaName = metaNameRaw || "";
    const nextLabel = metaName || fallbackLabel || label;
    let node = list.find((n) => n.path === pathKey);
    if (!node) {
      node = { label: nextLabel, children: [], type: "folder", path: pathKey };
      list.push(node);
    } else {
      node.label = nextLabel;
    }
    if (!node.children) {
      node.children = [];
    }
    return node;
  };

  const addFolderPath = (pathParts: string[]) => {
    let current = root;
    const built: string[] = [];
    pathParts.forEach((segment) => {
      if (!segment) return;
      built.push(segment);
      const node = ensureChild(current, segment, built.slice());
      current = node.children!;
    });
  };

  entities.forEach((ent) => {
    const parts = ent.relPath.split("/").slice(1);
    const folders = parts.slice(0, -1);
    addFolderPath(folders);
    let currentList = root;
    let builtPath: string[] = [];
    folders.forEach((segment) => {
      builtPath.push(segment);
      const node = ensureChild(currentList, segment, builtPath.slice());
      currentList = node.children!;
    });
    currentList.push({
      label: ent.name,
      relPath: ent.relPath,
      type: "entity",
      path: [...folders, ent.name].join("/"),
    });
  });

  placeholderFolders.forEach((folderPath) => {
    const parts = normalizeFolderPath(folderPath).split("/").filter(Boolean);
    if (parts.length) addFolderPath(parts);
  });

  visibleFolderEntities.forEach((entry) => {
    const parts = normalizeFolderPath(entry.folderPath).split("/").filter(Boolean);
    if (parts.length) addFolderPath(parts);
  });

  const sortTree = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((n) => ({
        ...n,
        children: n.children ? sortTree(n.children) : undefined,
      }));

  return sortTree(root);
}

export function generateModelEntityId(entities: ModelEntity[]): number {
  let maxId = 0;
  for (const entity of entities) {
    const id = entity.content?.id;
    if (typeof id === "number" && !isNaN(id)) {
      if (id > maxId) maxId = id;
    }
  }
  return maxId > 0 ? maxId + 1 : 1001;
}

export type DataType = {
  type: string;
  nullable: boolean;
  charLen?: number;
  precision?: number;
  scale?: number;
  [key: string]: unknown;
};

function optIntGt0(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

function optIntGte0(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

export function sanitizeDataType(input: unknown): DataType {
  const raw = isRecord(input) ? input : undefined;

  const type =
    typeof raw?.type === "string"
      ? raw.type
      : typeof input === "string"
        ? input
        : "string";

  const nullable =
    typeof raw?.nullable === "boolean"
      ? raw.nullable
      : true;

  const { charLen: _charLen, precision: _precision, scale: _scale, nullable: _n, type: _t, ...rest } =
    raw || {};

  const out: DataType = { ...rest, type, nullable };

  const charLen = optIntGt0(raw?.charLen);
  if (charLen !== undefined) out.charLen = charLen;

  const precision = optIntGt0(raw?.precision);
  if (precision !== undefined) out.precision = precision;

  const scale = optIntGte0(raw?.scale);
  if (scale !== undefined) out.scale = scale;

  return out;
}

function normalizeTypeKey(value: string): string {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "";
  const noParams = raw.replace(/\(.*\)\s*$/g, "").trim();
  const head = noParams.split(/\s+/)[0] || noParams;
  return head;
}

function resolveCanonicalTypeName(candidate: string, canonicalTypes: string[]): string | null {
  const norm = normalizeTypeKey(candidate);
  if (!norm) return null;
  return canonicalTypes.find((t) => normalizeTypeKey(t) === norm) || null;
}

export function mapSourceDataTypeToCanonical(params: {
  sourceDataType: DataType;
  mappings: DataTypeMapping[];
  canonicalTypes: string[];
}): DataType {
  const { sourceDataType, mappings, canonicalTypes } = params;

  if (!canonicalTypes.length) return { ...sourceDataType };

  const fallback = resolveCanonicalTypeName("string", canonicalTypes) || canonicalTypes[0] || "string";
  const sourceKey = normalizeTypeKey(sourceDataType.type);

  const match = mappings.find((m) => normalizeTypeKey(m?.sourceType || "") === sourceKey);
  const mappedTarget = typeof match?.targetType === "string" ? match.targetType : "";
  const resolvedTarget = mappedTarget ? resolveCanonicalTypeName(mappedTarget, canonicalTypes) : null;

  const alreadyCanonical = resolveCanonicalTypeName(sourceDataType.type, canonicalTypes);
  const nextType = resolvedTarget || alreadyCanonical || fallback;

  return { ...sourceDataType, type: nextType };
}
