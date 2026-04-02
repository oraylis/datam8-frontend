import { useFieldArray, type Control } from "react-hook-form";
import { Button, Label } from "@datam8/ui";
import { Plus } from "lucide-react";
import { PropertyRow } from "./PropertyRow";
import type { WizardFormValues } from "./schema";

type PropertyArrayPath = "properties" | `attributes.${number}.properties`;

type PropertyEditorProps = {
  control: Control<WizardFormValues>;
  name: PropertyArrayPath;
  propertyOptions: { name: string; values: string[] }[];
};

export const PropertyEditor = ({ control, name, propertyOptions }: PropertyEditorProps) => {
  const { fields, append, remove } = useFieldArray<WizardFormValues, PropertyArrayPath>({
    control,
    name,
  });

  return (
    <div className="space-y-2 mt-4">
      <div className="flex items-center justify-between border-b pb-2">
        <Label className="text-sm font-medium">Properties</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => append({ property: "", value: "" })}
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {fields.length === 0 && <div className="text-xs text-muted-foreground italic">No properties set.</div>}
      <div className="space-y-2">
        {fields.map((field, index) => (
          <PropertyRow
            key={field.id}
            index={index}
            control={control}
            name={name}
            remove={remove}
            propertyOptions={propertyOptions}
          />
        ))}
      </div>
    </div>
  );
};
