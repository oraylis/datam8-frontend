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
  const normalizedValue = value ?? "";
  const stringValue = `${normalizedValue}`;
  const safeOptions =
    options && options.length
      ? options
          .map((opt) => ({ ...opt, value: `${opt.value}` }))
          .filter((opt) => opt.value.trim() !== "")
      : [];

  if (allowUnknownValue && stringValue && !safeOptions.some((opt) => opt.value === stringValue)) {
    safeOptions.push({ value: stringValue, label: stringValue });
  }

  const handleValueChange = React.useCallback(
    (next: string) => {
      onChange?.(next);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dm8:form-select-change"));
      }
    },
    [onChange],
  );

  return (
    <Select value={stringValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {safeOptions.map((opt) => (
          <SelectItem key={`${opt.value}`} value={`${opt.value}`}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
