import type React from "react";
import { Checkbox, FormSelect } from "@datam8/ui";
import { Trash2 } from "lucide-react";
import type { BaseEntity, PropertyOption } from "../../../model-types";
import { PropertyChips, type PropertyChipItem } from "../common/PropertyChips";
import { ActionButton } from "../common/ActionButton";
import { IconBtn } from "../common/IconBtn";
import { SectionCard } from "../common/SectionCard";
import { findBaseItemIndex, getBaseItemSelectionKey } from "../lib/baseItemSelection";

type PropertyValuesEditorProps = {
  baseData: any;
  selectedBase: BaseEntity | null;
  selectedBaseItem: string | null;
  setSelectedBaseItem: React.Dispatch<React.SetStateAction<string | null>>;
  baseDraft: any | null;
  setBaseDraft: React.Dispatch<React.SetStateAction<any | null>>;
  markBaseDirty: () => void;
  isMissingField: (key: string, field: string) => boolean;
  propertyOptions: PropertyOption[];
};

const RESERVED_VALUE_FIELDS = new Set(["name", "displayName", "default", "property", "properties"]);
const PROPERTY_SCOPE_OPTIONS = ["folder", "model", "base"] as const;

export const PropertyValuesEditor = ({
  baseData,
  selectedBase,
  selectedBaseItem,
  setSelectedBaseItem,
  baseDraft,
  setBaseDraft,
  markBaseDirty,
  isMissingField,
  propertyOptions,
}: PropertyValuesEditorProps) => {
  const currentList = Array.isArray(baseData.items) ? baseData.items : [];
  const currentIndex = findBaseItemIndex(currentList, selectedBaseItem);
  const current = currentIndex >= 0 ? currentList[currentIndex] : null;

  if (!selectedBase || !current) return <div className="muted">Select an item.</div>;

  const updateCurrent = (updater: (item: any) => any) => {
    if (currentIndex < 0) return;
    markBaseDirty();
    const nextItem = updater(current);
    const nextList = currentList.map((item: any, idx: number) => (idx === currentIndex ? nextItem : item));
    if (baseData.type === "properties") {
      setBaseDraft({ ...(baseDraft || {}), properties: nextList });
      setSelectedBaseItem(getBaseItemSelectionKey(nextItem, currentIndex));
      return;
    }
    setBaseDraft({ ...(baseDraft || {}), propertyValues: nextList });
    setSelectedBaseItem(getBaseItemSelectionKey(nextItem, currentIndex));
  };

  if (baseData.type === "properties") {
    const itemKey = current.name || `property_${currentIndex + 1}`;
    const invalidStyle = (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined);
    const scopes = Array.isArray(current.scopes) ? current.scopes : [];

    const setScopes = (nextScopes: any[]) => {
      updateCurrent((item) => ({ ...item, scopes: nextScopes }));
    };

    const updateScope = (scopeIdx: number, nextScope: any) => {
      setScopes(scopes.map((scope: any, idx: number) => (idx === scopeIdx ? nextScope : scope)));
    };

    return (
      <div>
        <div className="item-header">
          <div className="item-title-row">
            <div className="item-title">{current.name || "Unnamed"}</div>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label>Name *</label>
            <input
              value={current.name || ""}
              onChange={(event) => {
                const nextName = event.target.value;
                updateCurrent((item) => ({ ...item, name: nextName }));
              }}
              style={invalidStyle("name")}
            />
          </div>
          <div>
            <label>Display Name *</label>
            <input
              value={current.displayName || ""}
              onChange={(event) => updateCurrent((item) => ({ ...item, displayName: event.target.value }))}
              style={invalidStyle("displayName")}
            />
          </div>
          <div>
            <label>Schema</label>
            <input
              value={current.schema || ""}
              onChange={(event) => updateCurrent((item) => ({ ...item, schema: event.target.value }))}
            />
          </div>
          <div className="full">
            <SectionCard
              title="Scopes"
              actions={(
                <ActionButton
                  variant="ghost"
                  onClick={() => setScopes([...scopes, { type: "", singleUsage: true, mandatory: false }])}
                >
                  Add Scope
                </ActionButton>
              )}
            >
              {scopes.length === 0 ? <div className="muted small">No scopes.</div> : null}
              {scopes.length > 0 ? (
                <div className="table">
                  <div className="table-row table-head" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.6fr" }}>
                    <div>Type *</div>
                    <div>Single Usage</div>
                    <div>Mandatory</div>
                    <div>Actions</div>
                  </div>
                  {scopes.map((scope: any, scopeIdx: number) => (
                    <div
                      key={`scope-${scopeIdx}`}
                      className="table-row"
                      style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.6fr" }}
                    >
                      <div>
                        {(() => {
                          const scopeType = typeof scope?.type === "string" ? scope.type : "";
                          const hasCustomType =
                            scopeType.trim().length > 0 && !PROPERTY_SCOPE_OPTIONS.includes(scopeType as (typeof PROPERTY_SCOPE_OPTIONS)[number]);
                          const options = [
                            { value: "", label: "Select type" },
                            ...PROPERTY_SCOPE_OPTIONS.map((value) => ({ value, label: value })),
                            ...(hasCustomType ? [{ value: scopeType, label: scopeType }] : []),
                          ];
                          return (
                        <FormSelect
                          value={scopeType}
                          onChange={(value) => updateScope(scopeIdx, { ...scope, type: value })}
                          options={options}
                          placeholder="Select type"
                          className={isMissingField(itemKey, `scope:${scopeIdx}:type`) ? "border-destructive" : undefined}
                        />
                          );
                        })()}
                      </div>
                      <div>
                        <div className="toggle-field">
                          <Checkbox
                            checked={scope?.singleUsage !== false}
                            onCheckedChange={(checked) => updateScope(scopeIdx, { ...scope, singleUsage: checked === true })}
                            aria-label="Single Usage"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="toggle-field">
                          <Checkbox
                            checked={scope?.mandatory === true}
                            onCheckedChange={(checked) => updateScope(scopeIdx, { ...scope, mandatory: checked === true })}
                            aria-label="Mandatory"
                          />
                        </div>
                      </div>
                      <div className="actions actions--tight">
                        <IconBtn
                          title="Remove"
                          onClick={() => setScopes(scopes.filter((_scope: any, idx: number) => idx !== scopeIdx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </SectionCard>
          </div>
        </div>
      </div>
    );
  }

  const itemKey = `propertyValue:${current.property || "unknown"}:${current.name || currentIndex + 1}`;
  const invalidStyle = (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined);
  const allPropertyNames = Array.from(new Set(propertyOptions.map((item) => item.name).filter(Boolean)));
  const subPropertyOptions = propertyOptions.filter((item) => item.name && item.name !== current.property);
  const assignments = Array.isArray(current.properties) ? current.properties : [];
  const attributeRows = Object.entries(current || {})
    .filter(([key]) => !RESERVED_VALUE_FIELDS.has(key))
    .map(([name, value]) => ({ name, value }));

  const setAssignments = (nextAssignments: any[]) => {
    updateCurrent((item) => ({ ...item, properties: nextAssignments }));
  };

  const setAttributes = (nextAttributes: Array<{ name: string; value: unknown }>) => {
    updateCurrent((item) => {
      const nextItem = { ...item };
      Object.keys(nextItem).forEach((key) => {
        if (!RESERVED_VALUE_FIELDS.has(key)) {
          delete nextItem[key];
        }
      });
      nextAttributes.forEach((entry) => {
        const key = `${entry?.name ?? ""}`.trim();
        if (!key || RESERVED_VALUE_FIELDS.has(key)) return;
        nextItem[key] = entry.value;
      });
      return nextItem;
    });
  };

  return (
    <div>
      <div className="item-header">
        <div className="item-title-row">
          <div className="item-title">{current.name || "Unnamed"}</div>
        </div>
        <PropertyChips
          className="chips--sm item-chips"
          items={assignments
            .map((entry: any, index: number): PropertyChipItem | null => {
              const property = `${entry?.property ?? ""}`;
              if (!property.trim()) return null;
              return {
                key: `${current.property || "unknown"}:${current.name || "value"}:assignment:${index}`,
                property,
                value: `${entry?.value ?? "-"}`,
                inherited: false,
                title: "Sub property",
                removeKey: index,
              };
            })
            .filter((item: PropertyChipItem | null): item is PropertyChipItem => item !== null)}
          propertyOptions={subPropertyOptions}
          usedPropertyNames={new Set(assignments.map((entry: any) => `${entry?.property ?? ""}`).filter((value: string) => value.trim().length > 0))}
          onAdd={(property, value) => setAssignments([...assignments, { property, value }])}
          onRemove={(index) => setAssignments(assignments.filter((_item: any, idx: number) => idx !== Number(index)))}
          addLabel="Add sub property"
          addDisabled={!subPropertyOptions.some((entry) => (entry.values || []).length > 0)}
        />
      </div>
      <div className="form-grid">
        <div>
          <label>Property *</label>
          <FormSelect
            value={current.property || ""}
            onChange={(value) => updateCurrent((item) => ({ ...item, property: value }))}
            options={[{ value: "", label: "Select property" }, ...allPropertyNames.map((value) => ({ value, label: value }))]}
            placeholder="Select property"
            className={invalidStyle("property") ? "border-destructive" : undefined}
          />
        </div>
        <div>
          <label>Value Name *</label>
          <input
            value={current.name || ""}
            onChange={(event) => {
              const nextName = event.target.value;
              updateCurrent((item) => ({ ...item, name: nextName }));
            }}
            style={invalidStyle("name")}
          />
        </div>
        <div>
          <label>Display Name</label>
          <input
            value={current.displayName || ""}
            onChange={(event) => updateCurrent((item) => ({ ...item, displayName: event.target.value }))}
          />
        </div>
        <div>
          <label>Default</label>
          <div className="toggle-field toggle-field--inline">
            <Checkbox
              checked={!!current.default}
              onCheckedChange={(checked) => updateCurrent((item) => ({ ...item, default: checked === true }))}
              aria-label="Default"
            />
          </div>
        </div>
        <div className="full">
          <SectionCard
            title="Attributes"
            actions={(
              <ActionButton
                variant="ghost"
                onClick={() => setAttributes([...attributeRows, { name: `attr_${attributeRows.length + 1}`, value: "" }])}
              >
                Add Attribute
              </ActionButton>
            )}
          >
            {attributeRows.length === 0 ? <div className="muted small">No attributes.</div> : null}
            {attributeRows.length > 0 ? (
              <div className="table">
                <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr" }}>
                  <div>Name</div>
                  <div>Value</div>
                  <div>Actions</div>
                </div>
                {attributeRows.map((attr, attrIndex) => (
                  <div
                    key={`${attr.name}-${attrIndex}`}
                    className="table-row"
                    style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr" }}
                  >
                    <div>
                      <input
                        value={attr.name}
                        onChange={(event) => {
                          const next = attributeRows.map((entry, idx) =>
                            idx === attrIndex ? { ...entry, name: event.target.value } : entry,
                          );
                          setAttributes(next);
                        }}
                      />
                    </div>
                    <div>
                      <input
                        value={`${attr.value ?? ""}`}
                        onChange={(event) => {
                          const next = attributeRows.map((entry, idx) =>
                            idx === attrIndex ? { ...entry, value: event.target.value } : entry,
                          );
                          setAttributes(next);
                        }}
                      />
                    </div>
                    <div className="actions actions--tight">
                      <IconBtn
                        title="Remove"
                        onClick={() => setAttributes(attributeRows.filter((_entry, idx) => idx !== attrIndex))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
