import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  Checkbox,
  FormSelect,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@datam8/ui";
import { IconBtn } from "../common/IconBtn";
import {
  changeArgumentType,
  newArgument,
  type ArgumentEntry,
  type ArgumentType,
} from "./qualityArgumentDraft";

const typeOptions = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "array", label: "List" },
  { value: "object", label: "Object" },
  { value: "null", label: "Null" },
];

function ArgumentRows({
  entries,
  onChange,
  array = false,
  parent = "",
}: {
  entries: ArgumentEntry[];
  onChange: (entries: ArgumentEntry[]) => void;
  array?: boolean;
  parent?: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const update = (index: number, entry: ArgumentEntry) =>
    onChange(entries.map((current, i) => (i === index ? entry : current)));
  const move = (index: number, delta: number) => {
    const next = [...entries];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <div className="quality-argument-rows">
      {entries.map((entry, index) => {
        const path = array
          ? `${parent}[${index}]`
          : parent
            ? `${parent}.${entry.name}`
            : entry.name;
        const container = entry.type === "array" || entry.type === "object";
        const open = !collapsed.has(entry.id);
        const duplicate =
          !array &&
          entries.some(
            (other) => other.id !== entry.id && other.name === entry.name,
          );
        return (
          <div className="quality-argument" key={entry.id}>
            <div className="quality-argument-row">
              <div className="quality-argument-name">
                {container ? (
                  <IconBtn
                    aria-label={`${open ? "Collapse" : "Expand"} ${path}`}
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (open) next.add(entry.id);
                        else next.delete(entry.id);
                        return next;
                      })
                    }
                  >
                    {open ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </IconBtn>
                ) : (
                  <span className="quality-argument-indent" />
                )}
                {array ? (
                  <span className="quality-argument-index">{index + 1}</span>
                ) : (
                  <Input
                    aria-label={`Name of ${parent ? `${parent} field` : "argument"} ${index + 1}`}
                    aria-invalid={duplicate}
                    value={entry.name}
                    onChange={(event) =>
                      update(index, { ...entry, name: event.target.value })
                    }
                    className="font-mono"
                  />
                )}
              </div>
              <FormSelect
                aria-label={`Type for ${path}`}
                value={entry.type}
                allowUnknownValue={false}
                options={typeOptions}
                onChange={(type) =>
                  update(index, changeArgumentType(entry, type as ArgumentType))
                }
              />
              <div className="quality-argument-value">
                {container ? (
                  <span className="quality-argument-summary">
                    {entry.children.length}{" "}
                    {entry.type === "array"
                      ? entry.children.length === 1
                        ? "item"
                        : "items"
                      : entry.children.length === 1
                        ? "field"
                        : "fields"}
                  </span>
                ) : entry.type === "boolean" ? (
                  <label className="quality-boolean">
                    <Checkbox
                      aria-label={`Value for ${path}`}
                      checked={entry.value === "true"}
                      onCheckedChange={(checked) =>
                        update(index, {
                          ...entry,
                          value: String(checked === true),
                        })
                      }
                    />
                    <span>{entry.value === "true" ? "true" : "false"}</span>
                  </label>
                ) : entry.type === "null" ? (
                  <span className="quality-null">null</span>
                ) : entry.type === "string" ? (
                  <Textarea
                    rows={Math.min(
                      5,
                      Math.max(1, entry.value.split("\n").length),
                    )}
                    aria-label={`Value for ${path}`}
                    value={entry.value}
                    onChange={(event) =>
                      update(index, { ...entry, value: event.target.value })
                    }
                    className="quality-argument-text"
                    placeholder="Value"
                  />
                ) : (
                  <Input
                    aria-label={`Value for ${path}`}
                    inputMode={entry.type === "number" ? "decimal" : undefined}
                    value={entry.value}
                    onChange={(event) =>
                      update(index, { ...entry, value: event.target.value })
                    }
                    placeholder={entry.type === "number" ? "0" : "Value"}
                    className={
                      entry.type === "number" ? "font-mono" : undefined
                    }
                  />
                )}
              </div>
              <div className="quality-argument-actions">
                {array && (
                  <>
                    <IconBtn
                      aria-label={`Move ${path} up`}
                      disabled={!index}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </IconBtn>
                    <IconBtn
                      aria-label={`Move ${path} down`}
                      disabled={index === entries.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </IconBtn>
                  </>
                )}
                <IconBtn
                  aria-label={`Remove ${path}`}
                  onClick={() =>
                    onChange(entries.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </div>
            {container && open && (
              <div className="quality-argument-children">
                <ArgumentRows
                  entries={entry.children}
                  onChange={(children) => update(index, { ...entry, children })}
                  array={entry.type === "array"}
                  parent={path}
                />
              </div>
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        variant="ghost"
        className="quality-add-argument"
        onClick={() => onChange([...entries, newArgument(entries, array)])}
      >
        <Plus size={14} />
        {array
          ? `Add item to ${parent}`
          : parent
            ? `Add field to ${parent}`
            : "Add argument"}
      </Button>
    </div>
  );
}

export function QualityArgumentsEditor({
  entries,
  onEntriesChange,
  json,
  onJsonChange,
  mode,
  onModeChange,
  canSwitch,
}: {
  entries: ArgumentEntry[];
  onEntriesChange: (entries: ArgumentEntry[]) => void;
  json: string;
  onJsonChange: (json: string) => void;
  mode: "fields" | "json";
  onModeChange: (mode: "fields" | "json") => void;
  canSwitch: boolean;
}) {
  return (
    <section className="quality-arguments" aria-label="Function arguments">
      <div className="quality-section-heading">
        <div>
          <h3>Arguments</h3>
          <p>Named values passed to the function.</p>
        </div>
        <Tabs
          value={mode}
          onValueChange={(next) => onModeChange(next as "fields" | "json")}
        >
          <TabsList
            aria-label="Argument editor view"
            className="quality-view-tabs"
          >
            <TabsTrigger
              value="fields"
              disabled={mode !== "fields" && !canSwitch}
            >
              Fields
            </TabsTrigger>
            <TabsTrigger value="json" disabled={mode !== "json" && !canSwitch}>
              JSON
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {mode === "json" ? (
        <Textarea
          aria-label="Arguments (JSON object)"
          spellCheck={false}
          className="quality-json-editor font-mono"
          value={json}
          onChange={(event) => onJsonChange(event.target.value)}
        />
      ) : (
        <div className="quality-argument-table">
          <div className="quality-argument-head">
            <span>Name</span>
            <span>Type</span>
            <span>Value</span>
            <span />
          </div>
          {!entries.length && (
            <p className="quality-empty-arguments">
              This function has no arguments yet. Add only the values it needs.
            </p>
          )}
          <ArgumentRows entries={entries} onChange={onEntriesChange} />
        </div>
      )}
    </section>
  );
}
