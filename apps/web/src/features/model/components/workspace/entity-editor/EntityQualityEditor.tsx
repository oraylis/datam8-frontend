import { useId, useImperativeHandle, useState, type Ref } from "react";
import { Copy, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormSelect,
  Input,
  Textarea,
} from "@datam8/ui";
import type { Quality } from "../../../generated-schema-types";
import type { ModelEntity } from "../../../model-types";
import { IconBtn } from "../common/IconBtn";
import {
  parseQualityArguments,
  qualityErrors,
  type QualityCheck,
} from "./quality";
import { QualityArgumentsEditor } from "./QualityArgumentsEditor";
import {
  argumentEntries,
  argumentEntriesJson,
  type ArgumentEntry,
} from "./qualityArgumentDraft";
import "./quality-editor.css";

type Draft = {
  id: string;
  execution: "enforcement" | "monitoring";
  severity: "error" | "warning";
  description: string;
  expression: string;
  definition: "sql" | "native";
  function: string;
  arguments: string;
  argumentMode: "fields" | "json";
  argumentRows: ArgumentEntry[];
  aggregate: boolean;
  sql: string;
  onEmpty: "evaluate" | "no_data";
};
type ReferenceDraft = {
  original: string | null;
  alias: string;
  entityId: string;
};

export type EntityQualityEditorHandle = {
  addSqlCheck: () => void;
  addNativeCheck: () => void;
};

export function EntityQualityEditor({
  ref,
  quality,
  modelEntities = [],
  onChange,
  saveError,
}: {
  ref?: Ref<EntityQualityEditorHandle>;
  quality?: Quality;
  modelEntities?: ModelEntity[];
  onChange: (value: Quality) => void;
  saveError?: string | null;
}) {
  const checks = quality?.checks || [];
  const aggregateId = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [referenceDraft, setReferenceDraft] = useState<ReferenceDraft | null>(
    null,
  );
  const [threshold, setThreshold] = useState<string | null>(null);
  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));
  const open = (
    index: number | null,
    copy = false,
    definition: Draft["definition"] = "sql",
  ) => {
    const check = index === null ? undefined : checks[index];
    setEditing(copy ? null : index);
    let id = check?.id || "quality_check";
    if (index === null || copy) {
      let n = 1;
      while (checks.some((c) => c.id === id))
        id = `${check?.id || "quality_check"}_${n++}`;
    }
    setDraft({
      id,
      execution: check?.execution || "enforcement",
      severity: check?.severity || "error",
      description: check?.description || "",
      expression: check?.expression || "",
      definition: check ? ("function" in check ? "native" : "sql") : definition,
      function: check?.function || "",
      arguments: JSON.stringify(check?.arguments ?? {}, null, 2),
      argumentMode: "fields",
      argumentRows: argumentEntries(check?.arguments ?? {}),
      aggregate: check?.sql !== undefined,
      sql: check?.sql || "",
      onEmpty: check?.onEmpty || "evaluate",
    });
  };
  useImperativeHandle(ref, () => ({
    addSqlCheck: () => open(null),
    addNativeCheck: () => open(null, false, "native"),
  }));
  let parsedArguments: Record<string, unknown> = {};
  let argumentsError: string | null = null;
  let argumentFieldsError: string | null = null;
  let argumentsJson = draft?.arguments ?? "{}";
  if (draft?.definition === "native") {
    try {
      if (draft.argumentMode === "fields") {
        try {
          argumentsJson = argumentEntriesJson(draft.argumentRows);
        } catch (error) {
          argumentFieldsError =
            error instanceof Error ? error.message : "Invalid arguments.";
          throw error;
        }
      }
      parsedArguments = parseQualityArguments(argumentsJson);
    } catch (error) {
      argumentsError =
        error instanceof Error ? error.message : "Invalid arguments.";
    }
  }
  const candidate: QualityCheck | null = draft
    ? {
        id: draft.id.trim(),
        execution: draft.execution,
        severity: draft.severity,
        ...(draft.definition === "native"
          ? { function: draft.function, arguments: parsedArguments }
          : { expression: draft.expression }),
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.aggregate ? { sql: draft.sql, onEmpty: draft.onEmpty } : {}),
      }
    : null;
  const nextChecks = candidate
    ? editing === null
      ? [...checks, candidate]
      : checks.map((c, i) => (i === editing ? candidate : c))
    : checks;
  const errors = candidate
    ? qualityErrors({ ...quality, checks: nextChecks })
    : [];
  if (argumentsError) errors.push(argumentsError);
  const thresholdText = threshold ?? String(quality?.maxFailureRatePct ?? "");
  const thresholdValid =
    thresholdText === "" ||
    (Number.isFinite(Number(thresholdText)) &&
      Number(thresholdText) >= 0 &&
      Number(thresholdText) <= 100);
  const references = quality?.references || {};
  const nextReferences = { ...references };
  if (referenceDraft) {
    if (referenceDraft.original !== null)
      delete nextReferences[referenceDraft.original];
    nextReferences[referenceDraft.alias.trim()] = {
      entityId: referenceDraft.entityId ? Number(referenceDraft.entityId) : -1,
    };
  }
  const referenceErrors = referenceDraft
    ? qualityErrors({ ...quality, checks, references: nextReferences })
    : [];
  if (
    referenceDraft &&
    referenceDraft.original !== referenceDraft.alias.trim() &&
    referenceDraft.alias.trim() in references
  )
    referenceErrors.push("Reference alias must be unique.");
  const entityOptions = modelEntities
    .filter((e) => e.content?.id !== undefined)
    .map((e) => ({
      value: String(e.content.id),
      label: `${e.content.name || e.name || e.relPath} (${e.content.id})`,
    }));
  const removeReference = (alias: string) => {
    const next = { ...references };
    delete next[alias];
    onChange({ ...quality, checks, references: next });
  };
  return (
    <section aria-label="Quality configuration" className="quality-workspace">
      {saveError && <p role="alert">{saveError}</p>}
      {checks.length ? (
        <div className="quality-check-list" aria-label="Quality checks">
          {checks.map((check, index) => (
            <article
              className="source-block quality-check-card"
              key={check.id}
              aria-label={check.id}
            >
              <div className="section-header quality-check-header">
                <div className="source-header-main">
                  <div className="source-eyebrow">
                    <span className="source-kind source-kind--internal">
                      {check.function !== undefined ? "Native" : "SQL"}
                    </span>
                    <span>
                      {check.execution === "enforcement"
                        ? "Enforcement"
                        : check.sql !== undefined
                          ? "Aggregate monitoring"
                          : "Row monitoring"}
                      {" · "}
                      {check.severity === "warning" ? "Warning" : "Error"}
                    </span>
                  </div>
                  <h3 className="section-title source-title">{check.id}</h3>
                  {check.description && (
                    <p className="quality-check-description">
                      {check.description}
                    </p>
                  )}
                </div>
                <div className="actions actions--tight">
                  <IconBtn
                    title={`Edit ${check.id}`}
                    aria-label={`Edit ${check.id}`}
                    onClick={() => open(index)}
                  >
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    title={`Duplicate ${check.id}`}
                    aria-label={`Duplicate ${check.id}`}
                    onClick={() => open(index, true)}
                  >
                    <Copy className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    title={`Delete ${check.id}`}
                    aria-label={`Delete ${check.id}`}
                    onClick={() =>
                      onChange({
                        ...quality,
                        checks: checks.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="quality-empty">
          <ShieldCheck size={24} />
          <h4>No quality checks configured</h4>
          <p>
            Add a SQL expression or a native function to check this entity's
            data.
          </p>
        </div>
      )}
      <div className="quality-settings">
        <section className="quality-setting">
          <div>
            <h4>Quality gate</h4>
            <p>
              Stop dependent processing above this error rate, after valid rows
              and metrics are written.
            </p>
          </div>
          <label>
            Maximum failure rate (%)
            <Input
              type="number"
              min={0}
              max={100}
              value={thresholdText}
              data-explicit-autosave="true"
              placeholder="No threshold"
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={() => {
                const next = { ...quality, checks };
                if (thresholdText === "") delete next.maxFailureRatePct;
                else next.maxFailureRatePct = Number(thresholdText);
                onChange(next);
                setThreshold(null);
              }}
            />
          </label>
          {!thresholdValid && (
            <p role="alert" className="quality-error">
              Enter a percentage between 0 and 100.
            </p>
          )}
        </section>
        <section className="quality-setting quality-references">
          <div className="quality-section-heading">
            <div>
              <h4>
                SQL references{" "}
                <span className="quality-count">
                  {Object.keys(references).length}
                </span>
              </h4>
              <p>Model entities available in aggregate queries.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setReferenceDraft({ original: null, alias: "", entityId: "" })
              }
            >
              <Plus size={14} />
              Add reference
            </Button>
          </div>
          {Object.entries(references).map(([alias, binding]) => (
            <div className="quality-reference-row" key={alias}>
              <div>
                <code>{`{references.${alias}}`}</code>
                <span>
                  {entityOptions.find(
                    (o) => o.value === String(binding.entityId),
                  )?.label || `Entity ${binding.entityId}`}
                </span>
              </div>
              <div className="quality-row-actions">
                <IconBtn
                  title={`Edit reference ${alias}`}
                  aria-label={`Edit reference ${alias}`}
                  onClick={() =>
                    setReferenceDraft({
                      original: alias,
                      alias,
                      entityId: String(binding.entityId),
                    })
                  }
                >
                  <Pencil size={14} />
                </IconBtn>
                <IconBtn
                  title={`Delete reference ${alias}`}
                  aria-label={`Delete reference ${alias}`}
                  onClick={() => removeReference(alias)}
                >
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </div>
          ))}
          {!Object.keys(references).length && (
            <p className="quality-muted">
              No references configured. Queries can still use{" "}
              <code>{"{target}"}</code>.
            </p>
          )}
        </section>
      </div>
      <Dialog
        open={draft !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDraft(null);
        }}
      >
        <DialogContent
          data-explicit-autosave="true"
          className="entity-linkage-dialog quality-rule-dialog"
        >
          <DialogHeader className="quality-rule-header">
            <DialogTitle>
              {editing === null ? "Add quality check" : "Edit quality check"}
            </DialogTitle>
            <DialogDescription>
              Define the check and decide how its results are used.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="quality-rule-scroll">
              <div className="quality-rule-fields">
                <label>
                  Check ID
                  <Input
                    value={draft.id}
                    onChange={(e) => updateDraft({ id: e.target.value })}
                    placeholder="customer_unique"
                  />
                </label>
                <label>
                  <span>
                    Description{" "}
                    <span className="quality-optional">Optional</span>
                  </span>
                  <Input
                    aria-label="Description"
                    value={draft.description}
                    onChange={(e) =>
                      updateDraft({ description: e.target.value })
                    }
                  />
                </label>
                <label>
                  Execution
                  <FormSelect
                    aria-label="Execution"
                    value={draft.execution}
                    options={[
                      {
                        value: "enforcement",
                        label: "Enforcement",
                        disabled: draft.aggregate,
                      },
                      { value: "monitoring", label: "Monitoring" },
                    ]}
                    onChange={(execution) =>
                      updateDraft({
                        execution: execution as Draft["execution"],
                      })
                    }
                  />
                </label>
                <label>
                  Severity
                  <FormSelect
                    aria-label="Severity"
                    value={draft.severity}
                    options={[
                      { value: "error", label: "Error" },
                      { value: "warning", label: "Warning" },
                    ]}
                    onChange={(severity) =>
                      updateDraft({ severity: severity as Draft["severity"] })
                    }
                  />
                </label>
                <label>
                  Definition
                  <FormSelect
                    aria-label="Definition"
                    value={draft.definition}
                    options={[
                      { value: "sql", label: "SQL expression" },
                      { value: "native", label: "Native function" },
                    ]}
                    onChange={(definition) =>
                      updateDraft({
                        definition: definition as Draft["definition"],
                      })
                    }
                  />
                </label>
                {draft.definition === "native" && (
                  <label>
                    Function
                    <Input
                      aria-label="Function"
                      value={draft.function}
                      className="font-mono"
                      placeholder="e.g. is_unique"
                      onChange={(e) =>
                        updateDraft({ function: e.target.value })
                      }
                    />
                  </label>
                )}
              </div>
              <p className="quality-field-help quality-execution-help">
                {draft.execution === "enforcement"
                  ? "Checks prepared input before writing. Error rows go to quarantine; warnings remain valid."
                  : "Checks the written target and records metrics without changing target rows."}
                {draft.aggregate &&
                  " Disable aggregation before selecting enforcement."}
              </p>
              {draft.definition === "sql" ? (
                <label className="quality-definition-input">
                  SQL Expression
                  <Textarea
                    aria-label="SQL Expression"
                    spellCheck={false}
                    className="quality-sql-editor font-mono"
                    value={draft.expression}
                    placeholder={
                      draft.aggregate
                        ? "COALESCE(measured_value >= 0.95, FALSE)"
                        : "CustomerId IS NOT NULL"
                    }
                    onChange={(e) =>
                      updateDraft({ expression: e.target.value })
                    }
                  />
                  <span className="quality-field-help">
                    Define NULL handling explicitly, for example{" "}
                    <code>COALESCE(Amount &gt;= 0, FALSE)</code>.
                  </span>
                </label>
              ) : (
                <>
                  <p className="quality-field-help">
                    Use the exact DQX function name. Function names and
                    arguments are validated when the check runs.
                  </p>
                  <QualityArgumentsEditor
                    entries={draft.argumentRows}
                    onEntriesChange={(argumentRows) =>
                      updateDraft({ argumentRows })
                    }
                    json={draft.arguments}
                    onJsonChange={(value) => updateDraft({ arguments: value })}
                    mode={draft.argumentMode}
                    canSwitch={
                      draft.argumentMode === "fields"
                        ? !argumentFieldsError
                        : !argumentsError
                    }
                    onModeChange={(mode) => {
                      if (mode === "json")
                        updateDraft({
                          argumentMode: mode,
                          arguments: argumentsError
                            ? argumentsJson
                            : JSON.stringify(parsedArguments, null, 2),
                        });
                      else if (!argumentsError)
                        updateDraft({
                          argumentMode: mode,
                          argumentRows: argumentEntries(parsedArguments),
                        });
                    }}
                  />
                </>
              )}
              {draft.execution === "monitoring" && (
                <section
                  className="quality-monitoring"
                  aria-label="Monitoring input"
                >
                  <label
                    className="quality-aggregate-toggle"
                    htmlFor={aggregateId}
                  >
                    <Checkbox
                      id={aggregateId}
                      aria-label="Aggregated check with SQL"
                      checked={draft.aggregate}
                      onCheckedChange={(checked) =>
                        updateDraft({ aggregate: checked === true })
                      }
                    />
                    Aggregate results with a SQL query
                  </label>
                  {draft.aggregate && (
                    <div className="quality-aggregate-fields">
                      <label>
                        SQL Query
                        <Textarea
                          aria-label="SQL Query"
                          spellCheck={false}
                          className="quality-sql-editor font-mono"
                          value={draft.sql}
                          placeholder={
                            "SELECT COUNT(*) AS checked_rows,\n       COUNT(Email) * 1.0 / NULLIF(COUNT(*), 0) AS measured_value\nFROM {target}"
                          }
                          onChange={(e) => updateDraft({ sql: e.target.value })}
                        />
                        <span className="quality-field-help">
                          Return one row with <code>checked_rows</code> and{" "}
                          <code>measured_value</code>. Use{" "}
                          <code>{"{target}"}</code> or a declared SQL reference.
                        </span>
                      </label>
                      <label>
                        On empty input
                        <FormSelect
                          aria-label="On empty input"
                          value={draft.onEmpty}
                          options={[
                            {
                              value: "evaluate",
                              label: "Evaluate the condition",
                            },
                            { value: "no_data", label: "Report NO_DATA" },
                          ]}
                          onChange={(onEmpty) =>
                            updateDraft({
                              onEmpty: onEmpty as Draft["onEmpty"],
                            })
                          }
                        />
                        <span className="quality-field-help">
                          Applies when <code>checked_rows = 0</code>. The result
                          contract is always checked.
                        </span>
                      </label>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
          <DialogFooter className="quality-rule-footer">
            <div className="quality-save-status" aria-live="polite">
              {errors.length ? (
                <div role="alert" className="quality-error">
                  {errors[0]}
                  {errors.length > 1 && <span> ({errors.length} issues)</span>}
                </div>
              ) : (
                <span>Changes apply when you save this check.</span>
              )}
            </div>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={!candidate || errors.length > 0}
              onClick={() => {
                if (candidate && !errors.length) {
                  onChange({ ...quality, checks: nextChecks });
                  setDraft(null);
                }
              }}
            >
              Save check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={referenceDraft !== null}
        onOpenChange={(open) => {
          if (!open) setReferenceDraft(null);
        }}
      >
        <DialogContent data-explicit-autosave="true">
          <DialogHeader>
            <DialogTitle>
              {referenceDraft?.original === null
                ? "Add reference"
                : "Edit reference"}
            </DialogTitle>
            <DialogDescription>
              Select a model entity and a unique SQL reference alias.
            </DialogDescription>
          </DialogHeader>
          {referenceDraft && (
            <>
              <label className="grid gap-1.5 text-foreground text-sm font-normal">
                Reference alias
                <Input
                  value={referenceDraft.alias}
                  onChange={(e) =>
                    setReferenceDraft({
                      ...referenceDraft,
                      alias: e.target.value,
                    })
                  }
                />
              </label>
              <label className="grid gap-1.5 text-foreground text-sm font-normal">
                Reference entity
                <FormSelect
                  value={referenceDraft.entityId}
                  options={[
                    { value: "", label: "Select entity" },
                    ...entityOptions,
                  ]}
                  onChange={(entityId) =>
                    setReferenceDraft({ ...referenceDraft, entityId })
                  }
                />
              </label>
              {referenceErrors.map((e, i) => (
                <p role="alert" key={i}>
                  {e}
                </p>
              ))}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferenceDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={!referenceDraft || referenceErrors.length > 0}
              onClick={() => {
                if (referenceDraft && !referenceErrors.length) {
                  onChange({ ...quality, checks, references: nextReferences });
                  setReferenceDraft(null);
                }
              }}
            >
              Save reference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
