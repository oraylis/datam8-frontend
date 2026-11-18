import { useState } from "react";
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
import {
  aggregateQualityType,
  QUALITY_TYPES,
  qualityErrors,
  type QualityCheck,
} from "./quality";

type Attribute = {
  name?: string;
  dateDeleted?: unknown;
  dataType?: { type?: string };
};
type Draft = {
  id: string;
  type: string;
  attribute: string;
  execution: string;
  severity: string;
  description: string;
  parameters: Record<string, string>;
  definitionJson: string;
};
const labels: Record<string, string> = {
  dqx: "Native DQX definition",
  not_null: "Not Null",
  range: "Range",
  sql_expression: "SQL Expression",
  completeness: "Completeness",
  freshness: "Freshness",
  row_count: "Row Count",
};
const parameterLabels: Record<string, string> = {
  min: "Minimum (inclusive)",
  max: "Maximum (inclusive)",
  expression: "SQL expression",
  minCompleteness: "Minimum completeness (0–1)",
  maxAgeSeconds: "Maximum age (seconds)",
  minCount: "Minimum row count",
  maxCount: "Maximum row count",
};
const parameterKeys: Record<string, string[]> = {
  not_null: [],
  range: ["min", "max"],
  sql_expression: ["expression"],
  completeness: ["minCompleteness"],
  freshness: ["maxAgeSeconds"],
  row_count: ["minCount", "maxCount"],
};

export function EntityQualityEditor({
  quality,
  attributes,
  onChange,
  saveError,
}: {
  quality?: Quality;
  attributes: Attribute[];
  onChange: (value: Quality) => void;
  saveError?: string | null;
}) {
  const checks = quality?.checks || [];
  const [qualityJson, setQualityJson] = useState<string | null>(null);
  let jsonQuality: Quality | null = null;
  let jsonErrors: string[] = [];
  if (qualityJson !== null) {
    try {
      jsonQuality = JSON.parse(qualityJson) as Quality;
      jsonErrors = qualityErrors(jsonQuality, attributes);
    } catch {
      jsonErrors = ["Enter valid Quality JSON."];
    }
  }
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [threshold, setThreshold] = useState<string | null>(null);
  const active = attributes.filter((a) => !a.dateDeleted && a.name);
  const open = (index: number | null, copy = false) => {
    const c = index === null ? undefined : checks[index];
    setEditing(copy ? null : index);
    let id = c?.id || "quality_check";
    if (index === null || copy) {
      let n = 1;
      while (checks.some((r) => r.id === id))
        id = `${c?.id || "quality_check"}_${n++}`;
    }
    setDraft({
      id,
      type: c?.type || "dqx",
      attribute: c && "attribute" in c ? c.attribute : active[0]?.name || "",
      execution: c?.execution || "enforcement",
      severity: c && "severity" in c ? c.severity : "error",
      definitionJson: JSON.stringify(
        c?.type === "dqx"
          ? c.definition
          : {
              check: {
                function: "is_not_null",
                arguments: { column: active[0]?.name || "" },
              },
              criticality: "error",
            },
        null,
        2,
      ),
      description: c?.description || "",
      parameters:
        c && "parameters" in c
          ? Object.fromEntries(
              Object.entries(c.parameters).map(([k, v]) => [k, String(v)]),
            )
          : {},
    });
  };
  let nativeDefinition: unknown = null;
  let nativeJsonError: string | null = null;
  if (draft?.type === "dqx") {
    try {
      nativeDefinition = JSON.parse(draft.definitionJson);
    } catch {
      nativeJsonError = "Enter valid DQX JSON.";
    }
  }
  const candidate = draft
    ? ({
        id: draft.id.trim(),
        type: draft.type,
        execution: draft.execution,
        ...(draft.type === "dqx"
          ? { definition: nativeDefinition }
          : { severity: draft.severity }),
        ...(draft.description ? { description: draft.description } : {}),
        ...(!["dqx", "sql_expression", "row_count"].includes(draft.type)
          ? { attribute: draft.attribute }
          : {}),
        ...(!["not_null", "dqx"].includes(draft.type)
          ? {
              parameters: Object.fromEntries(
                (parameterKeys[draft.type] || [])
                  .filter((k) => draft.parameters[k]?.trim())
                  .map((k) => [
                    k,
                    k === "expression"
                      ? draft.parameters[k]
                      : Number(draft.parameters[k]),
                  ]),
              ),
            }
          : {}),
      } as QualityCheck)
    : null;
  const nextChecks = candidate
    ? editing === null
      ? [...checks, candidate]
      : checks.map((c, i) => (i === editing ? candidate : c))
    : checks;
  const errors = candidate
    ? [
        ...(nativeJsonError ? [nativeJsonError] : []),
        ...qualityErrors({ ...quality, checks: nextChecks }, attributes),
      ]
    : [];
  const thresholdText =
    threshold ?? String(quality?.settings?.maxFailureRatePct ?? "");
  const thresholdValid =
    thresholdText === "" ||
    (Number.isFinite(Number(thresholdText)) &&
      Number(thresholdText) >= 0 &&
      Number(thresholdText) <= 100);
  return (
    <section aria-label="Quality configuration" className="space-y-4">
      <p>
        Enforcement isolates error rows in quarantine; warning rows stay in the
        target. Monitoring checks the whole target table after a successful
        write.
      </p>
      {saveError && <p role="alert">{saveError}</p>}
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
            onChange({
              ...quality,
              checks,
              settings:
                thresholdText === ""
                  ? Object.fromEntries(
                      Object.entries(quality?.settings || {}).filter(
                        ([key]) => key !== "maxFailureRatePct",
                      ),
                    )
                  : {
                      ...quality?.settings,
                      maxFailureRatePct: Number(thresholdText),
                    },
            });
            setThreshold(null);
          }}
        />
      </label>
      {!thresholdValid && (
        <p role="alert">Enter a percentage between 0 and 100.</p>
      )}
      <p>
        When the error rate exceeds this threshold, valid rows are written
        before dependent processing stops.
      </p>
      <Button onClick={() => open(null)}>Add quality check</Button>
      <Button
        variant="outline"
        onClick={() =>
          setQualityJson(JSON.stringify(quality || { checks: [] }, null, 2))
        }
      >
        Edit full Quality JSON
      </Button>
      {checks.length === 0 && <p>No quality checks configured.</p>}
      {checks.map((c, i) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center gap-3 rounded border p-3"
        >
          <strong>{c.id}</strong>
          <span>{labels[c.type]}</span>
          <span>{"attribute" in c ? c.attribute : "Entity"}</span>
          <span>{c.execution}</span>
          <span>
            {c.type === "dqx"
              ? c.definition.criticality || "error"
              : c.severity}
          </span>
          <Button
            variant="outline"
            aria-label={`Edit ${c.id}`}
            onClick={() => open(i)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            aria-label={`Duplicate ${c.id}`}
            onClick={() => open(i, true)}
          >
            Duplicate
          </Button>
          <Button
            variant="outline"
            aria-label={`Delete ${c.id}`}
            onClick={() =>
              onChange({
                ...quality,
                checks: checks.filter((_, index) => index !== i),
              })
            }
          >
            Delete
          </Button>
        </div>
      ))}
      <Dialog
        open={qualityJson !== null}
        onOpenChange={(open) => {
          if (!open) setQualityJson(null);
        }}
      >
        <DialogContent data-explicit-autosave="true">
          <DialogHeader>
            <DialogTitle>Edit Quality JSON</DialogTitle>
            <DialogDescription>
              Rules, reference datasets and dependencies are stored entirely in
              the entity model.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-96 font-mono"
            value={qualityJson || ""}
            onChange={(e) => setQualityJson(e.target.value)}
          />
          {jsonErrors.map((error, index) => (
            <p role="alert" key={index}>
              {error}
            </p>
          ))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityJson(null)}>
              Cancel
            </Button>
            <Button
              disabled={jsonErrors.length > 0 || !jsonQuality}
              onClick={() => {
                if (jsonQuality) {
                  onChange(jsonQuality);
                  setQualityJson(null);
                }
              }}
            >
              Save Quality
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent data-explicit-autosave="true">
          <DialogHeader>
            <DialogTitle>
              {editing === null ? "Add quality check" : "Edit quality check"}
            </DialogTitle>
            <DialogDescription>
              Define a quality requirement for this entity.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <label>
                Check ID
                <Input
                  value={draft.id}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                />
              </label>
              <label>
                Rule type
                <FormSelect
                  value={draft.type}
                  options={QUALITY_TYPES.map((value) => ({
                    value,
                    label: labels[value],
                  }))}
                  onChange={(type) =>
                    setDraft({
                      ...draft,
                      type,
                      parameters: {},
                      execution: aggregateQualityType(type)
                        ? "monitoring"
                        : draft.execution,
                    })
                  }
                />
              </label>
              {!["dqx", "sql_expression", "row_count"].includes(draft.type) && (
                <label>
                  Attribute
                  <FormSelect
                    value={draft.attribute}
                    options={active.map((a) => ({
                      value: a.name!,
                      label: a.name!,
                    }))}
                    onChange={(attribute) => setDraft({ ...draft, attribute })}
                  />
                </label>
              )}
              <label>
                Execution
                <FormSelect
                  value={draft.execution}
                  options={(aggregateQualityType(draft.type)
                    ? ["monitoring"]
                    : ["enforcement", "monitoring"]
                  ).map((value) => ({ value, label: value }))}
                  onChange={(execution) => setDraft({ ...draft, execution })}
                />
              </label>
              {draft.type !== "dqx" && (
                <label>
                  Severity
                  <FormSelect
                    value={draft.severity}
                    options={["error", "warning"].map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={(severity) => setDraft({ ...draft, severity })}
                  />
                </label>
              )}
              {draft.type === "dqx" && (
                <label>
                  Native DQX definition (JSON)
                  <Textarea
                    className="min-h-64 font-mono"
                    value={draft.definitionJson}
                    onChange={(e) =>
                      setDraft({ ...draft, definitionJson: e.target.value })
                    }
                  />
                  <span>
                    All declarative functions and arguments supported by the
                    deployed DQX version; no DataM8 function allow-list. Use
                    full Quality JSON for reference datasets and dependencies.
                  </span>
                </label>
              )}
              {(parameterKeys[draft.type] || []).map((key) => (
                <label key={key}>
                  {parameterLabels[key]}
                  {key === "expression" ? (
                    <Textarea
                      value={draft.parameters[key] || ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          parameters: {
                            ...draft.parameters,
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                  ) : (
                    <Input
                      type="number"
                      step="any"
                      value={draft.parameters[key] || ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          parameters: {
                            ...draft.parameters,
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                  )}
                </label>
              ))}
              <label>
                Description
                <Input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              {errors.length > 0 && (
                <div role="alert">
                  {errors.map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={errors.length > 0}
              onClick={() => {
                if (!candidate || errors.length) return;
                onChange({ ...quality, checks: nextChecks });
                setDraft(null);
              }}
            >
              Save check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
