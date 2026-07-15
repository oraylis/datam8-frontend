import { useMemo } from "react";
import { Controller, type Control, type FieldErrors, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { Badge, Button, Card, CardContent, FormSelect, Input, Label } from "@datam8/ui";
import { Trash2 } from "lucide-react";
import type { ModelEntity, TableMetadata } from "../../model-types";
import type { WizardFormValues } from "./schema";
import { ExternalSourceConfigurator } from "./SourceRow";
import { resolveSourceOverride } from "./sourceOverride";

type WizardDataSource = Record<string, any> & { name: string };

type RelationshipRowProps = {
  index: number;
  control: Control<WizardFormValues>;
  removeRelationship: (index: number) => void;
  modelEntities: ModelEntity[];
  zones: { name: string; displayName: string; localFolderName: string; targetName: string }[];
  dataSources: WizardDataSource[];
  solutionPath: string;
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
  dataSources,
  solutionPath,
  watchedAttributes,
  errors,
  watch,
  setValue,
}: RelationshipRowProps) => {
  const relationshipType = (watch(`relationships.${index}.type`) || "internal") as "internal" | "external";
  const targetZone = watch(`relationships.${index}.targetZone`);
  const targetRelPath = watch(`relationships.${index}.targetRelPath`);
  const currentDataSourceName = watch(`relationships.${index}.dataSource`) as string | undefined;
  const currentTargetLocation = watch(`relationships.${index}.targetLocation`) as string | undefined;
  const currentMetadata = watch(`relationships.${index}.metadata`) as TableMetadata | undefined;

  const currentDataSourceObj = useMemo(
    () => dataSources.find((d) => d.name === currentDataSourceName),
    [dataSources, currentDataSourceName],
  );

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
    if (relationshipType === "external") {
      const columns = Array.isArray(currentMetadata?.columns) ? currentMetadata.columns : [];
      return columns
        .map((column) => (typeof column?.name === "string" && column.name ? { value: column.name, label: column.name } : null))
        .filter((opt): opt is { value: string; label: string } => opt !== null);
    }
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
  }, [currentMetadata, modelEntities, relationshipType, targetRelPath]);

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

        <div className="col-span-2 flex items-center gap-3 pr-8">
          <Badge variant={relationshipType === "internal" ? "secondary" : "default"}>
            {relationshipType === "internal" ? "Internal" : "External"}
          </Badge>
          <Controller
            control={control}
            name={`relationships.${index}.type`}
            render={({ field: f }) => (
              <FormSelect
                value={f.value || "internal"}
                onChange={(val) => {
                  f.onChange(val);
                  setValue(`relationships.${index}.targetZone`, "");
                  setValue(`relationships.${index}.targetRelPath`, "");
                  setValue(`relationships.${index}.dataSource`, "");
                  setValue(`relationships.${index}.targetLocation`, "");
                  setValue(`relationships.${index}.metadata`, undefined);
                  setValue(`relationships.${index}.targetAttribute`, "");
                }}
                options={[
                  { value: "internal", label: "Internal relationship" },
                  { value: "external", label: "External relationship" },
                ]}
              />
            )}
          />
        </div>

        {relationshipType === "internal" ? (
          <>
            <div className="space-y-2">
              <Label>Zone *</Label>
              <Controller
                control={control}
                name={`relationships.${index}.targetZone`}
                render={({ field: f }) => (
                  <FormSelect
                    value={f.value || ""}
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
                    value={f.value || ""}
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
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Data Source *</Label>
              <Controller
                control={control}
                name={`relationships.${index}.dataSource`}
                render={({ field: f }) => (
                  <FormSelect
                    value={f.value || ""}
                    onChange={(val) => {
                      f.onChange(val);
                      setValue(`relationships.${index}.targetLocation`, "");
                      setValue(`relationships.${index}.metadata`, undefined);
                      setValue(`relationships.${index}.targetAttribute`, "");
                    }}
                    options={dataSources.map((d) => ({ value: d.name, label: d.name }))}
                    placeholder="Select Data Source"
                    className={errors.relationships?.[index]?.dataSource ? "border-destructive" : ""}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Location *</Label>
              <Controller
                control={control}
                name={`relationships.${index}.targetLocation`}
                render={({ field: f }) => (
                  <Input
                    value={f.value || ""}
                    onChange={(event) => f.onChange(event.target.value)}
                    placeholder="Table/View/API Path"
                    className={errors.relationships?.[index]?.targetLocation ? "border-destructive" : ""}
                  />
                )}
              />
            </div>
            <div className="col-span-2">
              <ExternalSourceConfigurator
                dataSource={currentDataSourceName || ""}
                dataSourceObject={currentDataSourceObj as any}
                solutionPath={solutionPath}
                selectedTable={currentTargetLocation}
                onTableSelected={(table, meta) => {
                  const resolved = resolveSourceOverride({
                    sourceOverride: meta.sourceOverride,
                    fallbackDataSource: currentDataSourceName,
                    fallbackLocation: table,
                    dataSources,
                  });
                  setValue(`relationships.${index}.dataSource`, resolved.dataSource);
                  setValue(`relationships.${index}.targetLocation`, `${resolved.sourceLocation || ""}`);
                  setValue(`relationships.${index}.metadata`, meta);
                  setValue(`relationships.${index}.targetAttribute`, "");
                }}
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Source Attribute</Label>
          <Controller
            control={control}
            name={`relationships.${index}.sourceAttribute`}
            render={({ field: f }) => (
              <FormSelect
                value={f.value || ""}
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
              relationshipType === "external" ? (
                <>
                  <Input
                    value={f.value || ""}
                    list={`wizard-relationship-${index}-target-attrs`}
                    onChange={(event) => f.onChange(event.target.value)}
                    placeholder="Target Attribute"
                    className={errors.relationships?.[index]?.targetAttribute ? "border-destructive" : ""}
                  />
                  {targetAttrs.length ? (
                    <datalist id={`wizard-relationship-${index}-target-attrs`}>
                      {targetAttrs.map((opt) => (
                        <option key={opt.value} value={opt.value} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              ) : (
                <FormSelect
                  value={f.value || ""}
                  onChange={f.onChange}
                  options={[
                    ...targetAttrs,
                    ...(f.value && !targetAttrs.some((opt) => opt.value === f.value) ? [{ value: f.value, label: f.value }] : []),
                  ]}
                  placeholder="Select Attribute"
                  allowUnknownValue
                  className={errors.relationships?.[index]?.targetAttribute ? "border-destructive" : ""}
                />
              )
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};
