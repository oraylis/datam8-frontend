import { useMemo } from "react";
import { Controller, type Control, type FieldErrors, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { Button, FormSelect, Input, Label, Card, CardContent } from "@datam8/ui";
import { Trash2 } from "lucide-react";
import type { WizardFormValues } from "./schema";
import type { ModelEntity } from "../../model-types";

type RelationshipRowProps = {
  index: number;
  control: Control<WizardFormValues>;
  removeRelationship: (index: number) => void;
  modelEntities: ModelEntity[];
  zones: { name: string; displayName: string; localFolderName: string; targetName: string }[];
  watchedAttributes: { name: string }[];
  errors: FieldErrors<WizardFormValues>;
  watch: UseFormWatch<WizardFormValues>;
  setValue: UseFormSetValue<WizardFormValues>;
};

export const RelationshipRow = ({
  index,
  control,
  removeRelationship,
  modelEntities,
  zones,
  watchedAttributes,
  errors,
  watch,
  setValue,
}: RelationshipRowProps) => {
  const targetZone = watch(`relationships.${index}.targetZone`);
  const targetRelPath = watch(`relationships.${index}.targetRelPath`);

  const targetEntityOptions = useMemo(() => {
    const selectedZoneObj = zones.find((z) => z.name === targetZone);
    const filterFolder = selectedZoneObj?.localFolderName || selectedZoneObj?.targetName || targetZone;

    return modelEntities
      .filter((e) => {
        if (!targetZone) return true;
        const parts = e.relPath.split("/");
        return parts[1] === filterFolder;
      })
      .map((e) => ({ value: e.relPath, label: e.name }));
  }, [modelEntities, targetZone, zones]);

  const targetAttrs = useMemo(() => {
    const targetEntity = modelEntities.find((e) => e.relPath === targetRelPath);
    const attrs = Array.isArray(targetEntity?.content?.attributes) ? targetEntity.content.attributes : [];
    return attrs
      .map((a) => {
        if (!a || typeof a !== "object") return null;
        const name = typeof (a as { name?: unknown }).name === "string" ? (a as { name: string }).name : "";
        if (!name) return null;
        return { value: name, label: name };
      })
      .filter((opt): opt is { value: string; label: string } => opt !== null);
  }, [modelEntities, targetRelPath]);

  return (
    <Card className="entity-wizard__relationship-card">
      <CardContent className="p-4 grid grid-cols-2 gap-4 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => removeRelationship(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <div className="space-y-2">
          <Label>Zone *</Label>
          <Controller
            control={control}
            name={`relationships.${index}.targetZone`}
            render={({ field: f }) => (
              <FormSelect
                value={f.value}
                onChange={(val) => {
                  f.onChange(val);
                  setValue(`relationships.${index}.targetRelPath`, "");
                }}
                options={zones.map((z) => ({ value: z.name, label: z.displayName || z.name }))}
                placeholder="Filter by Zone"
                className={errors.relationships?.[index]?.targetZone ? "border-destructive" : ""}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>Target Entity *</Label>
          <Controller
            control={control}
            name={`relationships.${index}.targetRelPath`}
            render={({ field: f }) => (
              <FormSelect
                value={f.value}
                onChange={(val) => {
                  f.onChange(val);
                  setValue(`relationships.${index}.targetAttribute`, "");
                }}
                options={targetEntityOptions}
                placeholder="Select Entity"
                className={errors.relationships?.[index]?.targetRelPath ? "border-destructive" : ""}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>Source Attribute</Label>
          <Controller
            control={control}
            name={`relationships.${index}.sourceAttribute`}
            render={({ field: f }) => (
              <FormSelect
                value={f.value}
                onChange={f.onChange}
                options={watchedAttributes.map((a) => ({ value: a.name, label: a.name }))}
                placeholder="Select Attribute"
                allowUnknownValue
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>Target Attribute</Label>
          <Controller
            control={control}
            name={`relationships.${index}.targetAttribute`}
            render={({ field: f }) => (
              <FormSelect
                value={f.value}
                onChange={f.onChange}
                options={targetAttrs}
                placeholder="Select Attribute"
                allowUnknownValue
                className={errors.relationships?.[index]?.targetAttribute ? "border-destructive" : ""}
              />
            )}
          />
        </div>
        
      </CardContent>
    </Card>
  );
};
