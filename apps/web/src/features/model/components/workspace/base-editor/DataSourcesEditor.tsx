import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, FormSelect, Input, Textarea } from "@datam8/ui";
import { RefreshCw, Trash2 } from "lucide-react";
import type { BaseEntity, PropertyOption } from "../../../model-types";
import { mergeInheritedDataTypeMappings } from "../../../model-utils";
import { ActionButton } from "../common/ActionButton";
import { IconBtn } from "../common/IconBtn";
import { PropertyChips, type PropertyChipItem } from "../common/PropertyChips";
import { PropertyList, type PropertyListRow } from "../common/PropertyList";
import { SectionCard } from "../common/SectionCard";
import { findBaseItemIndex, getBaseItemSelectionKey } from "../lib/baseItemSelection";
import { RefreshSchemasDialog } from "./RefreshSchemasDialog";
import { useSolution } from "../../../../solution/SolutionContext";
import { ensureLoaded, useConnectorCatalog } from "../../../../../shared/connectors/connectorCatalog";
import { ConnectorUiSchemaForm } from "./ConnectorUiSchemaForm";

const EMPTY_ARRAY: any[] = [];

type DataTypeMappingRow = {
  sourceType: string;
  targetType: string;
  inherited: boolean;
  localIndex?: number;
};

type DataTypeMappingsTableProps = {
  rows: DataTypeMappingRow[];
  dataTypes: string[];
  onChange: (rows: DataTypeMappingRow[]) => void;
  isMissingField: (localIndex: number, field: "sourceType" | "targetType") => boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  hint?: React.ReactNode;
};

const DataTypeMappingsTable = React.memo(
  ({ rows, dataTypes, onChange, isMissingField, collapsed, onCollapsedChange, hint }: DataTypeMappingsTableProps) => {
  const targetTypeOptions = useMemo(
    () => dataTypes.map((dt) => ({ value: dt, label: dt })),
    [dataTypes],
  );
  const withMissingOption = (options: { value: string; label: string }[], value?: string) => {
    if (!value) return options;
    if (options.some((opt) => opt.value === value)) return options;
    return [...options, { value, label: `${value} (missing)` }];
  };

  const handleRowFieldChange = useCallback(
    (rowIndex: number, field: "sourceType" | "targetType", value: string) => {
      const row = rows[rowIndex];
      if (!row || row.inherited) return;
      const next = rows.map((r, i) => (i === rowIndex ? { ...r, [field]: value } : r));
      onChange(next);
    },
    [onChange, rows],
  );

  const handleRemoveRow = useCallback(
    (rowIndex: number) => {
      const row = rows[rowIndex];
      if (!row || row.inherited) return;
      onChange(rows.filter((_r, i) => i !== rowIndex));
    },
    [onChange, rows],
  );

  const handleAddRow = useCallback(() => {
    onChange([...rows, { sourceType: "", targetType: "", inherited: false }]);
    onCollapsedChange(false);
  }, [onChange, onCollapsedChange, rows]);

  const actions = (
    <>
      <ActionButton variant="ghost" onClick={() => onCollapsedChange(!collapsed)}>
        {collapsed ? `Show mappings (${rows.length})` : "Hide mappings"}
      </ActionButton>
      <ActionButton variant="ghost" className="add-btn" onClick={handleAddRow}>
        Add Mapping
      </ActionButton>
    </>
  );

  return (
    <div className="full">
      <SectionCard title="Data Type Mapping" actions={actions}>
        {hint ? <div className="muted small">{hint}</div> : null}
        {!collapsed ? (
          <div className="table">
            <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr" }}>
              <div>Source Type</div>
              <div>Target Type</div>
              <div>Actions</div>
            </div>
            {rows.map((row, rowIndex) => {
              const isInherited = row.inherited;
              const localIndex = row.localIndex ?? -1;
              return (
                <div
                  className="table-row"
                  key={`${isInherited ? "inherited" : "local"}-${row.sourceType || rowIndex}-${localIndex}`}
                  style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr", opacity: isInherited ? 0.7 : 1 }}
                >
                  <div>
                    <Input
                      value={row.sourceType || ""}
                      readOnly={isInherited}
                      disabled={isInherited}
                      onChange={(e) => handleRowFieldChange(rowIndex, "sourceType", e.target.value)}
                      className={!isInherited && localIndex >= 0 && isMissingField(localIndex, "sourceType") ? "border-destructive" : undefined}
                    />
                  </div>
                  <div>
                    {isInherited ? (
                      <Input value={row.targetType || ""} readOnly disabled />
                    ) : (
                      <FormSelect
                        value={row.targetType || ""}
                        onChange={(val) => handleRowFieldChange(rowIndex, "targetType", val)}
                        options={withMissingOption(targetTypeOptions, row.targetType)}
                        placeholder="Select type"
                        className={localIndex >= 0 && isMissingField(localIndex, "targetType") ? "border-destructive" : undefined}
                        allowUnknownValue={false}
                      />
                    )}
                  </div>
                  <div className="actions actions--tight">
                    {!isInherited ? (
                      <IconBtn title="Remove" onClick={() => handleRemoveRow(rowIndex)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
});
DataTypeMappingsTable.displayName = "DataTypeMappingsTable";

type DataSourcesEditorProps = {
  selectedBase: BaseEntity;
  selectedBaseItem: string | null;
  setSelectedBaseItem: React.Dispatch<React.SetStateAction<string | null>>;
  setBaseDraft: React.Dispatch<React.SetStateAction<any | null>>;
  baseData: any;
  isMissingField: (key: string, field: string) => boolean;
  markBaseDirty: () => void;
  onDirtyBase: (relPath: string, dirty: boolean) => void;
  propertyOptions: PropertyOption[];
  dataTypes: string[];
  dataSourceTypes: any[];
  dataSourceTypesRelPath: string | null;
  onPatchBaseEntity: (relPath: string, updater: (content: any) => any) => void;
  onCommit: (reason: "dropdown-change" | "add-item" | "delete-item") => void;
};

export const DataSourcesEditor = React.memo((props: DataSourcesEditorProps) => {
  const {
    selectedBase,
    selectedBaseItem,
    setSelectedBaseItem,
    setBaseDraft,
    baseData,
    isMissingField,
    markBaseDirty,
    onDirtyBase,
    propertyOptions,
    dataTypes,
    dataSourceTypes,
    dataSourceTypesRelPath,
    onPatchBaseEntity,
    onCommit,
  } = props;

  const { solutionPath } = useSolution();
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [mappingsCollapsed, setMappingsCollapsed] = useState(true);
  const [validateConnectionAction, setValidateConnectionAction] = useState<(() => void) | null>(null);
  const registerValidateAction = useCallback((fn: (() => void) | null) => {
    setValidateConnectionAction(() => fn);
  }, []);

  const currentList = useMemo(() => baseData.items || EMPTY_ARRAY, [baseData.items]);
  const currentIndex = useMemo(() => findBaseItemIndex(currentList, selectedBaseItem), [currentList, selectedBaseItem]);
  const current = useMemo(() => (currentIndex >= 0 ? currentList[currentIndex] : null), [currentIndex, currentList]);

  const itemKey = useMemo(() => {
    return current?.name || (currentIndex >= 0 ? `dataSource_${currentIndex + 1}` : "dataSource_1");
  }, [current, currentIndex]);

  const availableTypes = useMemo(
    () => Array.from(new Set((dataSourceTypes || []).map((t: any) => t?.name).filter(Boolean))).sort(),
    [dataSourceTypes],
  );

  const currentTypeName = (current?.type || current?.dataSourceType || "").trim();
  const isKnownType = currentTypeName ? availableTypes.includes(currentTypeName) : false;

  const resolvedType = useMemo(
    () => (currentTypeName ? (dataSourceTypes || []).find((t: any) => t?.name === currentTypeName) || null : null),
    [currentTypeName, dataSourceTypes],
  );

  const typeMappings = resolvedType?.dataTypeMapping || EMPTY_ARRAY;
  const sourceMappings = current?.dataTypeMapping || EMPTY_ARRAY;

  const inheritedMappings = useMemo(
    () => mergeInheritedDataTypeMappings(typeMappings, sourceMappings),
    [sourceMappings, typeMappings],
  );

  const updateField = useCallback(
    (field: string, value: any) => {
      if (currentIndex < 0) return;
      markBaseDirty();
      if (field === "name") {
        setSelectedBaseItem(getBaseItemSelectionKey({ ...current, name: value }, currentIndex));
      }
      setBaseDraft((prev: any) => {
        const draft = { ...(prev || selectedBase.content || {}), dataSources: [...((prev || selectedBase.content || {})?.dataSources || [])] };
        const list = draft.dataSources || [];
        const nextList = list.map((a: any, idx: number) => (idx === currentIndex ? { ...a, [field]: value } : a));
        return { ...(draft || {}), dataSources: nextList };
      });
    },
    [current, currentIndex, markBaseDirty, selectedBase.content, setBaseDraft, setSelectedBaseItem],
  );

  const handleTypeChange = useCallback(
    (nextTypeName: string) => {
      if (currentIndex < 0) return;
      if (nextTypeName === currentTypeName) return;
      markBaseDirty();

      setBaseDraft((prev: any) => {
        const draft = {
          ...(prev || selectedBase.content || {}),
          dataSources: [...((prev || selectedBase.content || {})?.dataSources || [])],
        };
        const list = draft.dataSources || [];
        const nextList = list.map((a: any, idx: number) =>
          idx === currentIndex
            ? {
                ...a,
                type: nextTypeName,
                extendedProperties: {},
              }
            : a,
        );
        return { ...(draft || {}), dataSources: nextList };
      });
    },
    [
      currentTypeName,
      currentIndex,
      markBaseDirty,
      selectedBase.content,
      setBaseDraft,
    ],
  );

  const mappingRows = useMemo<DataTypeMappingRow[]>(
    () => [
      ...inheritedMappings.map((m: any) => ({ sourceType: m?.sourceType || "", targetType: m?.targetType || "", inherited: true })),
      ...sourceMappings.map((m: any, idx: number) => ({
        sourceType: m?.sourceType || "",
        targetType: m?.targetType || "",
        inherited: false,
        localIndex: idx,
      })),
    ],
    [inheritedMappings, sourceMappings],
  );

  const handleMappingsChange = useCallback(
    (rows: DataTypeMappingRow[]) => {
      const locals = rows
        .filter((r) => !r.inherited)
        .map((r) => ({
          sourceType: r.sourceType || "",
          targetType: r.targetType || "",
        }));
      updateField("dataTypeMapping", locals);
    },
    [updateField],
  );

  const isMissingMappingField = useCallback(
    (localIndex: number, field: "sourceType" | "targetType") => isMissingField(`${itemKey}:mapping_${localIndex + 1}`, field),
    [isMissingField, itemKey],
  );

  const boundConnectorId = `${resolvedType?.pluginId || ""}`.trim();

  const catalog = useConnectorCatalog((s) => s);
  const installedConnector = useMemo(
    () => catalog.connectors.find((c) => c.id === boundConnectorId) || null,
    [boundConnectorId, catalog.connectors],
  );
  const canRenderUiSchema = installedConnector?.capabilities?.uiSchema === true;
  const canValidateConnection = installedConnector?.capabilities?.validateConnection === true;
  const canRefreshMetadata = installedConnector?.capabilities?.metadata?.getTableMetadata === true;
  const connectionSectionTitle = installedConnector
    ? `${installedConnector.displayName || installedConnector.id} connection`
    : "Connection";
  const showNoConnectorSubtitle = !!resolvedType && (!boundConnectorId || !installedConnector);
  const connectionSectionSubtitle = installedConnector?.version
    ? `Schema v${installedConnector.version}`
    : showNoConnectorSubtitle
      ? "No connector is installed. You can still edit connection values."
      : undefined;

  const connectionConfig = useMemo<Record<string, any>>(
    () => (current?.extendedProperties && typeof current.extendedProperties === "object" ? current.extendedProperties : {}),
    [current?.extendedProperties],
  );
  const connectionRows = useMemo<PropertyListRow[]>(
    () =>
      Object.entries(connectionConfig || {}).map(([k, v]) => ({
        property: String(k ?? ""),
        value: String(v ?? ""),
      })),
    [connectionConfig],
  );
  const setConnectionRows = useCallback(
    (rows: PropertyListRow[]) => {
      const next: Record<string, string> = {};
      for (const row of rows || []) {
        const key = `${row?.property || ""}`.trim();
        if (!key) continue;
        next[key] = `${row?.value || ""}`;
      }
      updateField("extendedProperties", next);
      onCommit("add-item");
    },
    [onCommit, updateField],
  );

  useEffect(() => {
    setMappingsCollapsed(true);
  }, [selectedBaseItem]);

  useEffect(() => {
    if (!boundConnectorId) return;
    void ensureLoaded();
  }, [boundConnectorId]);

  if (!current) return <div className="muted">Select a Data Source.</div>;

  const invalidStyle = (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined);

  const typeIsValid = !!currentTypeName && isKnownType;
  const typeSelectValue = typeIsValid ? currentTypeName : "";
  const typeInvalid = isMissingField(itemKey, "type") || (!!currentTypeName && !isKnownType);
  const mappingHint =
    resolvedType && inheritedMappings.length
      ? `Inheriting ${inheritedMappings.length} mapping(s) from type ${resolvedType.name}.`
      : !resolvedType && currentTypeName
        ? "No inherited mappings: type not found."
        : null;

  return (
    <div>
      <div className="item-header">
        <div className="item-title-row">
          <div className="item-title">{current.name || "Unnamed"}</div>
        </div>
        <PropertyChips
          className="chips--sm item-chips"
          items={(current.properties || []).map((p: any, pIdx: number): PropertyChipItem => ({
            key: `ds-prop-${pIdx}-${p?.property ?? ""}`,
            property: `${p?.property ?? ""}`,
            value: `${p?.value ?? ""}`,
            inherited: false,
            title: "Data source property",
            removeKey: pIdx,
          }))}
          propertyOptions={propertyOptions}
          usedPropertyNames={new Set<string>(
            (current.properties || []).map((p: any) => `${p?.property ?? ""}`).filter((v: string) => v.trim().length > 0),
          )}
          onAdd={(property, value) => {
            updateField("properties", [...(current.properties || []), { property, value }]);
            onCommit("add-item");
          }}
          onRemove={(idx) => {
            updateField("properties", (current.properties || []).filter((_p: any, i: number) => i !== Number(idx)));
            onCommit("delete-item");
          }}
          addLabel="Add property"
        />
      </div>
      <div className="form-grid">
      <div>
        <label>Name *</label>
        <input value={current.name || ""} onChange={(e) => updateField("name", e.target.value)} style={invalidStyle("name")} />
      </div>
      <div>
        <label>Display Name</label>
        <input value={current.displayName || ""} onChange={(e) => updateField("displayName", e.target.value)} />
      </div>
      <div>
        <label>Type *</label>
        <FormSelect
          value={typeSelectValue}
          onChange={(val) => {
            handleTypeChange(val);
            onCommit("dropdown-change");
          }}
          options={availableTypes.map((t) => ({ value: t, label: t }))}
          placeholder={availableTypes.length ? "Select type" : "Create a Data Source Type first"}
          disabled={!availableTypes.length}
          allowUnknownValue={false}
          className={typeInvalid || !typeIsValid ? "border-destructive" : undefined}
        />
        {!availableTypes.length ? <div className="muted small">Create a Data Source Type first.</div> : null}
        {currentTypeName && !isKnownType ? (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              Invalid type
            </Badge>
            <span className="muted small">{currentTypeName}</span>
          </div>
        ) : null}
      </div>
      <div className="full">
        <label>Description</label>
        <Textarea rows={3} value={current.description || ""} onChange={(e) => updateField("description", e.target.value)} />
      </div>

      <div className="full">
        <SectionCard
          title={connectionSectionTitle}
          subtitle={connectionSectionSubtitle}
          actions={
            installedConnector ? (
              <>
                {canRefreshMetadata ? (
                  <ActionButton
                    variant="secondary"
                    onClick={() => setShowRefreshDialog(true)}
                    disabled={!current?.name}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh schema
                  </ActionButton>
                ) : null}
                {canValidateConnection ? (
                  <ActionButton variant="secondary" onClick={() => validateConnectionAction?.()} disabled={!validateConnectionAction}>
                    Validate connection
                  </ActionButton>
                ) : null}
              </>
            ) : null
          }
        >
          {!resolvedType ? (
            <div className="muted">Select a valid Data Source Type.</div>
          ) : !boundConnectorId ? (
            <div>
              <div>
                <PropertyList
                  title="Connection values"
                  properties={connectionRows}
                  onChange={setConnectionRows}
                  onAdd={() => setConnectionRows([...(connectionRows || []), { property: "", value: "" }])}
                  renderPropertyInput={({ row, setProperty }) => (
                    <Input value={row.property || ""} onChange={(e) => setProperty(e.target.value)} placeholder="Key" />
                  )}
                  renderValueInput={({ row, onChange }) => (
                    <Input value={row.value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Value" />
                  )}
                  emptyLabel="No connection values yet."
                />
              </div>
            </div>
          ) : !installedConnector ? (
            <div>
              <div>
                <PropertyList
                  title="Connection values"
                  properties={connectionRows}
                  onChange={setConnectionRows}
                  onAdd={() => setConnectionRows([...(connectionRows || []), { property: "", value: "" }])}
                  renderPropertyInput={({ row, setProperty }) => (
                    <Input value={row.property || ""} onChange={(e) => setProperty(e.target.value)} placeholder="Key" />
                  )}
                  renderValueInput={({ row, onChange }) => (
                    <Input value={row.value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Value" />
                  )}
                  emptyLabel="No connection values yet."
                />
              </div>
            </div>
          ) : canRenderUiSchema ? (
            <div>
              <ConnectorUiSchemaForm
                connectorId={installedConnector.id}
                solutionPath={solutionPath || ""}
                dataSourceName={current.name || ""}
                onRegisterValidate={registerValidateAction}
                showSchemaTitle={false}
                showSchemaVersion={false}
                value={connectionConfig}
                onChange={(next) => {
                  updateField("extendedProperties", next);
                  onCommit("dropdown-change");
                }}
              />
            </div>
          ) : (
            <div>
              <PropertyList
                title="Connection values"
                properties={connectionRows}
                onChange={setConnectionRows}
                onAdd={() => setConnectionRows([...(connectionRows || []), { property: "", value: "" }])}
                renderPropertyInput={({ row, setProperty }) => (
                  <Input value={row.property || ""} onChange={(e) => setProperty(e.target.value)} placeholder="Key" />
                )}
                renderValueInput={({ row, onChange }) => (
                  <Input value={row.value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Value" />
                )}
                emptyLabel="No connection values yet."
              />
            </div>
          )}
        </SectionCard>
      </div>

      <DataTypeMappingsTable
        rows={mappingRows}
        dataTypes={dataTypes}
        onChange={(rows) => {
          handleMappingsChange(rows);
          onCommit("dropdown-change");
        }}
        isMissingField={isMissingMappingField}
        collapsed={mappingsCollapsed}
        onCollapsedChange={setMappingsCollapsed}
        hint={mappingHint ? <span>{mappingHint}</span> : null}
      />

      {showRefreshDialog ? (
        <RefreshSchemasDialog
          scope={{ kind: "dataSource", dataSourceName: current.name }}
          dataSourceName={current.name}
          dataSource={current}
          dataSourceType={resolvedType}
          isOpen={showRefreshDialog}
          onClose={() => setShowRefreshDialog(false)}
        />
      ) : null}
      </div>
    </div>
  );
});
DataSourcesEditor.displayName = "DataSourcesEditor";
