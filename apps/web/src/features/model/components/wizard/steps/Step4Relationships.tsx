import type { Control } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Button, Label } from "@datam8/ui";
import { Plus } from "lucide-react";
import type { WizardFormValues } from "../schema";
import type { ModelEntity } from "../../../model-types";
import { RelationshipRow } from "../RelationshipRow";

type Props = {
  control: Control<WizardFormValues>;
  modelEntities: ModelEntity[];
  zones: { name: string; displayName: string; localFolderName: string; targetName: string }[];
  dataSources: Array<Record<string, any> & { name: string }>;
  solutionPath: string;
  errors: any;
  watch: any;
  setValue: any;
};

export function Step4Relationships({ control, modelEntities, zones, dataSources, solutionPath, errors, watch, setValue }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "relationships",
  });

  const watchedAttributes = watch("attributes") || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Relationships</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            append({
              type: "internal",
              targetZone: "",
              targetRelPath: "",
              sourceAttribute: "",
              targetAttribute: "",
            })
          }
        >
          <Plus className="h-3 w-3 mr-1" /> Add Relationship
        </Button>
      </div>

      {fields.length === 0 && <div className="text-xs text-muted-foreground italic">No relationships added.</div>}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <RelationshipRow
            key={field.id}
            index={index}
            control={control}
            removeRelationship={remove}
            modelEntities={modelEntities}
            zones={zones}
            dataSources={dataSources}
            solutionPath={solutionPath}
            watchedAttributes={watchedAttributes}
            errors={errors}
            watch={watch}
            setValue={setValue}
          />
        ))}
      </div>
    </div>
  );
}
