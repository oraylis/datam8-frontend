import { Controller, type Control } from "react-hook-form";
import { Input, Textarea, FormSelect, Label, Button } from "@datam8/ui";
import { Plus } from "lucide-react";
import type { WizardFormValues } from "../schema";
import { PropertyRow } from "../PropertyRow";
import { useFieldArray } from "react-hook-form";

type Props = {
  control: Control<WizardFormValues>;
  propertyOptions: { name: string; values: string[] }[];
  zones: { name: string; displayName: string; localFolderName: string; targetName: string }[];
  dataProducts: { name: string; displayName: string; dataModules: any[] }[];
  errors: any;
};

export function Step1Metadata({ control, propertyOptions, zones, dataProducts, errors }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "properties",
  });

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Name *</Label>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Input {...field} placeholder="Entity name" className={fieldState.error ? "border-destructive" : ""} />
            )}
          />
          {errors.name ? <div className="text-xs text-destructive">{errors.name.message}</div> : null}
        </div>
        <div className="space-y-1">
          <Label>Display Name</Label>
          <Controller control={control} name="displayName" render={({ field }) => <Input {...field} placeholder="Display name" />} />
        </div>
        <div className="space-y-1">
          <Label>Description</Label>
          <Controller control={control} name="description" render={({ field }) => <Textarea {...field} placeholder="Describe the entity" />} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Zone *</Label>
          <Controller
            control={control}
            name="zoneName"
            render={({ field }) => (
              <FormSelect
                value={field.value}
                onChange={field.onChange}
                options={zones.map((z) => ({ value: z.name, label: z.displayName || z.localFolderName || z.name }))}
                placeholder="Select zone"
                className={errors.zoneName ? "border-destructive" : ""}
              />
            )}
          />
        </div>
        <div className="space-y-1">
          <Label>Data Product *</Label>
          <Controller
            control={control}
            name="productName"
            render={({ field }) => (
              <FormSelect
                value={field.value}
                onChange={field.onChange}
                options={dataProducts.map((p) => ({ value: p.name, label: p.displayName || p.name }))}
                placeholder="Select product"
                className={errors.productName ? "border-destructive" : ""}
              />
            )}
          />
        </div>
        <div className="space-y-1">
          <Label>Data Module *</Label>
          <Controller
            control={control}
            name="moduleName"
            render={({ field }) => {
              const selectedProduct = dataProducts.find((p) => p.name === (control._formValues as any)?.productName);
              const modules = selectedProduct?.dataModules || [];
              const options = modules.map((m: any) => ({ value: m.name, label: m.displayName || m.name }));
              return (
                <FormSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={options}
                  placeholder="Select module"
                  className={errors.moduleName ? "border-destructive" : ""}
                />
              );
            }}
          />
        </div>
      </div>

      <div className="col-span-2">
        <div className="flex items-center justify-between border-b pb-2 mb-2">
          <Label className="text-sm font-medium">Properties</Label>
          <Button variant="ghost" size="sm" onClick={() => append({ property: "", value: "" })}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        {fields.length === 0 && <div className="text-xs text-muted-foreground italic">No properties set.</div>}
        <div className="space-y-2">
          {fields.map((field, index) => (
            <PropertyRow key={field.id} index={index} control={control} name="properties" remove={remove} propertyOptions={propertyOptions} />
          ))}
        </div>
      </div>
    </div>
  );
}
