import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  Checkbox,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormSelect,
  Textarea,
  cn,
} from "@datam8/ui";
import { Check, GripVertical, Pencil, Tag, Trash2 } from "lucide-react";
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
  onCommit: (reason: "text-blur" | "dropdown-change" | "add-item" | "delete-item") => void;
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
    onCommit,
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
    const [detailsDraft, setDetailsDraft] = useState<EntityAttribute | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [propertyChipsMounted, setPropertyChipsMounted] = useState(false);
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
      if (pendingFocus && nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.select();
        clearPendingFocus();
      }
    }, [pendingFocus, clearPendingFocus]);

    useEffect(() => {
      if (detailsOpen) {
        setDetailsDraft(attr);
        return;
      }
      setDetailsDraft(null);
    }, [attr, detailsOpen]);

    const handleCommitName = useCallback(() => {
      const err = onCommitRename(index, attr?.name || "", draftName);
      if (err) {
        setNameError(err);
        return;
      }
      setNameError(null);
      onCommit("text-blur");
    }, [attr?.name, draftName, index, onCommit, onCommitRename]);

    const rowKey = attr?.name || "";
    const rawAttrProps = useMemo(
      () => (Array.isArray(attr?.properties) ? attr.properties : []),
      [attr?.properties],
    );
    const hasAttributeProperties = rawAttrProps.length > 0;
    const shouldRenderPropertyChips = hasAttributeProperties || propertyChipsMounted;
    const attrPropertyItems: PropertyChipItem[] = shouldRenderPropertyChips
      ? rawAttrProps
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
          .filter((item: PropertyChipItem | null): item is PropertyChipItem => item !== null)
      : [];
    const attrUsedPropertyNames = useMemo(
      () =>
        new Set<string>(
          shouldRenderPropertyChips
            ? rawAttrProps.map((p) => `${p?.property ?? ""}`).filter((v: string) => v.trim().length > 0)
            : [],
        ),
      [rawAttrProps, shouldRenderPropertyChips],
    );

    const closeDetailsDialog = useCallback(() => {
      if (detailsOpen) {
        onToggleDetails(rowKey);
      }
    }, [detailsOpen, onToggleDetails, rowKey]);

    const patchDetailsDraft = useCallback((updater: (draft: EntityAttribute) => EntityAttribute) => {
      setDetailsDraft((draft) => (draft ? updater(draft) : draft));
    }, []);

    const saveDetailsDialog = useCallback(() => {
      if (!detailsDraft) return;
      onPatch(index, () => detailsDraft);
      onCommit("dropdown-change");
      closeDetailsDialog();
    }, [closeDetailsDialog, detailsDraft, index, onCommit, onPatch]);

    const detailsForm = detailsOpen && detailsDraft
      ? (() => {
          const typeDef = dataTypeDefinitions[detailsDraft?.dataType?.type || ""] || {};
          const draftExpressionLanguageValue = detailsDraft?.expressionLanguage || "";
          const draftExpressionLanguageSelectValue = draftExpressionLanguageValue
            ? expressionLanguageOptions.includes(draftExpressionLanguageValue)
              ? draftExpressionLanguageValue
              : "__custom__"
            : "";
          const showCustomExpressionLanguage = draftExpressionLanguageSelectValue === "__custom__";

          return (
            <div className="form-grid">
              <div>
                <label>Display Name</label>
                <input
                  value={detailsDraft.displayName || ""}
                  onChange={(e) => patchDetailsDraft((draft) => ({ ...draft, displayName: e.target.value }))}
                />
              </div>
              <div>
                <label>Attribute Type</label>
                <FormSelect
                  className="attribute-select"
                  value={detailsDraft.attributeType || ""}
                  onChange={(val) => patchDetailsDraft((draft) => ({ ...draft, attributeType: val }))}
                  options={[{ value: "", label: "Select attribute type" }, ...attributeTypeOptions]}
                  placeholder="Select attribute type"
                />
              </div>
              <div className="attribute-detail-stack">
                <div>
                  <label>Unit</label>
                  <input
                    value={detailsDraft.unit || ""}
                    onChange={(e) => patchDetailsDraft((draft) => ({ ...draft, unit: e.target.value }))}
                  />
                </div>
                <div className="attribute-detail-stack__grow">
                  <label>Description</label>
                  <Textarea
                    rows={2}
                    className="attribute-textarea attribute-textarea--description"
                    value={detailsDraft.description || ""}
                    onChange={(e) => patchDetailsDraft((draft) => ({ ...draft, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="attribute-detail-stack">
                <div className="form-grid form-grid--tight">
                  <div className={showCustomExpressionLanguage ? undefined : "full"}>
                    <label>Expression Language</label>
                    <FormSelect
                      className="attribute-select"
                      value={draftExpressionLanguageSelectValue}
                      onChange={(val) => {
                        if (val === "__custom__") {
                          patchDetailsDraft((draft) => ({
                            ...draft,
                            expressionLanguage:
                              draft.expressionLanguage && !expressionLanguageOptions.includes(draft.expressionLanguage)
                                ? draft.expressionLanguage
                                : "",
                          }));
                          return;
                        }
                        patchDetailsDraft((draft) => ({
                          ...draft,
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
                        value={detailsDraft.expressionLanguage || ""}
                        onChange={(e) =>
                          patchDetailsDraft((draft) => ({
                            ...draft,
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
                      value={detailsDraft.expression || ""}
                      onChange={(e) => patchDetailsDraft((draft) => ({ ...draft, expression: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              {typeDef?.hasCharLen || typeDef?.hasPrecision || typeDef?.hasScale ? (
                <div className="form-grid form-grid--3 full">
                  <div>
                    <label>Length</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={detailsDraft.dataType?.charLen ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : Number(e.target.value);
                        patchDetailsDraft((draft) => ({
                          ...draft,
                          dataType: { ...(draft.dataType || {}), charLen: Number.isFinite(val) ? val : undefined },
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
                      value={detailsDraft.dataType?.precision ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : Number(e.target.value);
                        patchDetailsDraft((draft) => ({
                          ...draft,
                          dataType: { ...(draft.dataType || {}), precision: Number.isFinite(val) ? val : undefined },
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
                      value={detailsDraft.dataType?.scale ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : Number(e.target.value);
                        patchDetailsDraft((draft) => ({
                          ...draft,
                          dataType: { ...(draft.dataType || {}), scale: Number.isFinite(val) ? val : undefined },
                        }));
                      }}
                      disabled={!typeDef?.hasScale}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()
      : null;

    return (
      <div
        className={`value-row ${isSelected ? "value-row--selected" : ""} ${dropClass}`}
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
              data-explicit-autosave="true"
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
              onChange={(val) => {
                onPatch(index, (a) => ({
                  ...a,
                  dataType: { ...(a.dataType || {}), type: val },
                }));
                onCommit("dropdown-change");
              }}
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
                onCommit("dropdown-change");
              }}
            />
          </div>
          <div className="boolean-cell">
            <Checkbox
              checked={attr.isBusinessKey ?? false}
              onCheckedChange={(checked) => {
                const next = checked === true;
                onPatch(index, (a) => ({ ...a, isBusinessKey: next }));
                onCommit("dropdown-change");
              }}
            />
          </div>
          <div>
            <FormSelect
              value={attr.history || ""}
              onChange={(val) => {
                onPatch(index, (a) => ({ ...a, history: val || undefined }));
                onCommit("dropdown-change");
              }}
              options={[{ value: "", label: "None" }, ...historyOptions.map((h) => ({ value: h, label: h }))]}
              placeholder="Select history"
            />
          </div>
          <div>
            {shouldRenderPropertyChips ? (
              <PropertyChips
                className="chips--sm"
                items={attrPropertyItems}
                propertyOptions={propertyOptions}
                usedPropertyNames={attrUsedPropertyNames}
                defaultOpen={propertyChipsMounted && attrPropertyItems.length === 0}
                onOpenChange={(open) => {
                  if (!open && attrPropertyItems.length === 0) {
                    setPropertyChipsMounted(false);
                  }
                }}
                onAdd={(property, value) => {
                  onPatch(index, (a) => ({
                    ...a,
                    properties: [...(a.properties || []), { property, value }],
                  }));
                  onCommit("add-item");
                }}
                onRemove={(idx) => {
                  onPatch(index, (a) => ({
                    ...a,
                    properties: (a.properties || []).filter((_item, ii) => ii !== Number(idx)),
                  }));
                  onCommit("delete-item");
                }}
                addLabel="Add column property"
              />
            ) : (
              <div className="chips chips--sm">
                <button
                  type="button"
                  className="chip chip--add"
                  aria-label="Add column property"
                  title="Add column property"
                  onClick={() => setPropertyChipsMounted(true)}
                >
                  <Tag className="h-4 w-4" />
                </button>
              </div>
            )}
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
              <IconBtn active={detailsOpen} title="Open details" data-no-attribute-select="true" onClick={() => onToggleDetails(rowKey)}>
                <Pencil className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        </div>
        {detailsOpen ? (
          <Dialog open={detailsOpen} onOpenChange={(open) => !open && closeDetailsDialog()}>
            <DialogContent className="entity-linkage-dialog attribute-details-dialog max-w-3xl">
              <DialogHeader>
                <DialogTitle>Attribute Details</DialogTitle>
                <DialogDescription>{attr.name || "Configure additional attribute fields."}</DialogDescription>
              </DialogHeader>
              {detailsForm}
              <DialogFooter>
                <Button variant="secondary" onClick={closeDetailsDialog}>
                  Cancel
                </Button>
                <Button onClick={saveDetailsDialog} disabled={!detailsDraft}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    );
  },
);
