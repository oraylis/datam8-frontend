import { Controller, useWatch, type Control, type Path } from "react-hook-form";
import { Button, FormSelect, Input } from "@datam8/ui";
import { Trash2 } from "lucide-react";
import type { WizardFormValues } from "./schema";

type PropertyArrayPath = "properties" | `attributes.${number}.properties`;

type PropertyRowProps = {
  index: number;
  control: Control<WizardFormValues>;
  name: PropertyArrayPath;
  remove: (index: number) => void;
  propertyOptions: { name: string; values: string[] }[];
};

export const PropertyRow = ({ index, control, name, remove, propertyOptions }: PropertyRowProps) => {
  const propertyFieldName = `${name}.${index}.property` as Path<WizardFormValues>;
  const valueFieldName = `${name}.${index}.value` as Path<WizardFormValues>;

  const propertyName = useWatch({
    control,
    name: propertyFieldName,
  });

  const selectedOption = propertyOptions.find((p) => p.name === propertyName);
  const values = selectedOption?.values || [];
  const options = values.map((v) => ({ value: v, label: v }));
  const hasOptions = options.length > 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Controller
          control={control}
          name={propertyFieldName}
          render={({ field: f }) => (
            <FormSelect
              value={f.value}
              onChange={(val) => {
                f.onChange(val);
              }}
              options={propertyOptions.map((p) => ({ value: p.name, label: p.name }))}
              placeholder="Property"
              allowUnknownValue
              className="h-8 text-xs"
            />
          )}
        />
      </div>
      <div className="flex-1">
        <Controller
          control={control}
          name={valueFieldName}
          render={({ field: f }) =>
            hasOptions ? (
              <FormSelect
                value={f.value}
                onChange={f.onChange}
                options={options}
                placeholder="Select Value"
                allowUnknownValue
                className="h-8 text-xs"
              />
            ) : (
              <Input {...f} placeholder="Value" className="h-8 text-xs" />
            )
          }
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => remove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
