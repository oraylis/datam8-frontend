import { useFieldArray, type Control } from "react-hook-form";
import { Badge, Button, FormSelect, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@datam8/ui";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { WizardFormValues } from "../schema";

type Props = {
  control: Control<WizardFormValues>;
  dataTypes: string[];
  attributeTypes: string[];
  setValue: (name: `attributes.${number}.dataType` | `attributes.${number}.attributeType`, value: string) => void;
  getValue: (name: `attributes.${number}.dataType` | `attributes.${number}.attributeType`) => string | undefined;
};

export function Step3Attributes({ control, dataTypes, attributeTypes, setValue, getValue }: Props) {
  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: "attributes",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Attributes</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            append({
              name: "",
              dataType: dataTypes[0] || "",
              attributeType: attributeTypes[0] || "",
              nullable: false,
              isKey: false,
              properties: [],
            })
          }
        >
          <Plus className="h-3 w-3 mr-1" /> Add Attribute
        </Button>
      </div>

      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Data Type</TableHead>
              <TableHead>Attribute Type</TableHead>
              <TableHead className="text-center">Nullable</TableHead>
              <TableHead className="text-center">Key</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell>
                  <Input {...control.register(`attributes.${index}.name` as const)} placeholder="Name" />
                </TableCell>
                <TableCell>
                  <FormSelect
                    value={getValue(`attributes.${index}.dataType`)}
                    onChange={(val) => setValue(`attributes.${index}.dataType`, val)}
                    options={dataTypes.map((dt) => ({ value: dt, label: dt }))}
                    placeholder="Data Type"
                  />
                </TableCell>
                <TableCell>
                  <FormSelect
                    value={getValue(`attributes.${index}.attributeType`)}
                    onChange={(val) => setValue(`attributes.${index}.attributeType`, val)}
                    options={attributeTypes.map((at) => ({ value: at, label: at }))}
                    placeholder="Attribute Type"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <input type="checkbox" {...control.register(`attributes.${index}.nullable` as const)} />
                </TableCell>
                <TableCell className="text-center">
                  <input type="checkbox" {...control.register(`attributes.${index}.isKey` as const)} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => swap(index, Math.max(0, index - 1))}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => swap(index, Math.min(fields.length - 1, index + 1))}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {fields.length === 0 ? <Badge variant="outline">No attributes added</Badge> : null}
    </div>
  );
}
