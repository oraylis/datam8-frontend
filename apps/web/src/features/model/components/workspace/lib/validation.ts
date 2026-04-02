export type ValidationResult = {
  missing: Record<string, Set<string>>;
  errors: string[];
};

const listKey = (prefix: string, name: string | undefined, idx: number) =>
  name && name !== "Unnamed" ? name : `${prefix}_${idx + 1}`;

const reservedPropertyValueFields = new Set(["name", "displayName", "default", "property", "properties"]);

type LooseRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is LooseRecord => !!value && typeof value === "object";
const asRecord = (value: unknown): LooseRecord => (isRecord(value) ? value : {});
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asString = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const normalizeName = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

const findDuplicateNames = (list: unknown[], nameSelector?: (row: LooseRecord) => unknown): string[] => {
  const select = nameSelector || ((row: LooseRecord) => row.name);
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  asList(list).forEach((item) => {
    const row = asRecord(item);
    const raw = select(row);
    if (typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = normalizeName(trimmed);
    if (!key) return;
    const existing = seen.get(key);
    if (existing) {
      duplicates.add(existing);
      return;
    }
    seen.set(key, trimmed);
  });
  return Array.from(duplicates.values());
};

export const validateBaseContent = (type: string, content: unknown): ValidationResult => {
  const contentRecord = asRecord(content);
  const missing: Record<string, Set<string>> = {};
  const errors: string[] = [];

  const mark = (key: string, field: string, message?: string) => {
    if (!missing[key]) missing[key] = new Set();
    missing[key].add(field);
    if (message) errors.push(message);
  };

  switch (type) {
    case "attributeTypes": {
      const list = asList(contentRecord.attributeTypes);
      if (!list.length) errors.push("At least one Attribute Type is required.");
      list.forEach((item, idx) => {
        const row = asRecord(item);
        const key = listKey("attributeType", asString(row.name), idx);
        if (!row.name) mark(key, "name");
        if (!row.displayName) mark(key, "displayName");
        if (!row.defaultType) mark(key, "defaultType");
      });
      const duplicateNames = findDuplicateNames(list);
      if (duplicateNames.length) {
        errors.push(`Attribute Type names must be unique. Duplicates: ${duplicateNames.join(", ")}.`);
      }
      break;
    }
    case "dataTypes": {
      const list = asList(contentRecord.dataTypes);
      if (!list.length) errors.push("At least one Data Type is required.");
      list.forEach((item, idx) => {
        const row = asRecord(item);
        const key = listKey("dataType", asString(row.name), idx);
        if (!row.name) mark(key, "name");
        const targets = asRecord(row.targets);
        const targetKeys = Object.keys(targets);
        if (!targetKeys.length) {
          mark(key, "targets");
        } else {
          targetKeys.forEach((t) => {
            if (!targets[t]) mark(key, `target:${t}`);
          });
        }
      });
      const duplicateNames = findDuplicateNames(list);
      if (duplicateNames.length) {
        errors.push(`Data Type names must be unique. Duplicates: ${duplicateNames.join(", ")}.`);
      }
      break;
    }
    case "dataSources": {
      const list = asList(contentRecord.dataSources);
      list.forEach((item, idx) => {
        const row = asRecord(item);
        const key = listKey("dataSource", asString(row.name), idx);
        if (!row.name) mark(key, "name");
        if (!row.type && !row.dataSourceType) mark(key, "type");
        asList(row.dataTypeMapping).forEach((m, mIdx) => {
          const mapping = asRecord(m);
          const mKey = `${key}:mapping_${mIdx + 1}`;
          if (!mapping.sourceType) mark(mKey, "sourceType");
          if (!mapping.targetType) mark(mKey, "targetType");
        });
      });
      const duplicateNames = findDuplicateNames(list);
      if (duplicateNames.length) {
        errors.push(`Data Source names must be unique. Duplicates: ${duplicateNames.join(", ")}.`);
      }
      break;
    }
    case "dataSourceTypes": {
      const list = asList(contentRecord.dataSourceTypes);
      if (!list.length) errors.push("At least one Data Source Type is required.");
      list.forEach((item, idx) => {
        const row = asRecord(item);
        const key = listKey("dataSourceType", asString(row.name), idx);
        if (!row.name) mark(key, "name");
        const mappings = asList(row.dataTypeMapping);
        if (!mappings.length) mark(key, "dataTypeMapping");
        mappings.forEach((m, mIdx) => {
          const mapping = asRecord(m);
          const mKey = `${key}:mapping_${mIdx + 1}`;
          if (!mapping.sourceType) mark(mKey, "sourceType");
          if (!mapping.targetType) mark(mKey, "targetType");
        });
      });
      const duplicateNames = findDuplicateNames(list);
      if (duplicateNames.length) {
        errors.push(`Data Source Type names must be unique. Duplicates: ${duplicateNames.join(", ")}.`);
      }
      break;
    }
    case "dataProducts": {
      const list = asList(contentRecord.dataProducts);
      list.forEach((item, idx) => {
        const row = asRecord(item);
        const key = listKey("dataProduct", asString(row.name), idx);
        if (!row.name) mark(key, "name");
        const modules = asList(row.dataModules);
        if (!modules.length) mark(key, "dataModules");
        modules.forEach((m, mIdx) => {
          const moduleRow = asRecord(m);
          const mKey = `${key}:module_${mIdx + 1}`;
          if (!moduleRow.name) mark(mKey, "name");
        });
        const duplicateModules = findDuplicateNames(modules);
        if (duplicateModules.length) {
          const label = asString(row.name) || `dataProduct_${idx + 1}`;
          errors.push(`Data Product "${label}" has duplicate module names: ${duplicateModules.join(", ")}.`);
        }
      });
      const duplicateNames = findDuplicateNames(list);
      if (duplicateNames.length) {
        errors.push(`Data Product names must be unique. Duplicates: ${duplicateNames.join(", ")}.`);
      }
      break;
    }
    case "zones": {
      const list = asList(contentRecord.zones);
      list.forEach((item, idx) => {
        const row = asRecord(item);
        const key = listKey("zone", asString(row.name), idx);
        if (!row.name) mark(key, "name");
        if (!row.targetName) mark(key, "targetName");
        if (!row.displayName) mark(key, "displayName");
      });
      const duplicateNames = findDuplicateNames(list);
      if (duplicateNames.length) {
        errors.push(`Zone names must be unique. Duplicates: ${duplicateNames.join(", ")}.`);
      }
      break;
    }
    case "properties": {
      const list = asList(contentRecord.properties);
      list.forEach((item, idx) => {
        const row = asRecord(item);
        const key = listKey("property", asString(row.name), idx);
        if (!row.name) mark(key, "name");
        if (!row.displayName) mark(key, "displayName");
        const scopes = asList(row.scopes);
        const seenScopeTypes = new Set<string>();
        scopes.forEach((scope, scopeIdx) => {
          const scopeRow = asRecord(scope);
          const scopeType = asString(scopeRow.type);
          if (!scopeType) {
            mark(key, `scope:${scopeIdx}:type`);
            return;
          }
          const normalizedType = normalizeName(scopeType);
          if (seenScopeTypes.has(normalizedType)) {
            errors.push(`Property "${asString(row.name) || idx + 1}" has duplicate scope type "${scopeType}".`);
            return;
          }
          seenScopeTypes.add(normalizedType);
        });
      });
      const duplicateNames = findDuplicateNames(list);
      if (duplicateNames.length) {
        errors.push(`Property names must be unique. Duplicates: ${duplicateNames.join(", ")}.`);
      }
      break;
    }
    case "propertyValues": {
      const values = asList(contentRecord.propertyValues);
      values.forEach((val, idx) => {
        const row = asRecord(val);
        const vKey = `propertyValue:${asString(row.property) || "unknown"}:${asString(row.name) || idx + 1}`;
        if (!row.name) mark(vKey, "name");
        if (!row.property) mark(vKey, "property");
        Object.keys(row).forEach((field) => {
          if (!reservedPropertyValueFields.has(field) && row[field] === undefined) {
            mark(vKey, field);
          }
        });
      });
      const duplicateNames = new Set<string>();
      values.forEach((val) => {
        const row = asRecord(val);
        const propertyName = asString(row.property) || "";
        const valueName = asString(row.name) || "";
        if (!propertyName || !valueName) return;
        const matches = values.filter((candidate) => {
          const candidateRow = asRecord(candidate);
          return (
            normalizeName(candidateRow.property) === normalizeName(propertyName) &&
            normalizeName(candidateRow.name) === normalizeName(valueName)
          );
        });
        if (matches.length > 1) {
          duplicateNames.add(`${propertyName}.${valueName}`);
        }
      });
      if (duplicateNames.size > 0) {
        errors.push(`Property Value names must be unique per property. Duplicates: ${Array.from(duplicateNames).join(", ")}.`);
      }
      break;
    }
    default:
      break;
  }

  return { missing, errors };
};

export const validateEntity = (entity: unknown): ValidationResult => {
  const entityRecord = asRecord(entity);
  const missing: Record<string, Set<string>> = {};
  const errors: string[] = [];
  const mark = (key: string, field: string, message?: string) => {
    if (!missing[key]) missing[key] = new Set();
    missing[key].add(field);
    if (message) errors.push(message);
  };
  if (!entityRecord.name) {
    mark("entity", "name", "Name is required.");
  }
  const attributes = asList(entityRecord.attributes);
  if (!attributes.length || attributes.some((a) => !asRecord(a).name)) {
    mark("entity", "attributes", "All attributes need a name.");
  }
  asList(entityRecord.sources).forEach((src, idx) => {
    const source = asRecord(src);
    const key = `source_${idx + 1}`;
    const isExternal = source.type === "external" || !!source.dataSource;
    const isValidInternalSourceLocation = (v: unknown) => {
      if (typeof v === "string") return v.trim().length > 0;
      if (typeof v === "number") return Number.isFinite(v);
      return false;
    };
    if (isExternal) {
      if (!source.dataSource) mark(key, "dataSource", "External sources need a data source.");
      if (!source.sourceLocation) mark(key, "sourceLocation", "External sources need a source location.");
    } else {
      if (!isValidInternalSourceLocation(source.sourceLocation)) {
        mark(key, "sourceLocation", "Internal sources need a valid sourceLocation.");
      }
    }
  });
  return { missing, errors };
};
