import type {
  PropertyRefactorPayload,
  PropertyRename,
  PropertyValueDelete,
  PropertyValueMove,
  PropertyValueRename,
} from "@datam8/types";

type NamedObject = { name?: unknown; property?: unknown };

function asNamedList(value: unknown): NamedObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is NamedObject => !!item && typeof item === "object");
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

type PropertyDiff = Pick<PropertyRefactorPayload, "propertyRenames" | "deletedProperties">;
type PropertyValueDiff = Pick<PropertyRefactorPayload, "valueRenames" | "deletedValues" | "valueMoves">;

export function diffPropertyChanges(prevContent: unknown, nextContent: unknown): PropertyDiff {
  const prevProps = asNamedList((prevContent as { properties?: unknown } | null | undefined)?.properties);
  const nextProps = asNamedList((nextContent as { properties?: unknown } | null | undefined)?.properties);

  const prevNames = prevProps.map((p) => asNonEmptyString(p.name)).filter((n): n is string => !!n);
  const nextNames = nextProps.map((p) => asNonEmptyString(p.name)).filter((n): n is string => !!n);
  const prevNameSet = new Set(prevNames);
  const nextNameSet = new Set(nextNames);

  const deletedProperties = prevNames.filter((name) => !nextNameSet.has(name));
  const addedProperties = nextNames.filter((name) => !prevNameSet.has(name));

  if (deletedProperties.length === 1 && addedProperties.length === 1 && prevProps.length === nextProps.length) {
    const propertyRenames: PropertyRename[] = [{ oldName: deletedProperties[0], newName: addedProperties[0] }];
    return { propertyRenames, deletedProperties: [] };
  }
  if (deletedProperties.length > 0) {
    return { propertyRenames: [], deletedProperties };
  }

  const propertyRenames: PropertyRename[] = [];
  const pairCount = Math.min(prevProps.length, nextProps.length);
  for (let i = 0; i < pairCount; i += 1) {
    const prevName = asNonEmptyString(prevProps[i]?.name);
    const nextName = asNonEmptyString(nextProps[i]?.name);
    if (prevName && nextName && prevName !== nextName) {
      propertyRenames.push({ oldName: prevName, newName: nextName });
    }
  }
  return { propertyRenames, deletedProperties: [] };
}

export function diffPropertyValueChanges(prevContent: unknown, nextContent: unknown): PropertyValueDiff {
  const prevValues = asNamedList((prevContent as { propertyValues?: unknown } | null | undefined)?.propertyValues);
  const nextValues = asNamedList((nextContent as { propertyValues?: unknown } | null | undefined)?.propertyValues);

  const groupByProperty = (list: NamedObject[]) => {
    const out = new Map<string, NamedObject[]>();
    list.forEach((item) => {
      const propertyName = asNonEmptyString(item.property);
      if (!propertyName) return;
      if (!out.has(propertyName)) out.set(propertyName, []);
      out.get(propertyName)!.push(item);
    });
    return out;
  };

  const prevByProperty = groupByProperty(prevValues);
  const nextByProperty = groupByProperty(nextValues);
  const valueRenames: PropertyValueRename[] = [];
  const deletedValues: PropertyValueDelete[] = [];
  const valueMoves: PropertyValueMove[] = [];
  const movedOldKeys = new Set<string>();

  const pairCountGlobal = Math.min(prevValues.length, nextValues.length);
  for (let i = 0; i < pairCountGlobal; i += 1) {
    const oldProperty = asNonEmptyString(prevValues[i]?.property);
    const oldValue = asNonEmptyString(prevValues[i]?.name);
    const newProperty = asNonEmptyString(nextValues[i]?.property);
    const newValue = asNonEmptyString(nextValues[i]?.name);
    if (!oldProperty || !oldValue || !newProperty || !newValue) continue;
    if (oldProperty === newProperty || oldValue !== newValue) continue;
    valueMoves.push({
      oldProperty,
      oldValue,
      newProperty,
      newValue,
    });
    movedOldKeys.add(`${oldProperty}\u0000${oldValue}`);
  }

  prevByProperty.forEach((prevList, property) => {
    const nextList = nextByProperty.get(property) || [];

    const prevNames = prevList.map((item) => asNonEmptyString(item.name)).filter((n): n is string => !!n);
    const nextNames = nextList.map((item) => asNonEmptyString(item.name)).filter((n): n is string => !!n);
    const prevNameSet = new Set(prevNames);
    const nextNameSet = new Set(nextNames);

    const removed = prevNames.filter((name) => !nextNameSet.has(name));
    const added = nextNames.filter((name) => !prevNameSet.has(name));

    if (removed.length === 1 && added.length === 1 && prevList.length === nextList.length) {
      valueRenames.push({ property, oldValue: removed[0], newValue: added[0] });
      return;
    }

    const renamedOldValues = new Set<string>();
    const renamedNewValues = new Set<string>();

    if (removed.length > 0 && removed.length === added.length) {
      const removedSet = new Set(removed);
      const addedSet = new Set(added);
      const removedOrdered = prevList
        .map((item, idx) => ({ idx, name: asNonEmptyString(item?.name) }))
        .filter((item): item is { idx: number; name: string } => !!item.name && removedSet.has(item.name));
      const addedOrdered = nextList
        .map((item, idx) => ({ idx, name: asNonEmptyString(item?.name) }))
        .filter((item): item is { idx: number; name: string } => !!item.name && addedSet.has(item.name));

      for (let i = 0; i < Math.min(removedOrdered.length, addedOrdered.length); i += 1) {
        const oldValue = removedOrdered[i].name;
        const newValue = addedOrdered[i].name;
        if (oldValue === newValue) continue;
        valueRenames.push({ property, oldValue, newValue });
        renamedOldValues.add(oldValue);
        renamedNewValues.add(newValue);
      }
    }

    removed
      .filter((name) => !renamedOldValues.has(name))
      .forEach((name) => {
        const key = `${property}\u0000${name}`;
        if (movedOldKeys.has(key)) return;
        deletedValues.push({ property, value: name });
      });
  });

  return { valueRenames, deletedValues, valueMoves };
}

export function createPropertyRefactorPayload(changes: Partial<PropertyRefactorPayload>): PropertyRefactorPayload | null {
  const payload: PropertyRefactorPayload = {
    propertyRenames: changes.propertyRenames || [],
    valueRenames: changes.valueRenames || [],
    deletedProperties: changes.deletedProperties || [],
    deletedValues: changes.deletedValues || [],
    valueMoves: changes.valueMoves || [],
  };
  if (
    !payload.propertyRenames.length &&
    !payload.valueRenames.length &&
    !payload.deletedProperties.length &&
    !payload.deletedValues.length &&
    !payload.valueMoves.length
  ) {
    return null;
  }
  return payload;
}
