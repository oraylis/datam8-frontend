import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Checkbox, FormSelect, Input, Textarea } from "@datam8/ui";
import { apiBase } from "../../../../../config";
import { readBackendErrorMessage } from "../../../../../shared/api/errorMessage";

type UiField = {
  key: string;
  label?: string | null;
  type: "string" | "number" | "boolean" | "enum" | "secret" | "textarea" | "hidden";
  required: boolean;
  placeholder?: string;
  default?: string;
  enum?: string[];
};

type UiAuthMode = { id: string; label?: string | null; fields: UiField[] };
type ConnectorUiSchema = { title?: string; authModes: UiAuthMode[] };

function asString(v: unknown): string {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v : String(v);
}

function shallowEqualObject(a: Record<string, any>, b: Record<string, any>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function readAuthMode(value: Record<string, any> | undefined): string {
  const direct = asString(value?.authMode);
  if (direct) return direct;
  return asString(value?.["auth.mode"]);
}

function fieldLabelFromKey(key: string): string {
  const raw = `${key || ""}`.trim();
  if (!raw) return "Field";
  return raw
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveFieldLabel(field: UiField): string {
  const explicit = `${field.label ?? ""}`.trim();
  if (explicit && explicit.toLowerCase() !== "null" && explicit.toLowerCase() !== "undefined") {
    return explicit;
  }
  return fieldLabelFromKey(field.key);
}

async function fetchUiSchema(connectorId: string): Promise<ConnectorUiSchema> {
  const res = await fetch(`${apiBase}/plugins/${encodeURIComponent(connectorId)}/ui-schema`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readBackendErrorMessage(data, `Failed to load schema (${res.status})`));
  return ((data as any)?.item || data) as ConnectorUiSchema;
}

async function validateDataSource(dataSourceName: string) {
  const res = await fetch(`${apiBase}/sources/${encodeURIComponent(dataSourceName)}/test`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(readBackendErrorMessage(data, `Validation failed (${res.status})`));
  }
}

function secretPathFor(dataSourceName: string, key: string): string {
  return `datasources/${dataSourceName}/${key}`;
}

function secretRefFromPath(path: string): string {
  return `ref://${path}`;
}

function secretPathFromRef(value: string): string | null {
  const raw = `${value || ""}`.trim();
  if (!raw.startsWith("ref://")) return null;
  const path = raw.slice("ref://".length).trim();
  return path || null;
}

async function setSecret(path: string, value: string): Promise<void> {
  const response = await fetch(`${apiBase}/secrets/set`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, value }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as any)?.message || (payload as any)?.detail || `Failed to set secret (${response.status})`);
  }
}

async function checkSecret(path: string): Promise<boolean> {
  const response = await fetch(`${apiBase}/secrets/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (response.ok) return true;
  if (response.status === 404) return false;
  const payload = await response.json().catch(() => ({}));
  throw new Error((payload as any)?.message || (payload as any)?.detail || `Failed to check secret (${response.status})`);
}

export function ConnectorUiSchemaForm(props: {
  connectorId: string;
  solutionPath: string;
  dataSourceName: string;
  onRegisterValidate?: (validateFn: (() => void) | null) => void;
  showSchemaTitle?: boolean;
  showSchemaVersion?: boolean;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const { connectorId, dataSourceName, onRegisterValidate, showSchemaTitle = true, value, onChange } = props;
  const [schema, setSchema] = useState<ConnectorUiSchema | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [secretBusy, setSecretBusy] = useState<Record<string, boolean>>({});
  const [secretState, setSecretState] = useState<Record<string, "checking" | "available" | "missing" | "error">>({});
  const [secretError, setSecretError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setStatus("loading");
    setError(null);
    void fetchUiSchema(connectorId)
      .then((next) => {
        setSchema(next);
        setStatus("ready");
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load schema");
        setStatus("error");
      });
  }, [connectorId]);

  const selectedMode = useMemo(() => {
    if (!schema?.authModes?.length) return "";
    const raw = readAuthMode(value);
    if (raw) return raw;
    return schema.authModes[0]?.id || "";
  }, [schema?.authModes, value]);
  const isSelectedModeValid = useMemo(
    () => !!selectedMode && !!schema?.authModes?.some((m) => m.id === selectedMode),
    [schema?.authModes, selectedMode],
  );

  const normalizeValueForMode = useCallback(
    (modeId: string, sourceValue: Record<string, any> | undefined): Record<string, any> => {
      if (!schema?.authModes?.length) return { ...(sourceValue || {}) };
      const mode = schema.authModes.find((m) => m.id === modeId) || schema.authModes[0];
      if (!mode || mode.id !== modeId) return { ...(sourceValue || {}) };

      const allowedKeys = new Set((mode.fields || []).map((field) => field.key));
      const next: Record<string, any> = {};
      for (const [key, fieldValue] of Object.entries(sourceValue || {})) {
        if (key === "authMode" || allowedKeys.has(key)) {
          next[key] = fieldValue;
        }
      }
      next.authMode = mode.id;
      delete next["auth.mode"];
      for (const field of mode.fields || []) {
        if (field.type === "hidden") continue;
        if (field.default && !asString(next[field.key]).trim()) {
          next[field.key] = field.default;
        }
      }
      return next;
    },
    [schema],
  );

  useEffect(() => {
    if (!schema?.authModes?.length) return;
    if (!isSelectedModeValid) return;
    const current = value || {};
    const normalized = normalizeValueForMode(selectedMode, current);
    if (shallowEqualObject(normalized, current)) return;
    onChange(normalized);
  }, [schema, selectedMode, isSelectedModeValid, value, onChange, normalizeValueForMode]);

  const modeFields = useMemo(() => {
    if (!schema?.authModes?.length) return [];
    const mode = schema.authModes.find((m) => m.id === selectedMode) || schema.authModes[0];
    if (!mode || mode.id !== selectedMode) return [];
    return (mode?.fields || []).filter(
      (f) => f.type !== "hidden" && f.key !== "authMode" && f.key !== "auth.mode",
    );
  }, [schema, selectedMode]);

  const secretFields = useMemo(() => modeFields.filter((field) => field.type === "secret"), [modeFields]);

  useEffect(() => {
    let canceled = false;
    if (!secretFields.length) {
      setSecretState({});
      setSecretError({});
      return;
    }

    const run = async () => {
      const checks = secretFields.map(async (field) => {
        const refPath = secretPathFromRef(asString(value?.[field.key]));
        if (!refPath) {
          return { key: field.key, state: "missing" as const, error: null as string | null };
        }
        try {
          const available = await checkSecret(refPath);
          return { key: field.key, state: available ? ("available" as const) : ("missing" as const), error: null as string | null };
        } catch (err: any) {
          console.error("[DataM8] Secret availability check failed:", err);
          return { key: field.key, state: "error" as const, error: err?.message || "Failed to check secret." };
        }
      });

      const results = await Promise.all(checks);
      if (canceled) return;

      const nextState: Record<string, "checking" | "available" | "missing" | "error"> = {};
      const nextError: Record<string, string | null> = {};
      results.forEach((result) => {
        nextState[result.key] = result.state;
        nextError[result.key] = result.error;
      });
      setSecretState(nextState);
      setSecretError(nextError);
    };

    const initial: Record<string, "checking" | "available" | "missing" | "error"> = {};
    secretFields.forEach((field) => {
      const hasRef = !!secretPathFromRef(asString(value?.[field.key]));
      initial[field.key] = hasRef ? "checking" : "missing";
    });
    setSecretState(initial);
    void run();

    return () => {
      canceled = true;
    };
  }, [secretFields, value, dataSourceName]);

  const setValueKey = useCallback(
    (key: string, nextValue: unknown) => {
      setValidationSummary(null);
      const raw = asString(nextValue);
      if (!raw.trim()) {
        const { [key]: _removed, ...rest } = value || {};
        onChange(rest);
        return;
      }
      onChange({ ...(value || {}), [key]: raw });
    },
    [onChange, value],
  );

  const doValidate = useCallback(async () => {
    setValidationSummary(null);
    try {
      await validateDataSource(dataSourceName);
      setValidationSummary("Connection settings are valid.");
    } catch (err: any) {
      console.error("[DataM8] Data source validation failed:", err);
      setValidationSummary(err?.message || "Validation failed.");
    }
  }, [dataSourceName]);

  const upsertSecretRef = useCallback(
    async (key: string) => {
      const draft = `${secretDrafts[key] ?? ""}`.trim();
      if (!draft) {
        setValueKey(key, "");
        return;
      }
      const path = secretPathFor(dataSourceName, key);
      setSecretBusy((prev) => ({ ...prev, [key]: true }));
      setSecretError((prev) => ({ ...prev, [key]: null }));
      try {
        await setSecret(path, draft);
        setValueKey(key, secretRefFromPath(path));
        setSecretDrafts((prev) => ({ ...prev, [key]: "" }));
        setSecretState((prev) => ({ ...prev, [key]: "available" }));
      } catch (err: any) {
        console.error("[DataM8] Secret save failed:", err);
        setSecretError((prev) => ({ ...prev, [key]: err?.message || "Failed to save secret." }));
        setSecretState((prev) => ({ ...prev, [key]: "error" }));
      } finally {
        setSecretBusy((prev) => ({ ...prev, [key]: false }));
      }
    },
    [dataSourceName, secretDrafts, setValueKey],
  );

  useEffect(() => {
    if (!onRegisterValidate) return;
    onRegisterValidate(() => {
      void doValidate();
    });
    return () => onRegisterValidate(null);
  }, [doValidate, onRegisterValidate]);

  if (status === "loading") return <div className="muted small">Loading connector schema...</div>;
  if (status === "error") return <div className="text-sm text-destructive">{error || "Failed to load schema"}</div>;
  if (!schema) return <div className="muted small">No schema.</div>;

  return (
    <div>
      {showSchemaTitle ? <div className="text-sm font-medium text-foreground">{schema.title || "Connection"}</div> : null}
      {validationSummary ? <div className="mt-2 text-sm text-muted-foreground">{validationSummary}</div> : null}

      <div className="mt-3">
        <label>Authentication</label>
        <FormSelect
          value={selectedMode}
          onChange={(modeId) => {
            setValidationSummary(null);
            onChange(normalizeValueForMode(modeId, value));
          }}
          options={(schema.authModes || []).map((m) => ({ value: m.id, label: m.label || m.id }))}
          allowUnknownValue
        />
        {!isSelectedModeValid && selectedMode ? (
          <div className="mt-1 text-xs text-destructive">
            Authentication mode "{selectedMode}" is invalid for this connector schema.
          </div>
        ) : null}
      </div>

      <div className="mt-3 form-grid">
        {modeFields.map((f) => {
          const key = f.key;
          const raw = asString(value[key]);
          const fieldLabel = resolveFieldLabel(f);
          const label = f.required ? `${fieldLabel} *` : fieldLabel;

          if (f.type === "boolean") {
            const checked = raw.trim().toLowerCase() === "true" || raw.trim() === "1";
            return (
              <div key={key}>
                <div className="toggle-field toggle-field--inline">
                  <div className="toggle-field__label">{label}</div>
                  <Checkbox checked={checked} onCheckedChange={(v) => setValueKey(key, v === true ? "true" : "false")} />
                </div>
              </div>
            );
          }

          if (f.type === "enum") {
            return (
              <div key={key}>
                <label>{label}</label>
                <FormSelect
                  value={raw}
                  onChange={(val) => setValueKey(key, val)}
                  options={(f.enum || []).map((v) => ({ value: v, label: v }))}
                  allowUnknownValue={false}
                />
              </div>
            );
          }

          if (f.type === "textarea") {
            return (
              <div key={key} className="full">
                <label>{label}</label>
                <Textarea rows={3} value={raw} onChange={(e) => setValueKey(key, e.target.value)} placeholder={f.placeholder} />
              </div>
            );
          }

          if (f.type === "number") {
            return (
              <div key={key}>
                <label>{label}</label>
                <Input type="number" inputMode="numeric" value={raw} onChange={(e) => setValueKey(key, e.target.value)} placeholder={f.placeholder} />
              </div>
            );
          }

          if (f.type === "secret") {
            const refPath = secretPathFromRef(raw);
            const draft = secretDrafts[key] ?? "";
            const state = secretState[key] || (refPath ? "checking" : "missing");
            const stateLabel =
              state === "available"
                ? "Secret available"
                : state === "checking"
                  ? "Checking secret..."
                  : state === "error"
                    ? "Secret check failed"
                    : "Secret not set";

            return (
              <div key={key}>
                <label>{label}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={draft}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSecretDrafts((prev) => ({ ...prev, [key]: next }));
                      setValidationSummary(null);
                    }}
                    placeholder={f.placeholder || "Enter secret value"}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void upsertSecretRef(key);
                    }}
                    disabled={!!secretBusy[key]}
                  >
                    {secretBusy[key] ? "Saving..." : "Save"}
                  </Button>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={state === "available" ? "secondary" : state === "error" ? "destructive" : "outline"}>
                    {stateLabel}
                  </Badge>
                  {refPath ? <span className="truncate">ref: {refPath}</span> : null}
                </div>
                {secretError[key] ? <div className="mt-1 text-xs text-destructive">{secretError[key]}</div> : null}
              </div>
            );
          }

          return (
            <div key={key}>
              <label>{label}</label>
              <Input
                type="text"
                value={raw}
                onChange={(e) => setValueKey(key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
