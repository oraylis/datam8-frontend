import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Checkbox,
  FormSelect,
  Input,
  Textarea,
  cn,
} from "@datam8/ui";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { BaseEntity, PropertyOption } from "../../../model-types";
import { humanize } from "../../../../../shared/utils/strings";
import { mergeInheritedProps } from "../../../model-utils";
import {
  findBaseItemIndex,
  getBaseItemLegacySelectionKey,
  getBaseItemSelectionKey,
  isBaseItemSelected,
} from "../lib/baseItemSelection";
import { buildPropertyValueGroups } from "../lib/propertyValueGroups";
import { ActionButton } from "../common/ActionButton";
import { EditorPanelHeader } from "../common/EditorPanelHeader";
import { IconBtn } from "../common/IconBtn";
import { PropertyChips, type PropertyChipItem } from "../common/PropertyChips";
import { PropertyList, type PropertyListRow } from "../common/PropertyList";
import { SectionCard } from "../common/SectionCard";
import { DataSourcesEditor } from "./DataSourcesEditor";
import { DataSourceTypesEditor } from "./DataSourceTypesEditor";
import { PropertyValuesEditor } from "./PropertyValuesEditor";
import { useResizablePane } from "../../../../layout/useResizablePane";

type BaseEditorProps = {
  selectedBase: BaseEntity | null;
  selectedBaseItem: string | null;
  setSelectedBaseItem: React.Dispatch<React.SetStateAction<string | null>>;
  baseMode: "form" | "json";
  setBaseMode: React.Dispatch<React.SetStateAction<"form" | "json">>;
  baseDraft: any | null;
  setBaseDraft: React.Dispatch<React.SetStateAction<any | null>>;
  baseJsonText: string;
  setBaseJsonText: React.Dispatch<React.SetStateAction<string>>;
  baseData: any;
  isMissingField: (key: string, field: string) => boolean;
  addBaseItem: () => void;
  removeBaseItem: (itemKey: string, opts?: { confirm?: boolean }) => { removedName: string; undo: () => void } | null;
  markBaseDirty: () => void;
  onDirtyBase: (relPath: string, dirty: boolean) => void;
  propertyOptions: PropertyOption[];
  propertyScopeTypeOptions: Array<{ value: string; label: string }>;
  dataTypes: string[];
  selectedDataModule: string | null;
  setSelectedDataModule: React.Dispatch<React.SetStateAction<string | null>>;
  generatorTargets: string[];
  dataSourceTypes: any[];
  dataSourcesRelPath: string | null;
  dataSourceTypesRelPath: string | null;
  onPatchBaseEntity: (relPath: string, updater: (content: any) => any) => void;
  persistNow: (
    reason: "text-blur" | "dropdown-change" | "tab-switch" | "add-item" | "delete-item" | "undo-delete",
  ) => Promise<boolean>;
  persistAfterStateFlush: (
    reason: "text-blur" | "dropdown-change" | "tab-switch" | "add-item" | "delete-item" | "undo-delete",
  ) => void;
};

export const BaseEditor = (props: BaseEditorProps) => {
  const {
    selectedBase,
    selectedBaseItem,
    setSelectedBaseItem,
    baseMode,
    setBaseMode,
    baseDraft,
    setBaseDraft,
    baseJsonText,
    setBaseJsonText,
    baseData,
    isMissingField,
    addBaseItem,
    removeBaseItem,
    markBaseDirty,
    onDirtyBase,
    propertyOptions,
    propertyScopeTypeOptions,
    dataTypes,
    selectedDataModule,
    setSelectedDataModule,
    generatorTargets,
    dataSourceTypes,
    dataSourcesRelPath,
    dataSourceTypesRelPath,
    onPatchBaseEntity,
    persistNow,
    persistAfterStateFlush,
  } = props;

  const initialListWidth = useMemo(() => {
    try {
      const raw = localStorage.getItem("dm8_base_items_width");
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) ? n : 320;
    } catch {
      return 320;
    }
  }, []);
  const { width: listWidth, setWidth: setListWidth, startResize } = useResizablePane({
    initialWidth: initialListWidth,
    min: 240,
    max: 640,
    onChange: (next) => {
      try {
        localStorage.setItem("dm8_base_items_width", String(next));
      } catch {
        // ignore
      }
    },
  });

  useEffect(() => {
    setListWidth(initialListWidth);
  }, [initialListWidth, setListWidth]);

  const [expandedPropertyGroups, setExpandedPropertyGroups] = useState<Set<string>>(new Set());

  const propertyValueGroups = useMemo(() => {
    if (baseData?.type !== "propertyValues") return [];
    return buildPropertyValueGroups(Array.isArray(baseData?.items) ? baseData.items : []);
  }, [baseData?.items, baseData?.type]);

  useEffect(() => {
    if (propertyValueGroups.length === 0) {
      setExpandedPropertyGroups(new Set());
      return;
    }
    setExpandedPropertyGroups((prev) => {
      const next = new Set<string>();
      propertyValueGroups.forEach((group) => {
        if (prev.has(group.propertyKey) || prev.size === 0) {
          next.add(group.propertyKey);
        }
      });
      return next;
    });
  }, [propertyValueGroups]);

  const handleTextFieldBlurCapture = useMemo(
    () =>
      (event: React.FocusEvent<HTMLDivElement>) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
        if (target.closest("[data-explicit-autosave='true']")) return;
        if (target instanceof HTMLInputElement) {
          const blocked = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "hidden", "color", "range"]);
          if (blocked.has((target.type || "").toLowerCase())) return;
        }
        void persistNow("text-blur");
      },
    [persistNow],
  );

  useEffect(() => {
    if (baseMode !== "form") {
      setBaseMode("form");
    }
  }, [baseMode, setBaseMode]);

  const renderBaseListRow = useCallback((item: any, itemIdx: number, opts?: { nested?: boolean }) => {
    const selectionKey = getBaseItemSelectionKey(item, itemIdx);
    const name = getBaseItemLegacySelectionKey(item);
    const displayName =
      typeof item.displayName === "string" && item.displayName.trim().length > 0
        ? item.displayName.trim()
        : "";
    const primaryLabel = displayName || name;
    const isActive = isBaseItemSelected(item, itemIdx, selectedBaseItem);
    return (
      <div
        key={`${selectionKey}-${itemIdx}`}
        className={cn(
          "table-row base-list-table__row",
          opts?.nested ? "base-list-table__row--nested" : "",
          isActive ? "base-list-table__row--active" : "",
        )}
        role="button"
        tabIndex={0}
        style={{ gridTemplateColumns: "1fr auto" }}
        onClick={() => {
          if (selectedBaseItem === selectionKey) return;
          void (async () => {
            const canSwitch = await persistNow("tab-switch");
            if (!canSwitch) return;
            setSelectedBaseItem(selectionKey);
          })();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (selectedBaseItem === selectionKey) return;
            void (async () => {
              const canSwitch = await persistNow("tab-switch");
              if (!canSwitch) return;
              setSelectedBaseItem(selectionKey);
            })();
          }
        }}
      >
        <div className="base-list-table__label" title={primaryLabel}>{primaryLabel}</div>
        <IconBtn
          className="base-list-table__delete"
          title={`Delete ${primaryLabel}`}
          aria-label={`Delete ${primaryLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            const result = removeBaseItem(selectionKey, { confirm: false });
            if (!result) return;
            persistAfterStateFlush("delete-item");
            void result;
          }}
        >
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>
    );
  }, [persistAfterStateFlush, persistNow, removeBaseItem, selectedBaseItem, setSelectedBaseItem]);

  if (!selectedBase) return <div className="muted">Select a base entry to view.</div>;

  return (
    <div className="panel">
      <EditorPanelHeader
        eyebrow={selectedBase.relPath}
        title={humanize(baseData.type)}
        actions={null}
      />
      <div className="panel__body" onBlurCapture={handleTextFieldBlurCapture}>
        {baseMode === "json" ? (
            <div>
              <label>JSON</label>
              <Textarea
                rows={20}
                className="code"
                value={baseJsonText}
                onChange={(e) => {
                  markBaseDirty();
                  setBaseJsonText(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setBaseDraft(parsed);
                  } catch {
                    // ignore parse errors
                  }
                }}
              />
            </div>
          ) : (
            <div className="base-grid" style={{ gridTemplateColumns: `${listWidth}px 1fr` }}>
              <div className="base-list">
                <div className="base-list__header">
                  <span>Items</span>
                  <ActionButton variant="default" onClick={() => {
                    addBaseItem();
                    persistAfterStateFlush("add-item");
                  }}>
                    Add
                  </ActionButton>
                </div>
                <div
                  className={cn("table base-list-table", baseData.type === "propertyValues" ? "base-list-table--property-values" : "")}
                  role="table"
                  aria-label="Base items"
                >
                  {baseData.type === "propertyValues"
                    ? propertyValueGroups.map((group) => {
                        const isExpanded = expandedPropertyGroups.has(group.propertyKey);
                        return (
                          <div key={`group-${group.propertyKey}`} className="base-list-table__group">
                            <button
                              type="button"
                              className="table-row base-list-table__group-row"
                              onClick={() =>
                                setExpandedPropertyGroups((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(group.propertyKey)) {
                                    next.delete(group.propertyKey);
                                  } else {
                                    next.add(group.propertyKey);
                                  }
                                  return next;
                                })
                              }
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.propertyLabel}`}
                              aria-expanded={isExpanded}
                            >
                              <span className="base-list-table__group-label">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                <span title={group.propertyLabel}>{group.propertyLabel}</span>
                              </span>
                            </button>
                            {isExpanded
                              ? group.items.map((groupItem) => renderBaseListRow(groupItem.item, groupItem.index, { nested: true }))
                              : null}
                          </div>
                        );
                      })
                    : (baseData.items || []).map((item: any, itemIdx: number) => renderBaseListRow(item, itemIdx))}
                </div>
                <div className="base-list__resizer" onMouseDown={(e) => startResize(e)} />
              </div>
              <div className="base-editor">
                {selectedBaseItem !== null ? (
                  <>
                {baseData.type === "attributeTypes" && (
                  (() => {
                    const currentList = baseData.items;
                    const currentIndex = findBaseItemIndex(currentList, selectedBaseItem);
                    const current = currentIndex >= 0 ? currentList[currentIndex] : null;
                    if (!selectedBase || !current) return <div className="muted">Select an Attribute Type.</div>;
                    const itemKey = current.name || `attributeType_${currentIndex + 1}`;
                    const invalidStyle = (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined);
                    const withMissingOption = (options: { value: string; label: string }[], value?: string) => {
                      if (!value) return options;
                      if (options.some((opt) => opt.value === value)) return options;
                      return [...options, { value, label: `${value} (missing)` }];
                    };
                    const updateField = (field: string, value: any) => {
                      if (currentIndex < 0) return;
                      markBaseDirty();
                      if (field === "name") {
                        setSelectedBaseItem(getBaseItemSelectionKey({ ...current, name: value }, currentIndex));
                      }
                      const updatedList = currentList.map((a: any, idx: number) =>
                        idx === currentIndex ? { ...a, [field]: value } : a,
                      );
                      const updatedContent = { ...(baseDraft || {}), attributeTypes: updatedList };
                      setBaseDraft(updatedContent);
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
                            onChange={(e) => updateField("name", e.target.value)}
                            style={invalidStyle("name")}
                          />
                        </div>
                        <div>
                          <label>Display Name *</label>
                          <input
                            value={current.displayName || ""}
                            onChange={(e) => updateField("displayName", e.target.value)}
                            style={invalidStyle("displayName")}
                          />
                        </div>
                        <div>
                          <label>Default Type *</label>
                          <FormSelect
                            value={current.defaultType || ""}
                            onChange={(val) => {
                              updateField("defaultType", val);
                              persistAfterStateFlush("dropdown-change");
                            }}
                            options={withMissingOption(
                              [{ value: "", label: "Select type" }, ...dataTypes.map((dt) => ({ value: dt, label: dt }))],
                              current.defaultType,
                            )}
                            className={invalidStyle("defaultType") ? "border-destructive" : undefined}
                            placeholder="Select type"
                          />
                        </div>
                        <div>
                          <label>Has Unit</label>
                          <FormSelect
                            value={current.hasUnit || "NoUnit"}
                            onChange={(val) => {
                              updateField("hasUnit", val);
                              persistAfterStateFlush("dropdown-change");
                            }}
                            options={["NoUnit", "Physical", "Currency"].map((opt) => ({ value: opt, label: opt }))}
                            placeholder="Has unit"
                          />
                        </div>
                        <div className="full form-grid form-grid--3">
                          <div>
                            <label>Default Length</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={current.defaultLength ?? ""}
                              onChange={(e) => updateField("defaultLength", e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </div>
                          <div>
                            <label>Default Precision</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={current.defaultPrecision ?? ""}
                              onChange={(e) => updateField("defaultPrecision", e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </div>
                          <div>
                            <label>Default Scale</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={current.defaultScale ?? ""}
                              onChange={(e) => updateField("defaultScale", e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="toggle-field">
                            <div className="toggle-field__label">Can Be in Relation</div>
                            <Checkbox
                              checked={current.canBeInRelation ?? false}
                              onCheckedChange={(checked) => {
                                updateField("canBeInRelation", checked === true);
                                persistAfterStateFlush("dropdown-change");
                              }}
                              aria-label="Can Be in Relation"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="toggle-field">
                            <div className="toggle-field__label">Is Default Property</div>
                            <Checkbox
                              checked={current.isDefaultProperty ?? false}
                              onCheckedChange={(checked) => {
                                updateField("isDefaultProperty", checked === true);
                                persistAfterStateFlush("dropdown-change");
                              }}
                              aria-label="Is Default Property"
                            />
                          </div>
                        </div>
                        <div className="full">
                          <label>Description</label>
                          <Textarea
                            rows={3}
                            value={current.description || ""}
                            onChange={(e) => updateField("description", e.target.value)}
                          />
                        </div>
                        </div>
                      </div>
                    );
                  })()
                )}
                {baseData.type === "dataTypes" && (
                  (() => {
                    const currentList = baseData.items;
                    const currentIndex = findBaseItemIndex(currentList, selectedBaseItem);
                    const current = currentIndex >= 0 ? currentList[currentIndex] : null;
                    if (!selectedBase || !current) return <div className="muted">Select a Data Type.</div>;
                    const itemKey = current.name || `dataType_${currentIndex + 1}`;
                    const invalidStyle = (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined);
                    const updateField = (field: string, value: any) => {
                      if (currentIndex < 0) return;
                      markBaseDirty();
                      if (field === "name") {
                        setSelectedBaseItem(getBaseItemSelectionKey({ ...current, name: value }, currentIndex));
                      }
                      const updatedList = currentList.map((a: any, idx: number) =>
                        idx === currentIndex ? { ...a, [field]: value } : a,
                      );
                      setBaseDraft({ ...(baseDraft || {}), dataTypes: updatedList });
                    };
                    const targetEntries = Object.entries(current.targets || {});
                    const availableTargets = generatorTargets.filter((t) => !targetEntries.some(([k]) => k === t));
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
                            onChange={(e) => updateField("name", e.target.value)}
                            style={invalidStyle("name")}
                          />
                        </div>
                        <div>
                          <label>Display Name</label>
                          <input
                            value={current.displayName || ""}
                            onChange={(e) => updateField("displayName", e.target.value)}
                          />
                        </div>
                        <div className="full">
                          <label>Description</label>
                          <Textarea
                            rows={3}
                            value={current.description || ""}
                            onChange={(e) => updateField("description", e.target.value)}
                          />
                        </div>
                        <div className="full form-grid form-grid--3">
                          <div className="toggle-field">
                            <div className="toggle-field__label">Has Character Length</div>
                            <Checkbox
                              checked={current.hasCharLen ?? false}
                              onCheckedChange={(checked) => {
                                updateField("hasCharLen", checked === true);
                                persistAfterStateFlush("dropdown-change");
                              }}
                              aria-label="Has Character Length"
                            />
                          </div>
                          <div className="toggle-field">
                            <div className="toggle-field__label">Has Precision</div>
                            <Checkbox
                              checked={current.hasPrecision ?? false}
                              onCheckedChange={(checked) => {
                                updateField("hasPrecision", checked === true);
                                persistAfterStateFlush("dropdown-change");
                              }}
                              aria-label="Has Precision"
                            />
                          </div>
                          <div className="toggle-field">
                            <div className="toggle-field__label">Has Scale</div>
                            <Checkbox
                              checked={current.hasScale ?? false}
                              onCheckedChange={(checked) => {
                                updateField("hasScale", checked === true);
                                persistAfterStateFlush("dropdown-change");
                              }}
                              aria-label="Has Scale"
                            />
                          </div>
                        </div>
                        <div className="full">
                          <SectionCard
                            title="Target Mappings"
                            actions={
                              <div className="flex items-center gap-2">
                                {isMissingField(itemKey, "targets") ? <span className="text-sm text-destructive">Required</span> : null}
                                <ActionButton
                                  className="add-btn"
                                  onClick={() => {
                                    const nextKey = availableTargets[0] || "";
                                    updateField("targets", { ...(current.targets || {}), [nextKey]: "" });
                                    persistAfterStateFlush("add-item");
                                  }}
                                  disabled={!availableTargets.length && !!targetEntries.length}
                                >
                                  Add Mapping
                                </ActionButton>
                              </div>
                            }
                          >
                            <div className="table">
                              <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr" }}>
                                <div>Target</div>
                                <div>Data Type</div>
                                <div>Actions</div>
                              </div>
                              {targetEntries.map(([tgt, val], entryIdx) => (
                                <div
                                  className="table-row"
                                  key={`dt-target-${tgt}-${entryIdx}`}
                                  style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr" }}
                                >
                                  <div>
                                    <FormSelect
                                      value={tgt || ""}
                                      onChange={(nextKey) => {
                                        const nextTargets = { ...(current.targets || {}) };
                                        delete nextTargets[tgt];
                                        nextTargets[nextKey] = val;
                                        updateField("targets", nextTargets);
                                        persistAfterStateFlush("dropdown-change");
                                      }}
                                      options={[
                                        { value: "", label: "Select target" },
                                        ...[tgt, ...availableTargets.filter((t) => t !== tgt)].map((opt) => ({ value: opt, label: opt })),
                                      ]}
                                      className={invalidStyle("targets") ? "border-destructive" : undefined}
                                      placeholder="Select target"
                                    />
                                  </div>
                                  <div>
                                    <input
                                      value={`${val || ""}`}
                                      onChange={(e) => {
                                        const nextTargets = { ...(current.targets || {}) };
                                        nextTargets[tgt] = e.target.value;
                                        updateField("targets", nextTargets);
                                      }}
                                      style={invalidStyle(`target:${tgt}`)}
                                    />
                                  </div>
                                  <div className="actions actions--tight">
                                    <IconBtn
                                      title="Remove mapping"
                                      onClick={() => {
                                        const nextTargets = { ...(current.targets || {}) };
                                        delete nextTargets[tgt];
                                        updateField("targets", nextTargets);
                                        persistAfterStateFlush("delete-item");
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </IconBtn>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </SectionCard>
                        </div>
                        </div>
                      </div>
                    );
                  })()
                )}
                {baseData.type === "dataSources" && (
                  <DataSourcesEditor
                    selectedBase={selectedBase}
                    selectedBaseItem={selectedBaseItem}
                    setSelectedBaseItem={setSelectedBaseItem}
                    setBaseDraft={setBaseDraft}
                    baseData={baseData}
                    isMissingField={isMissingField}
                    markBaseDirty={markBaseDirty}
                    onDirtyBase={onDirtyBase}
                    propertyOptions={propertyOptions}
                    dataTypes={dataTypes}
                    dataSourceTypes={dataSourceTypes}
                    dataSourceTypesRelPath={dataSourceTypesRelPath}
                    onPatchBaseEntity={onPatchBaseEntity}
                    onCommit={persistAfterStateFlush}
                  />
                )}
                {baseData.type === "dataSourceTypes" && (
                  <DataSourceTypesEditor
                    selectedBase={selectedBase}
                    selectedBaseItem={selectedBaseItem}
                    setSelectedBaseItem={setSelectedBaseItem}
                    baseDraft={baseDraft}
                    setBaseDraft={setBaseDraft}
                    baseData={baseData}
                    dataTypes={dataTypes}
                    isMissingField={isMissingField}
                    markBaseDirty={markBaseDirty}
                    onDirtyBase={onDirtyBase}
                    dataSourcesRelPath={dataSourcesRelPath}
                    onPatchBaseEntity={onPatchBaseEntity}
                    onCommit={persistAfterStateFlush}
                  />
                )}
                {baseData.type === "dataProducts" && (
                  (() => {
                    const currentList = baseData.items;
                    const currentIndex = findBaseItemIndex(currentList, selectedBaseItem);
                    const current = currentIndex >= 0 ? currentList[currentIndex] : null;
                    if (!selectedBase || !current) return <div className="muted">Select a Data Product.</div>;
                    const itemKey = current.name || `dataProduct_${currentIndex + 1}`;
                    const invalidStyle = (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined);
                    const updateField = (field: string, value: any) => {
                      if (currentIndex < 0) return;
                      markBaseDirty();
                      if (field === "name") {
                        setSelectedBaseItem(getBaseItemSelectionKey({ ...current, name: value }, currentIndex));
                      }
                      const updatedList = currentList.map((a: any, idx: number) =>
                        idx === currentIndex ? { ...a, [field]: value } : a,
                      );
                      setBaseDraft({ ...(baseDraft || {}), dataProducts: updatedList });
                    };
                    const modules = current.dataModules || [];
                    const moduleNames = modules.map((m: any) => m.name || "Unnamed");
                    const activeModuleName =
                      selectedDataModule && moduleNames.includes(selectedDataModule)
                        ? selectedDataModule
                        : moduleNames[0] || null;
                    const activeModule = modules.find((m: any) => (m.name || "Unnamed") === activeModuleName);
                    const moduleInheritedProps = mergeInheritedProps(current.properties || [], [], activeModule?.properties || []);
                    const modulePropertyRows = [
                      ...moduleInheritedProps.map((p: any) => ({ item: p, inherited: true })),
                      ...(activeModule?.properties || []).map((p: any, pIdx: number) => ({ item: p, inherited: false, idx: pIdx })),
                    ];
                    const productProps: { property?: string; value?: string }[] = Array.isArray(current.properties)
                      ? current.properties
                      : [];
                    const productPropertyItems: PropertyChipItem[] = productProps
                      .map((p: any, pIdx: number): PropertyChipItem | null => {
                        const property = `${p?.property ?? ""}`;
                        if (!property.trim()) return null;
                        return {
                          key: `dp-prop-${pIdx}-${property}`,
                          property,
                          value: `${p?.value ?? ""}`,
                          inherited: false,
                          title: "Data product property",
                          removeKey: pIdx,
                        };
                      })
                      .filter((item): item is PropertyChipItem => item !== null);
                    const productUsed = new Set<string>(
                      productProps.map((p: any) => `${p?.property ?? ""}`).filter((v: string) => v.trim().length > 0),
                    );
                    const updateModule = (updater: (mod: any, idx: number) => any) => {
                      const updated = modules.map((m: any, idx: number) =>
                        updater(m, idx),
                      );
                      updateField("dataModules", updated);
                    };
	                    return (
	                      <>
                          <div className="item-header">
                            <div className="item-title-row">
                              <div className="item-title">{current.name || "Unnamed"}</div>
                            </div>
                            <PropertyChips
                              className="chips--sm item-chips"
                              items={productPropertyItems}
                              propertyOptions={propertyOptions}
                              usedPropertyNames={productUsed}
                              onAdd={(property, value) => {
                                updateField("properties", [...productProps, { property, value }]);
                                persistAfterStateFlush("add-item");
                              }}
                              onRemove={(idx) => {
                                const index = typeof idx === "number" ? idx : Number(idx);
                                if (!Number.isFinite(index)) return;
                                updateField("properties", productProps.filter((_p: any, i: number) => i !== index));
                                persistAfterStateFlush("delete-item");
                              }}
                              addLabel="Add property"
                            />
                          </div>
	                        <div className="form-grid">
                          <div>
                            <label>Name *</label>
                            <input
                              value={current.name || ""}
                              onChange={(e) => updateField("name", e.target.value)}
                              style={invalidStyle("name")}
                            />
                          </div>
                          <div>
                            <label>Display Name</label>
                            <input
                              value={current.displayName || ""}
                              onChange={(e) => updateField("displayName", e.target.value)}
                            />
                          </div>
	                        </div>
	                        <div className="full mt-4">
	                          <div className="form-shell form-shell--modules">
	                            <div className="section-header section-header--tight">
	                              <div className="section-title">
	                                Modules{" "}
                                {isMissingField(itemKey, "dataModules") ? <span className="pill pill--warning">Required</span> : null}
                              </div>
                              <ActionButton
                                variant="default"
                                onClick={() => {
                                  const used = new Set(
                                    (modules || []).map((m: any) => `${m?.name ?? ""}`.trim().toLowerCase()).filter(Boolean),
                                  );
                                  let moduleIndex = 1;
                                  while (used.has(`module${moduleIndex}`)) {
                                    moduleIndex += 1;
                                  }
                                  const name = `Module${moduleIndex}`;
                                  const next = [...modules, { name, displayName: name, properties: [] }];
                                  updateField("dataModules", next);
                                  setSelectedDataModule(name);
                                  persistAfterStateFlush("add-item");
                                }}
                              >
                                Add Module
                              </ActionButton>
                            </div>
                            {modules.length === 0 ? (
                              <div className="muted">No modules.</div>
                            ) : (
                              <div className="data-modules-grid">
                                <div className="base-list data-modules-list">
                                  <div className="table base-list-table data-modules-table" role="table" aria-label="Data modules">
                                    {(modules || []).map((m: any, mIdx: number) => {
                                      const name = m.name || "Unnamed";
                                      const active = activeModuleName === name;
                                      const selectionKey = `module:${name}:${mIdx}`;
                                      return (
                                        <div
                                          key={`${name}-${mIdx}`}
                                          className={cn("table-row base-list-table__row", active ? "base-list-table__row--active" : "")}
                                          role="button"
                                          tabIndex={0}
                                          style={{ gridTemplateColumns: "1fr auto" }}
                                          onClick={() => setSelectedDataModule(name)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setSelectedDataModule(name);
                                            }
                                          }}
                                        >
                                          <div className="base-list-table__label" title={name}>{name}</div>
                                          <IconBtn
                                            className="base-list-table__delete"
                                            title={`Delete ${name}`}
                                            aria-label={`Delete ${name}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const previous = [...modules];
                                              const previousSelection = activeModuleName;
                                              const next = modules.filter((_module: any, idx: number) => idx !== mIdx);
                                              updateField("dataModules", next);
                                              if (!next.length) {
                                                setSelectedDataModule(null);
                                              } else if (previousSelection === name) {
                                                const fallbackIndex = Math.min(mIdx, next.length - 1);
                                                const fallbackName = next[fallbackIndex]?.name || "Unnamed";
                                                setSelectedDataModule(fallbackName);
                                              }
                                              persistAfterStateFlush("delete-item");
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </IconBtn>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="source-block data-modules-detail">
                                  {activeModule ? (
                                    <>
                                      {(() => {
                                        const activeModuleIndex = modules.indexOf(activeModule);
                                        const localModuleProps = activeModule?.properties || [];
                                        const localUsed = new Set<string>(
                                          localModuleProps
                                            .map((p: any) => `${p?.property ?? ""}`)
                                            .filter((v: string) => v.trim().length > 0),
                                        );
                                        const modulePropertyItems: PropertyChipItem[] = [];
                                        modulePropertyRows.forEach((row: any, pIdx: number) => {
                                          const property = `${row?.item?.property ?? ""}`;
                                          if (!property.trim()) return;
                                          modulePropertyItems.push({
                                            key: row.inherited ? `dm-inherit-${property}-${pIdx}` : `dm-prop-${row?.idx ?? pIdx}-${property}`,
                                            property,
                                            value: `${row?.item?.value ?? ""}`,
                                            inherited: !!row?.inherited,
                                            title: row.inherited
                                              ? "Inherited from data product (add the same property to override)"
                                              : "Module property",
                                            removeKey: row.inherited ? undefined : (row?.idx ?? pIdx),
                                          });
                                        });
                                        const modulePropertyList: PropertyListRow[] = modulePropertyRows.map((row: any, pIdx: number) => ({
                                          id: row.inherited ? `dm-inherit-${row.item.property}-${pIdx}` : `dm-prop-${row.idx ?? pIdx}`,
                                          property: row.item.property || "",
                                          value: row.item.value || "",
                                          inherited: row.inherited,
                                        }));
                                        return (
                                          <div className="item-header">
                                            <div className="item-title-row">
                                              <div className="item-title">{activeModule.name || "Unnamed"}</div>
                                            </div>
                                            <PropertyChips
                                              className="chips--sm item-chips"
                                              items={modulePropertyItems}
                                              propertyOptions={propertyOptions}
                                              usedPropertyNames={localUsed}
                                              onAdd={(property, value) => {
                                                const nextProps = [...localModuleProps, { property, value }];
                                                updateModule((mod, idx) => (idx === activeModuleIndex ? { ...mod, properties: nextProps } : mod));
                                                persistAfterStateFlush("add-item");
                                              }}
                                              onRemove={(idx) => {
                                                const index = typeof idx === "number" ? idx : Number(idx);
                                                if (!Number.isFinite(index)) return;
                                                const nextProps = localModuleProps.filter((_p: any, i: number) => i !== index);
                                                updateModule((mod, mIdx) => (mIdx === activeModuleIndex ? { ...mod, properties: nextProps } : mod));
                                                persistAfterStateFlush("delete-item");
                                              }}
                                              addLabel="Add property"
                                            />
                                          </div>
                                        );
                                      })()}
                                      <div className="form-grid">
                                        <div>
                                          <label>Name *</label>
                                          <input
                                            value={activeModule.name || ""}
                                            onChange={(e) => {
                                              const newName = e.target.value;
                                              const activeModuleIndex = modules.indexOf(activeModule);
                                              if (activeModuleIndex < 0) return;
                                              updateModule((mod, idx) =>
                                                idx === activeModuleIndex
                                                  ? { ...mod, name: newName }
                                                  : mod,
                                              );
                                              setSelectedDataModule(newName);
                                            }}
                                            style={
                                              isMissingField(`${itemKey}:module_${modules.indexOf(activeModule) + 1}`, "name")
                                                ? { borderColor: "#d92d20" }
                                                : undefined
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label>Display Name</label>
                                          <input
                                            value={activeModule.displayName || ""}
                                            onChange={(e) =>
                                              updateModule((mod, idx) =>
                                                idx === modules.indexOf(activeModule)
                                                  ? { ...mod, displayName: e.target.value }
                                                  : mod,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className="full">
                                          <label>Description</label>
                                          <Textarea
                                            rows={3}
                                            value={activeModule.description || ""}
                                            onChange={(e) =>
                                              updateModule((mod, idx) =>
                                                idx === modules.indexOf(activeModule)
                                                  ? { ...mod, description: e.target.value }
                                                  : mod,
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
	                                    </>
	                                  ) : (
                                    <div className="muted">Select a module to edit.</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()
                )}
                {baseData.type === "zones" && (
                  (() => {
                    const currentList = baseData.items;
                    const currentIndex = findBaseItemIndex(currentList, selectedBaseItem);
                    const current = currentIndex >= 0 ? currentList[currentIndex] : null;
                    if (!selectedBase || !current) return <div className="muted">Select a Zone.</div>;
                    const itemKey = current.name || `zone_${currentIndex + 1}`;
                    const invalidStyle = (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined);
                    const updateField = (field: string, value: any) => {
                      if (currentIndex < 0) return;
                      markBaseDirty();
                      if (field === "name") {
                        setSelectedBaseItem(getBaseItemSelectionKey({ ...current, name: value }, currentIndex));
                      }
                      const updatedList = currentList.map((a: any, idx: number) =>
                        idx === currentIndex ? { ...a, [field]: value } : a,
                      );
                      setBaseDraft({ ...(baseDraft || {}), zones: updatedList });
                    };
                    const zoneProps: { property?: string; value?: string }[] = Array.isArray(current.properties)
                      ? current.properties
                      : [];
                    const zonePropertyItems: PropertyChipItem[] = zoneProps
                      .map((p: any, pIdx: number): PropertyChipItem | null => {
                        const property = `${p?.property ?? ""}`;
                        if (!property.trim()) return null;
                        return {
                          key: `zone-prop-${pIdx}-${property}`,
                          property,
                          value: `${p?.value ?? ""}`,
                          inherited: false,
                          title: "Zone property",
                          removeKey: pIdx,
                        };
                      })
                      .filter((item): item is PropertyChipItem => item !== null);
                    const zoneUsed = new Set<string>(
                      zoneProps.map((p: any) => `${p?.property ?? ""}`).filter((v: string) => v.trim().length > 0),
                    );
                    return (
                      <div>
                        <div className="item-header">
                          <div className="item-title-row">
                            <div className="item-title">{current.name || "Unnamed"}</div>
                          </div>
                          <PropertyChips
                            className="chips--sm item-chips"
                            items={zonePropertyItems}
                            propertyOptions={propertyOptions}
                            usedPropertyNames={zoneUsed}
                            onAdd={(property, value) => {
                              updateField("properties", [...zoneProps, { property, value }]);
                              persistAfterStateFlush("add-item");
                            }}
                            onRemove={(idx) => {
                              const index = typeof idx === "number" ? idx : Number(idx);
                              if (!Number.isFinite(index)) return;
                              updateField("properties", zoneProps.filter((_p: any, i: number) => i !== index));
                              persistAfterStateFlush("delete-item");
                            }}
                            addLabel="Add property"
                          />
                        </div>
                        <div className="form-grid">
                        <div>
                          <label>Name *</label>
                          <input
                            value={current.name || ""}
                            onChange={(e) => updateField("name", e.target.value)}
                            style={invalidStyle("name")}
                          />
                        </div>
                        <div>
                          <label>Display Name *</label>
                          <input
                            value={current.displayName || ""}
                            onChange={(e) => updateField("displayName", e.target.value)}
                            style={invalidStyle("displayName")}
                          />
                        </div>
                        <div className="full">
                          <label>Target Name *</label>
                          <input
                            value={current.targetName || ""}
                            onChange={(e) => updateField("targetName", e.target.value)}
                            style={invalidStyle("targetName")}
                          />
                        </div>
                        <div className="full">
                          <label>Local Folder Name</label>
                          <input
                            value={current.localFolderName || ""}
                            onChange={(e) => updateField("localFolderName", e.target.value)}
                            placeholder="Optional folder segment"
                          />
                        </div>
                        </div>
                      </div>
                    );
                  })()
                )}
                {(baseData.type === "properties" || baseData.type === "propertyValues") && (
                  <PropertyValuesEditor
                    baseData={baseData}
                    selectedBase={selectedBase}
                    selectedBaseItem={selectedBaseItem}
                    setSelectedBaseItem={setSelectedBaseItem}
                    baseDraft={baseDraft}
                    setBaseDraft={setBaseDraft}
                    markBaseDirty={markBaseDirty}
                    isMissingField={isMissingField}
                    propertyOptions={propertyOptions}
                    propertyScopeTypeOptions={propertyScopeTypeOptions}
                    onCommit={persistAfterStateFlush}
                  />
                )}
              </>
            ) : (
              <div className="muted">No items yet. Click Add to create one.</div>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
);
};
