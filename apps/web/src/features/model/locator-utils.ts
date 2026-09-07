type LocatorLikeObject = {
  entityType?: unknown;
  folders?: unknown;
  entityName?: unknown;
};

function normalizePath(value: string): string {
  return (value || "").replace(/\\/g, "/");
}

function normalizeSegments(parts: string[]): string[] {
  return parts.map((p) => (p || "").trim()).filter((p) => p.length > 0);
}

function foldersFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeSegments(value.map((v) => `${v ?? ""}`));
}

function modelRootFromRelPath(relPath: string, fallback: string): string {
  const first = normalizeSegments(normalizePath(relPath).split("/"))[0];
  return first || fallback;
}

export function modelLocatorFromRelPath(relPath: string): string {
  const withoutExt = normalizePath(relPath).replace(/\.json$/i, "").replace(/^\/+/, "");
  const parts = normalizeSegments(withoutExt.split("/"));
  if (!parts.length) return "";

  if (parts[0] === "modelEntities") {
    return `/${parts.join("/")}`;
  }

  if (parts[0].toLowerCase() === "model") {
    const [, ...tail] = parts;
    if (!tail.length) return "/modelEntities";
    return `/modelEntities/${tail.join("/")}`;
  }

  return `/modelEntities/${parts.join("/")}`;
}

export function folderLocatorFromFolderPath(folderPath: string): string {
  const norm = normalizePath(folderPath).replace(/^\/+|\/+$/g, "");
  return norm ? `/folders/${norm}` : "/folders";
}

export function modelFolderLocatorFromFolderPath(folderPath: string): string {
  const norm = normalizePath(folderPath)
    .replace(/^\/+|\/+$/g, "")
    .replace(/^Model\//i, "");
  return norm ? `/modelEntities/${norm}/` : "/modelEntities";
}

export function modelFolderPathFromRelPath(relPath: string): string {
  const parts = normalizeSegments(normalizePath(relPath).split("/"));
  if (parts.length <= 2) return "";
  return parts.slice(1, -1).join("/");
}

export function rebaseModelRelPath(relPath: string, fromFolderPath: string, toFolderPath: string): string {
  const parts = normalizeSegments(normalizePath(relPath).split("/"));
  if (parts.length < 2) return relPath;

  const currentFolderPath = parts.slice(1, -1).join("/");
  const from = normalizePath(fromFolderPath).replace(/^\/+|\/+$/g, "").replace(/^Model\//i, "");
  const to = normalizePath(toFolderPath).replace(/^\/+|\/+$/g, "").replace(/^Model\//i, "");
  if (!(currentFolderPath === from || currentFolderPath.startsWith(`${from}/`))) return relPath;

  const suffix = currentFolderPath === from ? "" : currentFolderPath.slice(from.length + 1);
  const nextFolderPath = normalizeSegments([to, suffix]).join("/");
  return normalizeSegments([parts[0], nextFolderPath, parts[parts.length - 1]]).join("/");
}

export function folderPathFromRelPath(relPath: string, modelPath: string): string {
  const normRel = normalizePath(relPath).replace(/^\/+/, "");
  const modelRoot = normalizePath(modelPath || "Model").replace(/^\/+|\/+$/g, "");
  const prefix = modelRoot ? `${modelRoot}/` : "";

  let withoutRoot = normRel;
  if (withoutRoot.startsWith("modelEntities/")) {
    withoutRoot = withoutRoot.slice("modelEntities/".length);
  } else if (prefix && withoutRoot.startsWith(prefix)) {
    withoutRoot = withoutRoot.slice(prefix.length);
  }
  const withoutFile = withoutRoot.replace(/\/\.properties\.json$/i, "");
  return withoutFile.replace(/^\/+|\/+$/g, "");
}

export function locatorToClientString(params: {
  locator: unknown;
  relPath?: string;
  folderPath?: string;
  modelPath?: string;
}): string {
  const { locator, relPath = "", folderPath = "", modelPath = "Model" } = params;

  if (typeof locator === "string" && locator.trim()) {
    return normalizePath(locator.trim());
  }

  if (locator && typeof locator === "object") {
    const raw = locator as LocatorLikeObject;
    const entityType = `${raw.entityType ?? ""}`.trim();
    const folders = foldersFromUnknown(raw.folders);
    const entityName = `${raw.entityName ?? ""}`.trim();

    if (entityType === "modelEntities") {
      const parts = normalizeSegments(["modelEntities", ...folders, entityName]);
      return parts.length ? `/${parts.join("/")}` : "";
    }

    if (entityType === "folders") {
      return folderLocatorFromFolderPath(normalizeSegments([...folders, entityName]).join("/"));
    }

    if (entityType) {
      const parts = normalizeSegments([entityType, ...folders, entityName]);
      return parts.length ? `/${parts.join("/")}` : "";
    }
  }

  if (relPath) {
    const normRel = normalizePath(relPath).replace(/^\/+/, "");
    if (normRel.toLowerCase().startsWith("base/")) {
      return `/${normRel.replace(/\.json$/i, "")}`;
    }
    return modelLocatorFromRelPath(normRel);
  }
  if (folderPath) return folderLocatorFromFolderPath(folderPath);
  return "";
}
