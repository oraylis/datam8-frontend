import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, FormSelect, Input, Textarea } from "@datam8/ui";
import { Trash2 } from "lucide-react";
import type { BaseEntity } from "../../../model-types";
import { ActionButton } from "../common/ActionButton";
import { IconBtn } from "../common/IconBtn";
import { SectionCard } from "../common/SectionCard";
import { findBaseItemIndex, getBaseItemSelectionKey } from "../lib/baseItemSelection";
import { ConnectorPickerDialog } from "../../../../../shared/connectors/ConnectorPickerDialog";
import { refresh, useConnectorCatalog, type ConnectorSummary } from "../../../../../shared/connectors/connectorCatalog";
import { apiBase } from "../../../../../config";
import { readBackendErrorMessage } from "../../../../../shared/api/errorMessage";
import { useErrorSurface } from "../../../../../shared/ui/ErrorSurface";
import { pruneConnectionPropertiesForConnector } from "./dataSourceConnectionProperties";

const DEFAULT_CONNECTOR_TYPE_MAPPING = [{ sourceType: "string", targetType: "string" }];
const EMPTY_ARRAY: any[] = [];

type DataSourceTypesEditorProps = {
  selectedBase: BaseEntity;
  selectedBaseItem: string | null;
  setSelectedBaseItem: React.Dispatch<React.SetStateAction<string | null>>;
  baseDraft: any | null;
  setBaseDraft: React.Dispatch<React.SetStateAction<any | null>>;
  baseData: any;
  dataTypes: string[];
  isMissingField: (key: string, field: string) => boolean;
  markBaseDirty: () => void;
  onDirtyBase: (relPath: string, dirty: boolean) => void;
  dataSourcesRelPath: string | null;
  onPatchBaseEntity: (relPath: string, updater: (content: any) => any) => void;
};

export const DataSourceTypesEditor = React.memo((props: DataSourceTypesEditorProps) => {
  const {
    selectedBase,
    selectedBaseItem,
    setSelectedBaseItem,
    baseDraft,
    setBaseDraft,
    baseData,
    dataTypes,
    isMissingField,
    markBaseDirty,
    onDirtyBase,
    dataSourcesRelPath,
    onPatchBaseEntity,
  } = props;

  const currentList = useMemo(() => baseData.items || EMPTY_ARRAY, [baseData.items]);
  const currentIndex = useMemo(() => findBaseItemIndex(currentList, selectedBaseItem), [currentList, selectedBaseItem]);
  const current = useMemo(() => (currentIndex >= 0 ? currentList[currentIndex] : null), [currentIndex, currentList]);
  const itemKey = current?.name || `dataSourceType_${currentIndex + 1}`;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mappingsCollapsed, setMappingsCollapsed] = useState(true);
  const { showError } = useErrorSurface();
  const connectors = useConnectorCatalog((s) => s.connectors);
  const boundConnectorId = `${current?.pluginId || ""}`.trim();
  const installedConnector = useMemo(
    () => connectors.find((c) => c.id === boundConnectorId) || null,
    [boundConnectorId, connectors],
  );

  useEffect(() => {
    setMappingsCollapsed(true);
  }, [selectedBaseItem]);

  useEffect(() => {
    void refresh();
  }, [selectedBaseItem]);

  const invalidStyle = useCallback(
    (field: string) => (isMissingField(itemKey, field) ? { borderColor: "#d92d20" } : undefined),
    [isMissingField, itemKey],
  );

  const updateField = useCallback(
    (field: string, value: any) => {
      if (currentIndex < 0) return;
      markBaseDirty();
      if (field === "name") {
        setSelectedBaseItem(getBaseItemSelectionKey({ ...current, name: value }, currentIndex));
      }
      const updatedList = currentList.map((a: any, idx: number) => (idx === currentIndex ? { ...a, [field]: value } : a));
      setBaseDraft({ ...(baseDraft || {}), dataSourceTypes: updatedList });
    },
    [baseDraft, current, currentIndex, currentList, markBaseDirty, setBaseDraft, setSelectedBaseItem],
  );

  const targetTypeOptions = useMemo(() => dataTypes.map((dt) => ({ value: dt, label: dt })), [dataTypes]);
  const withMissingOption = (options: { value: string; label: string }[], value?: string) => {
    if (!value) return options;
    if (options.some((opt) => opt.value === value)) return options;
    return [...options, { value, label: `${value} (missing)` }];
  };

  const applyConnectorSelection = useCallback(
    async (connector: ConnectorSummary) => {
      if (!current) return;
      const pluginId = `${connector.id || ""}`.trim();
      if (!pluginId) return;
      const [connectionProperties, dataTypeMapping, authModes] = await Promise.all([
        (async () => {
          const res = await fetch(`${apiBase}/plugins/${encodeURIComponent(pluginId)}/connection-properties`);
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(readBackendErrorMessage(payload, `Failed to load connection properties (${res.status})`));
          }
          return Array.isArray((payload as any)?.items)
            ? (payload as any).items.filter((item: any) => item && typeof item === "object")
            : [];
        })(),
        (async () => {
          const res = await fetch(`${apiBase}/plugins/${encodeURIComponent(pluginId)}/data-type-mappings`);
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(readBackendErrorMessage(payload, `Failed to load data type mappings (${res.status})`));
          }
          const items = Array.isArray((payload as any)?.items) ? (payload as any).items : [];
          return items
            .map((item: any) => ({
              sourceType: `${item?.sourceType || ""}`.trim(),
              targetType: `${item?.targetType || ""}`.trim(),
            }))
            .filter((item: any) => item.sourceType && item.targetType);
        })(),
        (async () => {
          const res = await fetch(`${apiBase}/plugins/${encodeURIComponent(pluginId)}/ui-schema`);
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(readBackendErrorMessage(payload, `Failed to load ui schema (${res.status})`));
          }
          const schema = (payload as any)?.item || payload;
          const modes = Array.isArray(schema?.authModes) ? schema.authModes : [];
          return modes
            .filter((mode: any) => mode && typeof mode === "object")
            .map((mode: any) => {
              const fields = Array.isArray(mode.fields) ? mode.fields : [];
              const required = fields
                .filter((field: any) => !!field?.required)
                .map((field: any) => `${field?.key || ""}`.trim())
                .filter(Boolean);
              const optional = fields
                .filter((field: any) => !field?.required)
                .map((field: any) => `${field?.key || ""}`.trim())
                .filter(Boolean);
              return {
                name: `${mode?.id || ""}`.trim(),
                displayName: `${mode?.label || mode?.id || ""}`.trim(),
                required,
                optional,
              };
            })
            .filter((mode: any) => mode.name);
        })(),
      ]);
      const nextDataTypeMapping = dataTypeMapping.length ? dataTypeMapping : DEFAULT_CONNECTOR_TYPE_MAPPING;
      updateField("pluginId", pluginId);
      updateField("connectionProperties", connectionProperties);
      updateField("authModes", authModes);
      updateField("dataTypeMapping", nextDataTypeMapping);

      onPatchBaseEntity(selectedBase.relPath, (content) => {
        const types = Array.isArray(content?.dataSourceTypes) ? content.dataSourceTypes : [];
        let nextTypes = types;
        if (currentIndex >= 0 && currentIndex < types.length) {
          nextTypes = types.map((t: any, idx: number) =>
            idx === currentIndex
              ? { ...t, pluginId, connectionProperties, authModes, dataTypeMapping: nextDataTypeMapping }
              : t,
          );
        } else if (current.name) {
          nextTypes = types.map((t: any) =>
            t?.name === current.name
              ? { ...t, pluginId, connectionProperties, authModes, dataTypeMapping: nextDataTypeMapping }
              : t,
          );
        }
        return { ...(content || {}), dataSourceTypes: nextTypes };
      });
      if (dataSourcesRelPath) {
        onPatchBaseEntity(dataSourcesRelPath, (content) => {
          const dataSources = Array.isArray(content?.dataSources) ? content.dataSources : [];
          const nextDataSources = dataSources.map((ds: any) => {
            const sourceTypeName = `${ds?.type || ds?.dataSourceType || ""}`.trim();
            if (!sourceTypeName || sourceTypeName !== current.name) return ds;
            return {
              ...ds,
              extendedProperties: pruneConnectionPropertiesForConnector(ds?.extendedProperties, connectionProperties),
            };
          });
          return { ...(content || {}), dataSources: nextDataSources };
        });
      }
    },
    [current, currentIndex, dataSourcesRelPath, onPatchBaseEntity, selectedBase.relPath, updateField],
  );

  if (!current) return <div className="muted">Select a Data Source Type.</div>;

  return (
    <div>
      <div className="item-header">
        <div className="item-title-row">
          <div className="flex items-center gap-2">
            <div className="item-title">{current.name || "Unnamed"}</div>
            {boundConnectorId ? (
              installedConnector ? (
                <Badge variant="outline">{installedConnector.displayName || installedConnector.id}</Badge>
              ) : (
                <Badge variant="destructive">Connector missing</Badge>
              )
            ) : (
              <Badge variant="outline">No connector</Badge>
            )}
          </div>
          <ActionButton onClick={() => setPickerOpen(true)} disabled={!current.name}>
            Link Connector
          </ActionButton>
        </div>
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
      <div className="full">
        <label>Description</label>
        <Textarea rows={3} value={current.description || ""} onChange={(e) => updateField("description", e.target.value)} />
      </div>

      <ConnectorPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedConnectorId={boundConnectorId}
        onSelect={(connector) => {
          void applyConnectorSelection(connector)
            .then(() => setPickerOpen(false))
            .catch((err: any) => {
              showError("app", {
                title: "Failed to link connector",
                description: err?.message || "Connector metadata could not be loaded.",
              });
            });
        }}
      />

      <div className="full">
        <SectionCard
          title="Data Type Mapping"
          actions={
            <div className="flex items-center gap-2">
              {isMissingField(itemKey, "dataTypeMapping") ? <Badge variant="destructive">Required</Badge> : null}
              <ActionButton variant="ghost" onClick={() => setMappingsCollapsed((v) => !v)}>
                {mappingsCollapsed ? `Show mappings (${(current.dataTypeMapping || []).length})` : "Hide mappings"}
              </ActionButton>
              <ActionButton
                variant="ghost"
                className="add-btn"
                onClick={() => {
                  updateField("dataTypeMapping", [...(current.dataTypeMapping || []), { sourceType: "", targetType: "" }]);
                  setMappingsCollapsed(false);
                }}
              >
                Add Mapping
              </ActionButton>
            </div>
          }
        >
          {!mappingsCollapsed ? (
            <div className="table">
              <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr" }}>
                <div>Source Type</div>
                <div>Target Type</div>
                <div>Actions</div>
              </div>
              {(current.dataTypeMapping || []).map((m: any, mIdx: number) => (
                <div className="table-row" key={`dst-m-${mIdx}`} style={{ gridTemplateColumns: "1.4fr 1.4fr 0.6fr" }}>
                  <div>
                    <Input
                      value={m.sourceType || ""}
                      onChange={(e) =>
                        updateField(
                          "dataTypeMapping",
                          (current.dataTypeMapping || []).map((item: any, ii: number) =>
                            ii === mIdx ? { ...item, sourceType: e.target.value } : item,
                          ),
                        )
                      }
                      style={isMissingField(`${itemKey}:mapping_${mIdx + 1}`, "sourceType") ? { borderColor: "#d92d20" } : undefined}
                    />
                  </div>
                  <div>
                    <FormSelect
                      value={m.targetType || ""}
                      onChange={(val) =>
                        updateField(
                          "dataTypeMapping",
                          (current.dataTypeMapping || []).map((item: any, ii: number) =>
                            ii === mIdx ? { ...item, targetType: val } : item,
                          ),
                        )
                      }
                      options={withMissingOption(targetTypeOptions, m.targetType)}
                      placeholder={dataTypes.length ? "Select type" : "Create Data Types first"}
                      allowUnknownValue={false}
                      disabled={!dataTypes.length}
                      className={isMissingField(`${itemKey}:mapping_${mIdx + 1}`, "targetType") ? "border-destructive" : undefined}
                    />
                  </div>
                  <div className="actions actions--tight">
                    <IconBtn
                      title="Remove"
                      onClick={() =>
                        updateField("dataTypeMapping", (current.dataTypeMapping || []).filter((_item: any, ii: number) => ii !== mIdx))
                      }
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
});
DataSourceTypesEditor.displayName = "DataSourceTypesEditor";
