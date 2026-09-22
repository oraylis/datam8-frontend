import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormSelect, Input } from "@datam8/ui";
import { Plus, Trash2 } from "lucide-react";
import {
  BULK_ATTRIBUTE_EDIT_FIELD_LABELS,
  getDuplicateBulkAttributeEditFields,
  isBulkAttributeEditBooleanField,
  type BulkAttributeEditField,
  type BulkAttributeEditRule,
} from "./bulkAttributeEdit";
import type { EntityAttribute } from "./types";
import type { PropertyOption } from "../../../model-types";

const BULK_ATTRIBUTE_EDIT_FIELDS: BulkAttributeEditField[] = [
  "dataType",
  "nullable",
  "isBusinessKey",
  "history",
  "attributeType",
  "expressionLanguage",
  "unit",
  "property",
];

type BulkAttributeEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAttributes: EntityAttribute[];
  dataTypeOptions: { value: string; label: string }[];
  attributeTypeOptions: { value: string; label: string }[];
  historyOptions: string[];
  expressionLanguageOptions: string[];
  propertyOptions: PropertyOption[];
  onApply: (rules: BulkAttributeEditRule[]) => void;
};

const makeRuleId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `bulk-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const makeDefaultRule = (usedFields: Set<BulkAttributeEditField>): BulkAttributeEditRule => ({
  id: makeRuleId(),
  field: BULK_ATTRIBUTE_EDIT_FIELDS.find((field) => !usedFields.has(field)) ?? "dataType",
  value: "",
});

const booleanOptions = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
];

const ruleNeedsValue = (rule: BulkAttributeEditRule) =>
  isBulkAttributeEditBooleanField(rule.field) && typeof rule.value !== "boolean";

const ruleNeedsPropertyName = (rule: BulkAttributeEditRule) => rule.field === "property" && `${rule.propertyName ?? ""}`.trim().length === 0;

export function BulkAttributeEditDialog({
  open,
  onOpenChange,
  selectedAttributes,
  dataTypeOptions,
  attributeTypeOptions,
  historyOptions,
  expressionLanguageOptions,
  propertyOptions,
  onApply,
}: BulkAttributeEditDialogProps) {
  const [rules, setRules] = useState<BulkAttributeEditRule[]>(() => [makeDefaultRule(new Set())]);

  useEffect(() => {
    if (!open) return;
    setRules([makeDefaultRule(new Set())]);
  }, [open]);

  const duplicateFields = useMemo(() => getDuplicateBulkAttributeEditFields(rules), [rules]);
  const hasIncompleteRule = rules.some((rule) => ruleNeedsValue(rule));
  const hasIncompletePropertyRule = rules.some((rule) => ruleNeedsPropertyName(rule));
  const canApply = selectedAttributes.length > 0 && rules.length > 0 && duplicateFields.size === 0 && !hasIncompleteRule && !hasIncompletePropertyRule;

  const fieldOptions = useMemo(
    () =>
      BULK_ATTRIBUTE_EDIT_FIELDS.map((field) => ({
        value: field,
        label: BULK_ATTRIBUTE_EDIT_FIELD_LABELS[field],
      })),
    [],
  );

  const selectedAttributeNames = useMemo(
    () =>
      selectedAttributes
        .map((attribute) => `${attribute.name ?? ""}`.trim())
        .filter((name) => name.length > 0),
    [selectedAttributes],
  );

  const updateRule = (ruleId: string, updater: (rule: BulkAttributeEditRule) => BulkAttributeEditRule) => {
    setRules((prev) => prev.map((rule) => (rule.id === ruleId ? updater(rule) : rule)));
  };

  const removeRule = (ruleId: string) => {
    setRules((prev) => (prev.length <= 1 ? prev : prev.filter((rule) => rule.id !== ruleId)));
  };

  const addRule = () => {
    setRules((prev) => [...prev, makeDefaultRule(new Set(prev.map((rule) => rule.field)))]);
  };

  const handleApply = () => {
    if (!canApply) return;
    onApply(rules);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bulk-attribute-edit-dialog max-h-[88vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Bulk Edit Attributes</DialogTitle>
          <DialogDescription>
            Apply one or more field changes to the currently selected attributes.
          </DialogDescription>
        </DialogHeader>

        <div className="bulk-attribute-edit-dialog__summary">
          <div className="bulk-attribute-edit-dialog__summary-chips">
            {selectedAttributeNames.slice(0, 8).map((name) => (
              <Badge key={name} variant="outline" className="bulk-attribute-edit-dialog__summary-chip">
                {name}
              </Badge>
            ))}
            {selectedAttributeNames.length > 8 ? (
              <Badge variant="outline" className="bulk-attribute-edit-dialog__summary-chip">
                {`+${selectedAttributeNames.length - 8} more`}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="bulk-attribute-edit-dialog__rules">
          <div className="bulk-attribute-edit-dialog__rules-head">
            <div>Field</div>
            <div>Value</div>
            <div></div>
          </div>
          {rules.map((rule) => {
            const duplicateKey = rule.field === "property" ? `${rule.field}:${(rule.propertyName || "").trim()}` : rule.field;
            const isDuplicate = duplicateFields.has(duplicateKey);
            const fieldIsBoolean = isBulkAttributeEditBooleanField(rule.field);
            const propertyOption = propertyOptions.find((option) => option.name === rule.propertyName) || null;
            const selectOptions =
              rule.field === "dataType"
                ? [{ value: "", label: "Clear value" }, ...dataTypeOptions]
                : rule.field === "attributeType"
                  ? [{ value: "", label: "Clear value" }, ...attributeTypeOptions]
                  : rule.field === "history"
                    ? [{ value: "", label: "Clear value" }, ...historyOptions.map((value) => ({ value, label: value }))]
                    : rule.field === "expressionLanguage"
                      ? [{ value: "", label: "Clear value" }, ...expressionLanguageOptions.map((value) => ({ value, label: value }))]
                      : [];
            const propertyNameOptions = propertyOptions
              .map((option) => ({ value: option.name, label: option.name }))
              .sort((left, right) => left.label.localeCompare(right.label));
            const propertyValueOptions = (propertyOption?.values || []).map((value) => ({ value, label: value }));

            return (
              <div key={rule.id} className={`bulk-attribute-edit-dialog__rule ${isDuplicate ? "bulk-attribute-edit-dialog__rule--error" : ""}`}>
                <FormSelect
                  value={rule.field}
                  onChange={(value) =>
                    updateRule(rule.id, () => ({
                      id: rule.id,
                      field: value as BulkAttributeEditField,
                      propertyName: value === "property" ? "" : undefined,
                      value: value === "nullable" || value === "isBusinessKey" ? undefined : "",
                    }))
                  }
                  options={fieldOptions}
                  placeholder="Select field"
                />
                <div className="bulk-attribute-edit-dialog__rule-value">
                  {fieldIsBoolean ? (
                    <FormSelect
                      value={typeof rule.value === "boolean" ? String(rule.value) : ""}
                      onChange={(value) =>
                        updateRule(rule.id, (current) => ({
                          ...current,
                          value: value === "true",
                        }))
                      }
                      options={booleanOptions}
                      placeholder="Select value"
                    />
                  ) : rule.field === "unit" ? (
                    <Input
                      value={`${rule.value ?? ""}`}
                      placeholder="Leave empty to clear"
                      onChange={(event) =>
                        updateRule(rule.id, (current) => ({
                          ...current,
                          value: event.target.value,
                        }))
                      }
                    />
                  ) : rule.field === "property" ? (
                    <div className="bulk-attribute-edit-dialog__property-value">
                      <FormSelect
                        className="bulk-attribute-edit-dialog__property-picker"
                        value={rule.propertyName || ""}
                        onChange={(value) =>
                          updateRule(rule.id, (current) => ({
                            ...current,
                            propertyName: value,
                            value: "",
                          }))
                        }
                        options={[{ value: "", label: "Select property" }, ...propertyNameOptions]}
                        placeholder="Select property"
                      />
                      {propertyValueOptions.length ? (
                        <FormSelect
                          className="bulk-attribute-edit-dialog__property-input"
                          value={`${rule.value ?? ""}`}
                          onChange={(value) =>
                            updateRule(rule.id, (current) => ({
                              ...current,
                              value,
                            }))
                          }
                          options={[{ value: "", label: "Clear property" }, ...propertyValueOptions]}
                          placeholder={rule.propertyName ? "Select value" : "Select property first"}
                          disabled={!rule.propertyName}
                        />
                      ) : (
                        <Input
                          className="bulk-attribute-edit-dialog__property-input"
                          value={`${rule.value ?? ""}`}
                          placeholder={rule.propertyName ? "Leave empty to clear" : "Select property first"}
                          disabled={!rule.propertyName}
                          onChange={(event) =>
                            updateRule(rule.id, (current) => ({
                              ...current,
                              value: event.target.value,
                            }))
                          }
                        />
                      )}
                    </div>
                  ) : (
                    <FormSelect
                      value={`${rule.value ?? ""}`}
                      onChange={(value) =>
                        updateRule(rule.id, (current) => ({
                          ...current,
                          value,
                        }))
                      }
                      options={selectOptions}
                      placeholder="Select value"
                    />
                  )}
                  {isDuplicate ? (
                    <div className="field-error">
                      {rule.field === "property" ? "This column property is already used in another rule." : "This field is already used in another rule."}
                    </div>
                  ) : null}
                  {!isDuplicate && ruleNeedsPropertyName(rule) ? <div className="field-error">Select a column property.</div> : null}
                  {!isDuplicate && ruleNeedsValue(rule) ? <div className="field-error">A value is required for this rule.</div> : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="bulk-attribute-edit-dialog__remove"
                  onClick={() => removeRule(rule.id)}
                  disabled={rules.length <= 1}
                  title="Remove rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="bulk-attribute-edit-dialog__actions-row">
          <Button type="button" variant="ghost" size="sm" onClick={addRule}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>

        <DialogFooter className="bulk-attribute-edit-dialog__footer">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="default" onClick={handleApply} disabled={!canApply}>
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
