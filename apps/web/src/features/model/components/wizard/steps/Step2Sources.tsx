import { useFieldArray, type Control } from "react-hook-form";
import { Button, Label } from "@datam8/ui";
import { Plus } from "lucide-react";
import type { WizardFormValues } from "../schema";
import type { ModelEntity, TableMetadata } from "../../../model-types";
import { SourceRow } from "../SourceRow";

type Props = {
  control: Control<WizardFormValues>;
  dataSources: { name: string; type: string; extendedProperties?: any; connector?: any; requiredSecrets?: string[] }[];
  zones: { name: string; displayName: string; localFolderName: string; targetName: string }[];
  modelEntities: ModelEntity[];
  errors: any;
  watch: any;
  setValue: any;
  register: any;
  solutionPath: string;
  onSetMetadata: (idx: number, meta: TableMetadata) => void;
};

export function Step2Sources({
  control,
  dataSources,
  zones,
  modelEntities,
  errors,
  watch,
  setValue,
  register,
  solutionPath,
  onSetMetadata,
}: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "sources",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Sources</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            append({
              type: "external",
              dataSource: "",
              sourceLocation: "",
              sourceAlias: "",
              metadata: undefined,
            })
          }
        >
          <Plus className="h-3 w-3 mr-1" /> Add Source
        </Button>
      </div>

      {fields.length === 0 && <div className="text-xs text-muted-foreground italic">No sources added.</div>}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <SourceRow
            key={field.id}
            index={index}
            control={control}
            removeSource={remove}
            dataSources={dataSources}
            zones={zones}
            modelEntities={modelEntities}
            errors={errors}
            watch={watch}
            setValue={setValue}
            register={register}
            solutionPath={solutionPath}
            onSetMetadata={onSetMetadata}
          />
        ))}
      </div>
    </div>
  );
}
