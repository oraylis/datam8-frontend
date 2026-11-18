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
import { qualityErrors, type QualityCheck } from "./quality";

type Draft = {
  id: string;
  execution: string;
  description: string;
  definition: string;
};

export function EntityQualityEditor({
  quality,
  onChange,
  saveError,
}: {
  quality?: Quality;
  onChange: (value: Quality) => void;
  saveError?: string | null;
}) {
  const checks = quality?.checks || [];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [qualityJson, setQualityJson] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<string | null>(null);
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
      description: check?.description || "",
      definition: JSON.stringify(check?.definition || {}, null, 2),
    });
  };
  let candidate: QualityCheck | null = null;
  let errors: string[] = [];
  if (draft) {
    try {
      candidate = {
        id: draft.id.trim(),
        execution: draft.execution,
        definition: JSON.parse(draft.definition),
        ...(draft.description ? { description: draft.description } : {}),
      } as QualityCheck;
    } catch {
      errors.push("Enter valid definition JSON.");
    }
  }
  const nextChecks = candidate
    ? editing === null
      ? [...checks, candidate]
      : checks.map((c, i) => (i === editing ? candidate! : c))
    : checks;
  if (candidate)
    errors.push(...qualityErrors({ ...quality, checks: nextChecks }));
  let fullQuality: Quality | null = null;
  let fullErrors: string[] = [];
  if (qualityJson !== null) {
    try {
      fullQuality = JSON.parse(qualityJson) as Quality;
      fullErrors = qualityErrors(fullQuality);
    } catch {
      fullErrors = ["Enter valid Quality JSON."];
    }
  }
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
        Store rule definitions for the selected generator target. The target
        validates its own rule format and executes enforcement or monitoring.
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
            const settings = { ...quality?.settings };
            if (thresholdText === "") delete settings.maxFailureRatePct;
            else settings.maxFailureRatePct = Number(thresholdText);
            onChange({ ...quality, checks, settings });
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
      {checks.map((check, index) => (
        <div
          key={check.id}
          className="flex flex-wrap items-center gap-3 rounded border p-3"
        >
          <strong>{check.id}</strong>
          <span>{check.execution}</span>
          {check.description && <span>{check.description}</span>}
          <Button
            variant="outline"
            aria-label={`Edit ${check.id}`}
            onClick={() => open(index)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            aria-label={`Duplicate ${check.id}`}
            onClick={() => open(index, true)}
          >
            Duplicate
          </Button>
          <Button
            variant="outline"
            aria-label={`Delete ${check.id}`}
            onClick={() =>
              onChange({
                ...quality,
                checks: checks.filter((_, i) => i !== index),
              })
            }
          >
            Delete
          </Button>
        </div>
      ))}
      <Dialog
        open={qualityJson !== null}
        onOpenChange={(value) => {
          if (!value) setQualityJson(null);
        }}
      >
        <DialogContent data-explicit-autosave="true">
          <DialogHeader>
            <DialogTitle>Edit Quality JSON</DialogTitle>
            <DialogDescription>
              Rules, references and target options are stored in the entity
              model. Tool-specific configuration is interpreted by the target.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Quality JSON"
            className="min-h-96 font-mono"
            value={qualityJson || ""}
            onChange={(e) => setQualityJson(e.target.value)}
          />
          {fullErrors.map((error, i) => (
            <p role="alert" key={i}>
              {error}
            </p>
          ))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityJson(null)}>
              Cancel
            </Button>
            <Button
              disabled={!fullQuality || fullErrors.length > 0}
              onClick={() => {
                if (fullQuality) {
                  onChange(fullQuality);
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
        onOpenChange={(value) => {
          if (!value) setDraft(null);
        }}
      >
        <DialogContent data-explicit-autosave="true">
          <DialogHeader>
            <DialogTitle>
              {editing === null ? "Add quality check" : "Edit quality check"}
            </DialogTitle>
            <DialogDescription>
              The definition format belongs to the selected target; DataM8 does
              not prescribe check functions or parameters.
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
                Execution
                <FormSelect
                  value={draft.execution}
                  options={["enforcement", "monitoring"].map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(execution) => setDraft({ ...draft, execution })}
                />
              </label>
              <label>
                Definition (JSON)
                <Textarea
                  className="min-h-64 font-mono"
                  value={draft.definition}
                  onChange={(e) =>
                    setDraft({ ...draft, definition: e.target.value })
                  }
                />
              </label>
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
                  {errors.map((error) => (
                    <p key={error}>{error}</p>
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
    </section>
  );
}
