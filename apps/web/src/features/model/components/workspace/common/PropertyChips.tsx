import { useMemo, useState } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, FormSelect } from "@datam8/ui";
import { Tag } from "lucide-react";
import type { PropertyOption } from "../../../model-types";

export type PropertyChipItem = {
  key: string;
  property: string;
  value: string;
  inherited: boolean;
  title: string;
  removeKey: number | string | undefined;
};

type PropertyChipsProps = {
  className?: string;
  items: PropertyChipItem[];
  propertyOptions: PropertyOption[];
  usedPropertyNames?: Set<string>;
  onAdd: (property: string, value: string) => void;
  onRemove?: (removeKey: number | string) => void;
  addLabel?: string;
  addDisabled?: boolean;
};

export const PropertyChips = ({
  className,
  items,
  propertyOptions,
  usedPropertyNames,
  onAdd,
  onRemove,
  addLabel = "Add property",
  addDisabled = false,
}: PropertyChipsProps) => {
  const used = useMemo(
    () => usedPropertyNames ?? new Set(items.filter((i) => !i.inherited).map((i) => i.property)),
    [items, usedPropertyNames],
  );

  const propertyNameOptions = useMemo(
    () =>
      propertyOptions
        .filter((opt) => opt?.name && !used.has(opt.name))
        .map((opt) => ({ value: opt.name, label: opt.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [propertyOptions, used],
  );

  const [open, setOpen] = useState(false);
  const [draftProperty, setDraftProperty] = useState("");
  const [draftValue, setDraftValue] = useState("");

  const currentPropertyOption = useMemo(
    () => propertyOptions.find((opt) => opt.name === draftProperty) || null,
    [propertyOptions, draftProperty],
  );

  const valueOptions = useMemo(
    () => (currentPropertyOption?.values || []).map((v) => ({ value: v, label: v })),
    [currentPropertyOption],
  );

  const resetDraft = () => {
    setDraftProperty("");
    setDraftValue("");
  };

  const addProperty = () => {
    const property = draftProperty.trim();
    if (!property) return;
    onAdd(property, `${draftValue ?? ""}`);
    resetDraft();
    setOpen(false);
  };

  return (
    <div className={["chips", className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <div
          key={item.key}
          className={`chip ${item.inherited ? "chip--inherited" : ""}`}
          title={item.title}
        >
          <span className="chip__label">{item.property}</span>
          <span className="chip__value">{item.value}</span>
          {!item.inherited && onRemove && item.removeKey !== undefined ? (
            <button
              className="chip__remove"
              onClick={() => onRemove(item.removeKey as string | number)}
              aria-label={`Remove ${item.property}`}
            >
              x
            </button>
          ) : null}
        </div>
      ))}
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (addDisabled) return;
          setOpen(next);
          if (!next) resetDraft();
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`chip chip--add ${addDisabled ? "chip--disabled" : ""}`}
            aria-label={addLabel}
            title={addDisabled ? `${addLabel} (unavailable)` : addLabel}
            disabled={addDisabled}
          >
            <Tag className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-2">
          <DropdownMenuLabel>{addLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Property</label>
                <FormSelect
                  value={draftProperty}
                  onChange={(val) => {
                    setDraftProperty(val);
                    setDraftValue("");
                  }}
                  options={[{ value: "", label: "Select" }, ...propertyNameOptions]}
                  placeholder="Select"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Value</label>
                {valueOptions.length ? (
                  <FormSelect
                    value={draftValue}
                    onChange={(val) => setDraftValue(val)}
                    options={[{ value: "", label: "Select" }, ...valueOptions]}
                    placeholder="Select"
                    disabled={!draftProperty}
                  />
                ) : (
                  <input
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    placeholder={draftProperty ? "Value" : "Select property first"}
                    disabled={!draftProperty}
                  />
                )}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  resetDraft();
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" variant="default" onClick={addProperty} disabled={!draftProperty}>
                Add
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
