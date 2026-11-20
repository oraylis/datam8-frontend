import { useState } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  Button,
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
import { qualityErrors, type QualityCheck } from "./quality";

type Draft = {
  id: string;
  execution: "enforcement" | "monitoring";
  severity: "error" | "warning";
  description: string;
  expression: string;
  aggregate: boolean;
  sql: string;
  onEmpty: "evaluate" | "no_data";
};
type ReferenceDraft = {
  original: string | null;
  alias: string;
  entityId: string;
};

export function EntityQualityEditor({
  quality,
  modelEntities = [],
  onChange,
  saveError,
}: {
  quality?: Quality;
  modelEntities?: ModelEntity[];
  onChange: (value: Quality) => void;
  saveError?: string | null;
}) {
  const checks = quality?.checks || [];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [referenceDraft, setReferenceDraft] = useState<ReferenceDraft | null>(
    null,
  );
  const [threshold, setThreshold] = useState<string | null>(null);
  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));
  const open = (index: number | null, copy = false) => {
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
      aggregate: check?.sql !== undefined,
      sql: check?.sql || "",
      onEmpty: check?.onEmpty || "evaluate",
    });
  };
  const candidate: QualityCheck | null = draft
    ? {
        id: draft.id.trim(),
        execution: draft.execution,
        severity: draft.severity,
        expression: draft.expression,
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
    <section aria-label="Quality configuration" className="space-y-4">
      {saveError && <p role="alert">{saveError}</p>}
      <div className="source-block">
        <label className="grid gap-1.5 text-foreground text-sm font-normal">
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
          <p role="alert">Enter a percentage between 0 and 100.</p>
        )}
        <p>
          Valid rows and metrics are written before a strictly exceeded error
          threshold stops dependent processing.
        </p>
      </div>
      <div className="source-block">
        <div className="section-header">
          <h3>References</h3>
          <Button
            variant="outline"
            onClick={() =>
              setReferenceDraft({ original: null, alias: "", entityId: "" })
            }
          >
            Add reference
          </Button>
        </div>
        {Object.entries(references).map(([alias, binding]) => (
          <div className="section-header" key={alias}>
            <span>
              <strong>{alias}</strong> —{" "}
              {entityOptions.find((o) => o.value === String(binding.entityId))
                ?.label || `Entity ${binding.entityId}`}
            </span>
            <div className="actions actions--tight">
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
                <Pencil className="h-4 w-4" />
              </IconBtn>
              <IconBtn
                title={`Delete reference ${alias}`}
                aria-label={`Delete reference ${alias}`}
                onClick={() => removeReference(alias)}
              >
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        ))}
        {!Object.keys(references).length && <p>No references configured.</p>}
        <p>
          Use declared references in monitoring SQL as{" "}
          <code>{"{references.alias}"}</code>.
        </p>
      </div>
      <div className="section-header">
        <h3>Quality checks ({checks.length})</h3>
        <Button onClick={() => open(null)}>Add quality check</Button>
      </div>
      {checks.length === 0 && <p>No quality checks configured.</p>}
      {checks.map((check, index) => (
        <div className="source-block" key={check.id}>
          <div className="section-header">
            <div>
              <div className="source-eyebrow">
                <span className="source-kind">{check.execution}</span>
                <span>{check.severity || "error"}</span>
                <span>
                  {check.sql !== undefined ? "Aggregate" : "Row check"}
                </span>
              </div>
              <strong className="section-title">{check.id}</strong>
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
          <p className="truncate font-mono" title={check.expression}>
            {check.expression}
          </p>
          {check.description && <p>{check.description}</p>}
        </div>
      ))}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent
          data-explicit-autosave="true"
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {editing === null ? "Add quality check" : "Edit quality check"}
            </DialogTitle>
            <DialogDescription>
              Define a SQL condition. Only TRUE passes; FALSE and NULL are
              violations.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-foreground text-sm font-normal">
                Check ID
                <Input
                  value={draft.id}
                  onChange={(e) => updateDraft({ id: e.target.value })}
                />
              </label>
              <label className="grid gap-1.5 text-foreground text-sm font-normal">
                Description
                <Input
                  value={draft.description}
                  onChange={(e) => updateDraft({ description: e.target.value })}
                />
              </label>
              <fieldset>
                <legend>Execution</legend>
                <div className="flex gap-4">
                  {(["enforcement", "monitoring"] as const).map((mode) => (
                    <label key={mode} className="flex gap-2 items-center">
                      <input
                        type="radio"
                        name="quality-execution"
                        value={mode}
                        checked={draft.execution === mode}
                        disabled={mode === "enforcement" && draft.aggregate}
                        onChange={() => updateDraft({ execution: mode })}
                      />
                      {mode === "enforcement" ? "Enforcement" : "Monitoring"}
                    </label>
                  ))}
                </div>
                {draft.aggregate && (
                  <p>
                    Disable the aggregate option before switching to
                    enforcement.
                  </p>
                )}
              </fieldset>
              <fieldset>
                <legend>Severity</legend>
                <div className="flex gap-4">
                  {(["error", "warning"] as const).map((severity) => (
                    <label key={severity} className="flex gap-2 items-center">
                      <input
                        type="radio"
                        name="quality-severity"
                        value={severity}
                        checked={draft.severity === severity}
                        onChange={() => updateDraft({ severity })}
                      />
                      {severity === "error" ? "Error" : "Warning"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="grid gap-1.5 text-foreground text-sm font-normal">
                SQL Expression
                <Textarea
                  aria-label="SQL Expression"
                  className="font-mono min-h-24"
                  value={draft.expression}
                  placeholder={
                    draft.aggregate
                      ? "measured_value >= 0.95"
                      : "CustomerId IS NOT NULL"
                  }
                  onChange={(e) => updateDraft({ expression: e.target.value })}
                />
              </label>
              <label className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={draft.aggregate}
                  disabled={draft.execution !== "monitoring"}
                  onChange={(e) => updateDraft({ aggregate: e.target.checked })}
                />
                Aggregated check with SQL
              </label>
              {draft.execution !== "monitoring" && (
                <p>Aggregate SQL is available for monitoring.</p>
              )}
              {draft.aggregate && (
                <>
                  <label className="grid gap-1.5 text-foreground text-sm font-normal">
                    SQL Query
                    <Textarea
                      aria-label="SQL Query"
                      className="font-mono min-h-40"
                      value={draft.sql}
                      placeholder={
                        "SELECT COUNT(*) AS checked_rows,\nCOUNT(Email) * 1.0 / NULLIF(COUNT(*), 0) AS measured_value\nFROM {target}"
                      }
                      onChange={(e) => updateDraft({ sql: e.target.value })}
                    />
                  </label>
                  <p>
                    The query must return exactly one row with{" "}
                    <code>checked_rows</code> and <code>measured_value</code>.
                    SQL Expression evaluates this result, for example{" "}
                    <code>measured_value &gt;= 0.95</code>.
                  </p>
                  <label className="grid gap-1.5 text-foreground text-sm font-normal">
                    On empty input
                    <select
                      value={draft.onEmpty}
                      onChange={(e) =>
                        updateDraft({
                          onEmpty: e.target.value as Draft["onEmpty"],
                        })
                      }
                    >
                      <option value="evaluate">Evaluate the condition</option>
                      <option value="no_data">Report NO_DATA</option>
                    </select>
                  </label>
                  <p>
                    Empty means <code>checked_rows = 0</code>. Technical
                    validation always runs.
                  </p>
                </>
              )}
              {errors.map((e, i) => (
                <p role="alert" key={i}>
                  {e}
                </p>
              ))}
            </div>
          )}
          <DialogFooter>
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
