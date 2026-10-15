import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export type FormSelectOption = { label: string; value: string };

export interface FormSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowUnknownValue?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  allowUnknownValue = true,
}) => {
  const [open, setOpen] = React.useState(false);
  const normalizedValue = value ?? "";
  const stringValue = `${normalizedValue}`;
  const selectedLabel = React.useMemo(() => {
    if (!stringValue) return "";
    const match = options?.find((opt) => `${opt.value}` === stringValue);
    return match?.label ?? (allowUnknownValue ? stringValue : "");
  }, [allowUnknownValue, options, stringValue]);

  const safeOptions = React.useMemo(() => {
    if (!open) return [];
    const next =
      options && options.length
        ? options
            .map((opt) => ({ ...opt, value: `${opt.value}` }))
            .filter((opt) => opt.value.trim() !== "")
        : [];

    if (allowUnknownValue && stringValue && !next.some((opt) => opt.value === stringValue)) {
      next.push({ value: stringValue, label: stringValue });
    }

    return next;
  }, [allowUnknownValue, open, options, stringValue]);

  const handleValueChange = React.useCallback(
    (next: string) => {
      onChange?.(next);
    },
    [onChange],
  );

  return (
    <Select value={stringValue} onValueChange={handleValueChange} disabled={disabled} open={open} onOpenChange={setOpen}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>{selectedLabel || undefined}</SelectValue>
      </SelectTrigger>
      {open ? (
        <SelectContent>
          {safeOptions.map((opt) => (
            <SelectItem key={`${opt.value}`} value={`${opt.value}`}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      ) : null}
    </Select>
  );
};
