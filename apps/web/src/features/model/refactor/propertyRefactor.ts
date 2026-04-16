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

  const removedCandidates: Array<{ property: string; value: string }> = [];
  const addedCandidates: Array<{ property: string; value: string }> = [];

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

    const pairCount = Math.min(prevList.length, nextList.length);
    for (let i = 0; i < pairCount; i += 1) {
      const prevName = asNonEmptyString(prevList[i]?.name);
      const nextName = asNonEmptyString(nextList[i]?.name);
      if (prevName && nextName && prevName !== nextName) {
        valueRenames.push({ property, oldValue: prevName, newValue: nextName });
        renamedOldValues.add(prevName);
        renamedNewValues.add(nextName);
      }
    }

    removed
      .filter((name) => !renamedOldValues.has(name))
      .forEach((name) => removedCandidates.push({ property, value: name }));
    added
      .filter((name) => !renamedNewValues.has(name))
      .forEach((name) => addedCandidates.push({ property, value: name }));
  });

  nextByProperty.forEach((nextList, property) => {
    if (prevByProperty.has(property)) return;
    nextList
      .map((item) => asNonEmptyString(item.name))
      .filter((n): n is string => !!n)
      .forEach((name) => addedCandidates.push({ property, value: name }));
  });

  for (const removed of removedCandidates) {
    const matchingAdded = addedCandidates.filter((added) => added.value === removed.value);
    if (matchingAdded.length !== 1) continue;
    const target = matchingAdded[0];
    if (target.property === removed.property) continue;

    valueMoves.push({
      oldProperty: removed.property,
      oldValue: removed.value,
      newProperty: target.property,
      newValue: target.value,
    });

    const idx = addedCandidates.findIndex(
      (added) => added.property === target.property && added.value === target.value,
    );
    if (idx >= 0) addedCandidates.splice(idx, 1);
  }

  const movedKeys = new Set(valueMoves.map((move) => `${move.oldProperty}\u0000${move.oldValue}`));
  removedCandidates.forEach((removed) => {
    const key = `${removed.property}\u0000${removed.value}`;
    if (!movedKeys.has(key)) {
      deletedValues.push({ property: removed.property, value: removed.value });
    }
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
