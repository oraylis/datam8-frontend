import type React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@datam8/ui";
import { Trash2 } from "lucide-react";
import type { PropertyOption } from "../../../model-types";

export type PropertyListRow = {
  id?: string | number;
  property: string;
  value: string;
  inherited?: boolean;
};

export type PropertyListProps = {
  title?: string;
  properties: PropertyListRow[];
  propertyOptions?: PropertyOption[];
  onChange: (rows: PropertyListRow[]) => void;
  allowFreeValue?: boolean;
  disabled?: boolean;
  addLabel?: string;
  addDisabled?: boolean;
  onAdd?: () => void;
  className?: string;
  contentClassName?: string;
  maxHeight?: string;
  scrollable?: boolean;
  emptyLabel?: string;
  renderPropertyInput?: (args: { row: PropertyListRow; index: number; onChange: (val: string) => void; setProperty: (val: string) => void }) => React.ReactNode;
  renderValueInput?: (args: { row: PropertyListRow; index: number; onChange: (val: string) => void }) => React.ReactNode;
  renderActions?: (args: { row: PropertyListRow; index: number; onRemove: () => void }) => React.ReactNode;
};

const fallbackId = (row: PropertyListRow, idx: number) => row.id ?? `${row.property || "prop"}-${idx}`;

export const PropertyList = ({
  title,
  properties,
  propertyOptions = [],
  onChange,
  allowFreeValue = true,
  disabled,
  addLabel = "Add property",
  addDisabled,
  onAdd,
  className,
  contentClassName,
  maxHeight,
  scrollable,
  emptyLabel = "No properties yet.",
  renderPropertyInput,
  renderValueInput,
  renderActions,
}: PropertyListProps) => {
  const valueOptionsFor = (propName: string) => propertyOptions.find((opt) => opt.name === propName)?.values || [];

  const updateRow = (idx: number, next: Partial<PropertyListRow>) => {
    onChange(properties.map((row, i) => (i === idx ? { ...row, ...next } : row)));
  };

  const handlePropertyChange = (idx: number, propName: string) => {
    const values = valueOptionsFor(propName);
    const nextValue = values.length ? values[0] : allowFreeValue ? "" : "";
    updateRow(idx, { property: propName, value: nextValue });
  };

  const handleValueChange = (idx: number, val: string) => updateRow(idx, { value: val });

  const handleRemove = (idx: number) => onChange(properties.filter((_, i) => i !== idx));

  const defaultAdd = () => {
    if (!propertyOptions.length) return;
    const first = propertyOptions[0];
    const val = (first.values || [])[0] || "";
    onChange([...properties, { property: first.name, value: val }]);
  };

  const rowsContent = (
    <div className={cn("space-y-2", contentClassName)}>
      {properties.length === 0 ? <div className="text-sm text-muted-foreground">{emptyLabel}</div> : null}
      {properties.map((row, idx) => {
        const valueOptions = valueOptionsFor(row.property);
        const hasValueOptions = valueOptions.length > 0;
        const propertyChoices = [...propertyOptions.map((opt) => opt.name)];
        const showPropertyFallback = row.property && !propertyChoices.includes(row.property);
        const showValueFallback = row.value && !valueOptions.includes(row.value);
        const rowId = fallbackId(row, idx);
        return (
          <div
            key={rowId}
            className="rounded-lg border border-border/70 bg-card/60 p-3"
            aria-disabled={row.inherited || disabled}
          >
            <div className="grid grid-cols-[1.5fr_1.5fr_auto] items-center gap-2">
              <div>
                {renderPropertyInput ? (
                  renderPropertyInput({
                    row,
                    index: idx,
                    onChange: (val) => handlePropertyChange(idx, val),
                    setProperty: (val) => updateRow(idx, { property: val }),
                  })
                ) : (
                  <Select
                    value={row.property || ""}
                    onValueChange={(val) => handlePropertyChange(idx, val)}
                    disabled={row.inherited || disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyOptions.map((opt) => (
                        <SelectItem key={opt.name} value={opt.name}>
                          {opt.name}
                        </SelectItem>
                      ))}
                      {showPropertyFallback ? (
                        <SelectItem value={row.property}>{row.property}</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                {renderValueInput ? (
                  renderValueInput({
                    row,
                    index: idx,
                    onChange: (val) => handleValueChange(idx, val),
                  })
                ) : hasValueOptions ? (
                  <Select
                    value={row.value || ""}
                    onValueChange={(val) => handleValueChange(idx, val)}
                    disabled={row.inherited || disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      {valueOptions.map((val) => (
                        <SelectItem key={val} value={val}>
                          {val}
                        </SelectItem>
                      ))}
                      {showValueFallback ? (
                        <SelectItem value={row.value}>{row.value}</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                ) : allowFreeValue ? (
                  <Input
                    value={row.value || ""}
                    onChange={(e) => handleValueChange(idx, e.target.value)}
                    placeholder="Enter value"
                    disabled={row.inherited || disabled}
                  />
                ) : (
                  <Select
                    value={row.value || ""}
                    onValueChange={(val) => handleValueChange(idx, val)}
                    disabled={row.inherited || disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      {showValueFallback && row.value ? (
                        <SelectItem value={row.value}>{row.value}</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                {renderActions ? (
                  renderActions({ row, index: idx, onRemove: () => handleRemove(idx) })
                ) : row.inherited ? (
                  <span className="text-xs text-muted-foreground">Inherited</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(idx)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const addBtn = (
    <Button
      variant="outline"
      size="sm"
      onClick={onAdd || defaultAdd}
      disabled={disabled || addDisabled || (!onAdd && propertyOptions.length === 0)}
    >
      {addLabel}
    </Button>
  );

  const shouldScroll = scrollable || !!maxHeight;

  return (
    <Card className={cn("dm8-framed-card", className)}>
      {title ? (
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {addBtn}
        </CardHeader>
      ) : (
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
          <div className="text-sm font-medium text-foreground">Properties</div>
          {addBtn}
        </div>
      )}
      <CardContent className="pt-4">
        {shouldScroll ? (
          <ScrollArea className={maxHeight || "max-h-80"}>
            <div className="pr-2">{rowsContent}</div>
          </ScrollArea>
        ) : (
          rowsContent
        )}
      </CardContent>
    </Card>
  );
};
