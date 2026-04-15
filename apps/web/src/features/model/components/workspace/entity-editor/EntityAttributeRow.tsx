import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Checkbox, FormSelect, Textarea, cn } from "@datam8/ui";
import { Check, ChevronDown, GripVertical, Trash2 } from "lucide-react";
import type { PropertyOption } from "../../../model-types";
import { IconBtn } from "../common/IconBtn";
import { PropertyChips, type PropertyChipItem } from "../common/PropertyChips";
import type { EntityAttribute } from "./types";

export type AttributeRowProps = {
  attr: EntityAttribute;
  index: number;
  detailsOpen: boolean;
  dropClass: string;
  isSelected: boolean;
  showSelectionUi: boolean;
  attributeColumns: string;
  dataTypeOptions: { value: string; label: string }[];
  attributeTypeOptions: { value: string; label: string }[];
  propertyOptions: PropertyOption[];
  dataTypeDefinitions: Record<string, { hasCharLen?: boolean; hasPrecision?: boolean; hasScale?: boolean }>;
  historyOptions: string[];
  expressionLanguageOptions: string[];
  onPatch: (idx: number, updater: (a: EntityAttribute) => EntityAttribute) => void;
  onToggleDetails: (name: string) => void;
  onRemove: (idx: number, name: string) => void;
  onCommitRename: (idx: number, oldName: string, draft: string) => string | null;
  onDragStart: (idx: number, e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDragOver: (idx: number, e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (idx: number, position: "before" | "after") => void;
  onDragLeave: (idx: number) => void;
  onSelect: (idx: number, event: React.MouseEvent<HTMLElement>) => void;
  rowRef: (idx: number, el: HTMLDivElement | null) => void;
  nameRef: (name: string, el: HTMLInputElement | null) => void;
  pendingFocus: boolean;
  clearPendingFocus: () => void;
};

export const EntityAttributeRow = memo(
  ({
    attr,
    index,
    detailsOpen,
    dropClass,
    isSelected,
    showSelectionUi,
    attributeColumns,
    dataTypeOptions,
    attributeTypeOptions,
    propertyOptions,
    dataTypeDefinitions,
    historyOptions,
    expressionLanguageOptions,
    onPatch,
    onToggleDetails,
    onRemove,
    onCommitRename,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    onDragLeave,
    onSelect,
    rowRef,
    nameRef,
    pendingFocus,
    clearPendingFocus,
  }: AttributeRowProps) => {
    const [draftName, setDraftName] = useState(attr?.name || "");
    const [draftDescription, setDraftDescription] = useState(attr?.description || "");
    const [draftExpression, setDraftExpression] = useState(attr?.expression || "");
    const [nameError, setNameError] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      setDraftName(attr?.name || "");
      setNameError(null);
      nameRef(attr?.name || "", nameInputRef.current);
      return () => {
        nameRef(attr?.name || "", null);
      };
    }, [attr?.name, nameRef]);

    useEffect(() => {
      setDraftDescription(attr?.description || "");
    }, [attr?.description]);

    useEffect(() => {
      setDraftExpression(attr?.expression || "");
    }, [attr?.expression]);

    useEffect(() => {
      if (pendingFocus && nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.select();
        clearPendingFocus();
      }
    }, [pendingFocus, clearPendingFocus]);

    const handleCommitName = useCallback(() => {
      const err = onCommitRename(index, attr?.name || "", draftName);
      if (err) {
        setNameError(err);
        return;
      }
      setNameError(null);
    }, [attr?.name, draftName, index, onCommitRename]);

    const handleCommitDescription = useCallback(() => {
      const nextVal = draftDescription;
      if ((attr?.description || "") === nextVal) return;
      onPatch(index, (a) => ({ ...a, description: nextVal }));
    }, [attr?.description, draftDescription, index, onPatch]);

    const handleCommitExpression = useCallback(() => {
      const nextVal = draftExpression;
      if ((attr?.expression || "") === nextVal) return;
      onPatch(index, (a) => ({ ...a, expression: nextVal }));
    }, [attr?.expression, draftExpression, index, onPatch]);

    const typeDef = dataTypeDefinitions[attr?.dataType?.type || ""] || {};
    const expressionLanguageValue = attr?.expressionLanguage || "";
    const isKnownExpressionLanguage = expressionLanguageOptions.includes(expressionLanguageValue);
    const expressionLanguageSelectValue = expressionLanguageValue
      ? isKnownExpressionLanguage
        ? expressionLanguageValue
        : "__custom__"
      : "";
    const showCustomExpressionLanguage = expressionLanguageSelectValue === "__custom__";
    const rowKey = attr?.name || "";
    const rawAttrProps = useMemo(
      () => (Array.isArray(attr?.properties) ? attr.properties : []),
      [attr?.properties],
    );
    const attrPropertyItems: PropertyChipItem[] = rawAttrProps
      .map((p, pIdx): PropertyChipItem | null => {
        const property = `${p?.property ?? ""}`;
        if (!property.trim()) return null;
        return {
          key: `${rowKey}-prop-${pIdx}-${property}`,
          property,
          value: `${p?.value ?? ""}`,
          inherited: false,
          title: "Column property",
          removeKey: pIdx,
        };
      })
      .filter((item: PropertyChipItem | null): item is PropertyChipItem => item !== null);
    const attrUsedPropertyNames = useMemo(
      () =>
        new Set<string>(
          rawAttrProps.map((p) => `${p?.property ?? ""}`).filter((v: string) => v.trim().length > 0),
        ),
      [rawAttrProps],
    );

    return (
      <div
        className={`value-row ${detailsOpen ? "value-row--active" : ""} ${isSelected ? "value-row--selected" : ""} ${dropClass}`}
        ref={(el) => rowRef(index, el)}
        onDragOver={
          showSelectionUi
            ? undefined
            : (e) => onDragOver(index, e)
        }
        onDrop={
          showSelectionUi
            ? undefined
            : (e) => {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
                onDrop(index, position);
              }
        }
        onDragLeave={showSelectionUi ? undefined : () => onDragLeave(index)}
      >
        <div
          className="table-row"
          style={{ gridTemplateColumns: attributeColumns }}
        >
          <div>
            {showSelectionUi ? (
              <IconBtn
                type="button"
                title={isSelected ? "Deselect attribute" : "Select attribute"}
                onClick={(event) => onSelect(index, event)}
                data-no-attribute-select="true"
                className={`attribute-row__selector ${isSelected ? "attribute-row__selector--selected" : ""}`}
              >
                <Check strokeWidth={3} className={`h-3.5 w-3.5 ${isSelected ? "" : "attribute-row__selector-icon--hidden"}`} />
              </IconBtn>
            ) : (
              <IconBtn
                type="button"
                title="Click to select or drag to reorder"
                draggable
                onClick={(event) => onSelect(index, event)}
                onDragStart={(e) => onDragStart(index, e)}
                onDragEnd={onDragEnd}
                data-no-attribute-select="true"
                className="drag-handle"
              >
                <GripVertical className="h-4 w-4" />
              </IconBtn>
            )}
          </div>
          <div className="cell-wrap">
            <input
              ref={nameInputRef}
              value={draftName}
              className={cn(nameError ? "input--error" : "")}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={handleCommitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCommitName();
                }
              }}
            />
            {nameError ? <div className="field-error">{nameError}</div> : null}
          </div>
          <div>
            <FormSelect
              value={attr.dataType?.type || ""}
              onChange={(val) =>
                onPatch(index, (a) => ({
                  ...a,
                  dataType: { ...(a.dataType || {}), type: val },
                }))
              }
              options={[{ value: "", label: "Select type" }, ...dataTypeOptions]}
              placeholder="Select type"
            />
          </div>
          <div className="boolean-cell">
            <Checkbox
              checked={attr.dataType?.nullable ?? true}
              onCheckedChange={(checked) => {
                const next = checked === true;
                onPatch(index, (a) => ({
                  ...a,
                  dataType: { ...(a.dataType || {}), nullable: next },
                }));
              }}
            />
          </div>
          <div className="boolean-cell">
            <Checkbox
              checked={attr.isBusinessKey ?? false}
              onCheckedChange={(checked) => {
                const next = checked === true;
                onPatch(index, (a) => ({ ...a, isBusinessKey: next }));
              }}
            />
          </div>
          <div>
            <FormSelect
              value={attr.history || ""}
              onChange={(val) => onPatch(index, (a) => ({ ...a, history: val || undefined }))}
              options={[{ value: "", label: "None" }, ...historyOptions.map((h) => ({ value: h, label: h }))]}
              placeholder="Select history"
            />
          </div>
          <div>
            <PropertyChips
              className="chips--sm"
              items={attrPropertyItems}
              propertyOptions={propertyOptions}
              usedPropertyNames={attrUsedPropertyNames}
              onAdd={(property, value) =>
                onPatch(index, (a) => ({
                  ...a,
                  properties: [...(a.properties || []), { property, value }],
                }))
              }
              onRemove={(idx) =>
                onPatch(index, (a) => ({
                  ...a,
                  properties: (a.properties || []).filter((_item, ii) => ii !== Number(idx)),
                }))
              }
              addLabel="Add column property"
            />
          </div>
          <div>
            <div className="actions actions--tight">
              <IconBtn
                title="Remove attribute"
                data-no-attribute-select="true"
                onClick={() => onRemove(index, rowKey)}
              >
                <Trash2 className="h-4 w-4" />
              </IconBtn>
              <IconBtn active={detailsOpen} title="Details" data-no-attribute-select="true" onClick={() => onToggleDetails(rowKey)}>
                <ChevronDown className={`h-4 w-4 chevron-toggle ${detailsOpen ? "chevron-toggle--open" : ""}`} />
              </IconBtn>
            </div>
          </div>
        </div>
        {detailsOpen ? (
          <div className="source-block">
            <div className="form-grid">
              <div>
                <label>Display Name</label>
                <input
                  value={attr.displayName || ""}
                  onChange={(e) => onPatch(index, (a) => ({ ...a, displayName: e.target.value }))}
                />
              </div>
              <div>
                <label>Attribute Type</label>
                <FormSelect
                  className="attribute-select"
                  value={attr.attributeType || ""}
                  onChange={(val) => onPatch(index, (a) => ({ ...a, attributeType: val }))}
                  options={[{ value: "", label: "Select attribute type" }, ...attributeTypeOptions]}
                  placeholder="Select attribute type"
                />
              </div>
              <div className="attribute-detail-stack">
                <div>
                  <label>Unit</label>
                  <input
                    value={attr.unit || ""}
                    onChange={(e) => onPatch(index, (a) => ({ ...a, unit: e.target.value }))}
                  />
                </div>
                <div className="attribute-detail-stack__grow">
                  <label>Description</label>
                  <Textarea
                    rows={2}
                    className="attribute-textarea attribute-textarea--description"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    onBlur={handleCommitDescription}
                  />
                </div>
              </div>
              <div className="attribute-detail-stack">
                <div className="form-grid form-grid--tight">
                  <div className={showCustomExpressionLanguage ? undefined : "full"}>
                    <label>Expression Language</label>
                    <FormSelect
                      className="attribute-select"
                      value={expressionLanguageSelectValue}
                      onChange={(val) => {
                        if (val === "__custom__") {
                          onPatch(index, (a) => ({
                            ...a,
                            expressionLanguage:
                              a.expressionLanguage && !expressionLanguageOptions.includes(a.expressionLanguage)
                                ? a.expressionLanguage
                                : "",
                          }));
                          return;
                        }
                        onPatch(index, (a) => ({
                          ...a,
                          expressionLanguage: val ? val : undefined,
                        }));
                      }}
                      options={[
                        { value: "", label: "None" },
                        ...expressionLanguageOptions.map((lang) => ({ value: lang, label: lang })),
                        { value: "__custom__", label: "Custom" },
                      ]}
                      placeholder="Select language"
                    />
                  </div>
                  {showCustomExpressionLanguage ? (
                    <div>
                      <label>Custom Language</label>
                      <input
                        placeholder="Language name"
                        value={expressionLanguageValue}
                        onChange={(e) =>
                          onPatch(index, (a) => ({
                            ...a,
                            expressionLanguage: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ) : null}
                  <div className="full">
                    <label>Expression</label>
                    <Textarea
                      rows={2}
                      className="attribute-textarea attribute-textarea--expression"
                      value={draftExpression}
                      onChange={(e) => setDraftExpression(e.target.value)}
                      onBlur={handleCommitExpression}
                    />
                  </div>
                </div>
              </div>
            </div>
            {typeDef?.hasCharLen || typeDef?.hasPrecision || typeDef?.hasScale ? (
              <div className="form-grid form-grid--3 mt-3">
                <div>
                  <label>Length</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={attr.dataType?.charLen ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? undefined : Number(e.target.value);
                      onPatch(index, (a) => ({
                        ...a,
                        dataType: { ...(a.dataType || {}), charLen: Number.isFinite(val) ? val : undefined },
                      }));
                    }}
                    disabled={!typeDef?.hasCharLen}
                  />
                </div>
                <div>
                  <label>Precision</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={attr.dataType?.precision ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? undefined : Number(e.target.value);
                      onPatch(index, (a) => ({
                        ...a,
                        dataType: { ...(a.dataType || {}), precision: Number.isFinite(val) ? val : undefined },
                      }));
                    }}
                    disabled={!typeDef?.hasPrecision}
                  />
                </div>
                <div>
                  <label>Scale</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={attr.dataType?.scale ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? undefined : Number(e.target.value);
                      onPatch(index, (a) => ({
                        ...a,
                        dataType: { ...(a.dataType || {}), scale: Number.isFinite(val) ? val : undefined },
                      }));
                    }}
                    disabled={!typeDef?.hasScale}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);
