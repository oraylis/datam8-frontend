import { useState, useMemo, useEffect } from "react";
import { useForm, useFieldArray, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Textarea,
  FormSelect,
  ScrollArea,
  Separator,
  Card,
  CardContent,
  Label,
  Checkbox,
  cn,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@datam8/ui";
import { Trash2, Plus, ArrowLeft, ArrowRight, Check, Loader2, AlertCircle } from "lucide-react";
import { useModelEditor } from "../ModelEditorContext";
import { useSolution } from "../../solution/SolutionContext";
import {
  wizardSchema,
  type WizardFormValues,
} from "./wizard/schema";
import { PropertyEditor } from "./wizard/PropertyEditor";
import { RelationshipRow } from "./wizard/RelationshipRow";
import { SourceRow } from "./wizard/SourceRow";
import { FolderHierarchyPicker, type FolderHierarchyItem } from "./wizard/FolderHierarchyPicker";
import { useWizardSubmit } from "./wizard/useWizardSubmit";
import { useWizardBaseData } from "./wizard/useWizardBaseData";
import { apiBase } from "../../../config";
import { readBackendErrorMessage } from "../../../shared/api/errorMessage";
import { ErrorSurfaceHost, useErrorSurface } from "../../../shared/ui/ErrorSurface";
import { SourceTablePreviewDialog } from "./wizard/SourceTablePreviewDialog";
import type { SourcePreviewTableRef } from "./wizard/sourcePreview";

// --- Main Component ---

interface CreateModelEntityWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderHierarchyItems: FolderHierarchyItem[];
}

const normalizeFolderPath = (path: string) =>
  (path || "").split(/[\\/]/).join("/").replace(/^\/+|\/+$/g, "");

export function CreateModelEntityWizard({
  open,
  onOpenChange,
  folderHierarchyItems,
}: CreateModelEntityWizardProps) {
  const {
    modelEntities,
    baseEntities,
    setModelEntities,
    openModelTab,
    focusEntityTab,
    setActiveWorkTab,
    setSelectedRelPath,
    setExpanded,
  } = useModelEditor();
  
  const { solutionPath } = useSolution();
  const { showError, clearError } = useErrorSurface();
  const [step, setStep] = useState(1);
  
  // Bulk Mode States
  const [availableTables, setAvailableTables] = useState<{ name: string; schema?: string }[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTable, setPreviewTable] = useState<SourcePreviewTableRef | null>(null);

  const { zones, dataSources, dataTypes, attributeTypes, propertyOptions, dataSourcesResolved } =
    useWizardBaseData(baseEntities);

  const zoneScopedFolderHierarchyItems = useMemo(() => {
    const zoneRoots = zones
      .map((zone) => normalizeFolderPath(zone.localFolderName || ""))
      .filter(Boolean);
    if (!zoneRoots.length) return folderHierarchyItems;

    const itemsByValue = new Map<string, FolderHierarchyItem>();
    folderHierarchyItems.forEach((item) => {
      const normalizedValue = normalizeFolderPath(item.value || "");
      if (!normalizedValue) return;
      const inZoneTree = zoneRoots.some((root) => normalizedValue === root || normalizedValue.startsWith(`${root}/`));
      if (inZoneTree) {
        itemsByValue.set(normalizedValue, { ...item, value: normalizedValue });
      }
    });

    zoneRoots.forEach((root) => {
      if (itemsByValue.has(root)) return;
      const matchingZone = zones.find((zone) => normalizeFolderPath(zone.localFolderName || "") === root);
      const fallbackLabel = root.split("/").pop() || root;
      itemsByValue.set(root, {
        value: root,
        label: matchingZone?.displayName?.trim() || matchingZone?.name?.trim() || fallbackLabel,
      });
    });

    return Array.from(itemsByValue.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [folderHierarchyItems, zones]);

  const defaultValues = useMemo<WizardFormValues>(
    () => ({
      creationMode: "manual",
      name: "",
      displayName: "",
      description: "",
      folderPath: "",
      zoneName: "",
      productName: "",
      moduleName: "",
      properties: [],
      sources: [],
      attributes: [],
      relationships: [],
      selectedTables: [],
      tableRenames: {},
    }),
    [],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema) as any,
    defaultValues,
    mode: "onChange",
  });

  const { fields: sourceFields, append: appendSource, remove: removeSource } = useFieldArray({
    control,
    name: "sources",
  });

  const {
    fields: attributeFields,
    append: appendAttribute,
    remove: removeAttribute,
  } = useFieldArray({
    control,
    name: "attributes",
  });

  const {
    fields: relationshipFields,
    append: appendRelationship,
    remove: removeRelationship,
  } = useFieldArray({
    control,
    name: "relationships",
  });

  const creationMode = watch("creationMode");
  const watchedFolderPath = watch("folderPath");
  const watchedName = watch("name");
  const watchedAttributes = watch("attributes");
  const selectedSource = watch("selectedSource");
  const watchedSelectedTables = watch("selectedTables");
  const selectedTables = useMemo(() => watchedSelectedTables || [], [watchedSelectedTables]);
  const watchedTableRenames = watch("tableRenames");
  const tableRenames = useMemo(() => watchedTableRenames || {}, [watchedTableRenames]);
  const duplicates = useMemo(() => {
    if (creationMode !== "from-source" || !watchedFolderPath) return new Set<string>();

    const duplicateNames = new Set<string>();
    
    selectedTables.forEach(table => {
        const entityName = tableRenames[table] || table.replace(/^\[.*\]\.\[(.*)\]$/, "$1").replace(/^\[|\]$/g, "");
        const relPath = `Model/${watchedFolderPath}/${entityName}.json`;
        
        // Case-insensitive check for path uniqueness
        if (modelEntities.some(e => e.relPath.toLowerCase() === relPath.toLowerCase())) {
            duplicateNames.add(table);
        }
    });
    
    return duplicateNames;
  }, [creationMode, modelEntities, selectedTables, tableRenames, watchedFolderPath]);

  // Reset tables when source changes
  useEffect(() => {
    if (creationMode === "from-source") {
        setAvailableTables([]);
        setPreviewOpen(false);
        setPreviewTable(null);
    }
  }, [creationMode, selectedSource]);

  const handleFetchTables = async () => {
        if (!selectedSource) return;
        setIsLoadingTables(true);
        try {
            const res = await fetch(`${apiBase}/sources/${selectedSource}/tables`, { method: "GET" });

            if (!res.ok) {
                 const data = await res.json().catch(() => ({}));
                 const msg = readBackendErrorMessage(data, "Failed to load tables");
                 throw new Error(msg);
            }
            
            const data = await res.json();
            setAvailableTables(Array.isArray(data?.items) ? data.items : []);
        } catch (err) {
            showError("dialog:create-entity-wizard", { title: "Error loading tables", description: (err as Error).message });
        } finally {
            setIsLoadingTables(false);
        }
  };

  // --- Step Navigation & Validation ---
  const nextStep = async () => {
    let valid = false;
    if (step === 1) {
      if (creationMode === "manual") {
          valid = await trigger(["name", "folderPath"]);
          if (valid) {
            // Custom validation: Duplicate check
            const isDuplicate = modelEntities.some((e) => {
              const normalized = e.relPath.split(/[\\/]/).join("/");
              const expected = `Model/${(watchedFolderPath || "").replace(/^\/+|\/+$/g, "")}/${watchedName}.json`;
              return normalized.toLowerCase() === expected.toLowerCase();
                        });
            if (isDuplicate) {
              setError("name", {
                type: "validate",
                message: "Entity already exists in this location.",
              });
              return;
            }
          }
      } else {
          // Bulk Mode Step 1 Validation
          valid = await trigger(["selectedSource", "selectedTables"]);
      }
    } else if (step === 2) {
       if (creationMode === "manual") {
           valid = true; // Sources are optional
       } else {
           // Bulk Mode Step 2: Target folder
           valid = await trigger(["folderPath"]);
       }
    } else {
      valid = true;
    }

    if (valid) setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // Clear duplicate error when fields change
  useEffect(() => {
    if (errors.name?.type === "validate") {
      clearErrors("name");
    }
  }, [watchedFolderPath, watchedName, clearErrors, errors.name]);

  const { submit, isSubmitting } = useWizardSubmit({
      modelEntities,
      setModelEntities,
      openModelTab,
      focusEntityTab,
      setActiveWorkTab,
      setSelectedRelPath,
      setExpanded,
      solutionPath,
      dataSources: dataSourcesResolved,
      canonicalDataTypes: dataTypes,
  });

  const onSubmit: SubmitHandler<WizardFormValues> = (data) => {
      submit(data, () => onOpenChange(false));
  };

  useEffect(() => {
    if (!open) {
      setStep(1);
      reset(defaultValues);
      setAvailableTables([]);
      clearError("dialog:create-entity-wizard");
    }
  }, [clearError, defaultValues, open, reset]);

  // --- Render Steps ---

  const renderStepIndicator = () => (
    <div className="entity-wizard__step-row">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-2">
          {/* Hide Step 4 for Bulk if we want to finish at 3, but let's keep consistency for now */}
          {(creationMode === "manual" || s <= 3) && (
              <>
                <div
                    className={cn(
                    "entity-wizard__step-circle",
                    step === s
                        ? "is-active"
                        : step > s
                        ? "is-done"
                        : "is-pending",
                    )}
                >
                    {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                <span
                    className={cn(
                    "entity-wizard__step-label",
                    step === s ? "is-active" : "is-muted",
                    )}
                >
                    {s === 1
                    ? (creationMode === "manual" ? "Overview" : "Source")
                    : s === 2
                        ? (creationMode === "manual" ? "Sources" : "Target")
                        : s === 3
                        ? (creationMode === "manual" ? "Attributes" : "Review")
                        : "Relationships"}
                </span>
                {s < (creationMode === "manual" ? 4 : 3) && <Separator className="entity-wizard__step-separator" />}
              </>
          )}
        </div>
      ))}
    </div>
  );

  const filteredTables = useMemo(() => {
     if (!tableSearch) return availableTables;
     return availableTables.filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()));
  }, [availableTables, tableSearch]);

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="entity-wizard flex h-[84vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border/75 px-6 py-5">
          <DialogTitle>Create Model Entity</DialogTitle>
          <DialogDescription>Add new entities to your data model.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="entity-wizard__steps-wrap border-b border-border/70 px-6 py-3">
            <div className="mx-auto max-w-3xl">{renderStepIndicator()}</div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              
              {step === 1 && (
                <Tabs value={creationMode} onValueChange={(v) => setValue("creationMode", v === "from-source" ? "from-source" : "manual")}>
                    <TabsList className="entity-wizard__mode-switch mb-4">
                        <TabsTrigger className="entity-wizard__mode-trigger" value="manual">Manual Creation</TabsTrigger>
                        <TabsTrigger className="entity-wizard__mode-trigger" value="from-source">Import from Source</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="manual" className="entity-wizard__tabs-content space-y-4">
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                <Label>Name *</Label>
                                <Input
                                    {...register("name")}
                                    placeholder="EntityName"
                                    className={errors.name ? "border-destructive" : ""}
                                    disabled={isSubmitting}
                                />
                                {errors.name && (
                                    <p className="text-destructive text-xs">{errors.name.message}</p>
                                )}
                                </div>
                                <div className="space-y-2">
                                <Label>Display Name</Label>
                                <Input {...register("displayName")} placeholder="Readable Name" disabled={isSubmitting} />
                                </div>
                                <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    {...register("description")}
                                    placeholder="Describe this entity..."
                                    rows={5}
                                    disabled={isSubmitting}
                                />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                <Label>Target Folder *</Label>
                                <Controller
                                    control={control}
                                    name="folderPath"
                                    render={({ field }) => (
                                      <FolderHierarchyPicker
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        folderItems={zoneScopedFolderHierarchyItems}
                                        disabled={isSubmitting}
                                        panelClassName="entity-wizard__target-folder-surface"
                                        scrollClassName="entity-wizard__target-folder-scroll"
                                      />
                                    )}
                                />
                                {errors.folderPath && (
                                    <p className="text-destructive text-xs">{errors.folderPath.message}</p>
                                )}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <PropertyEditor control={control} name="properties" propertyOptions={propertyOptions} />
                            </div>
                         </div>
                    </TabsContent>

                    <TabsContent value="from-source" className="entity-wizard__tabs-content space-y-4">
                        <div className="space-y-2">
                            <Label>Source System *</Label>
                            <Controller
                                control={control}
                                name="selectedSource"
                                render={({ field }) => (
                                    <FormSelect
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={dataSources.map((d) => ({ value: d.name, label: d.name }))}
                                        placeholder="Select a Data Source"
                                        className={errors.selectedSource ? "border-destructive" : ""}
                                        disabled={isSubmitting}
                                    />
                                )}
                            />
                            {errors.selectedSource && (
                                <p className="text-destructive text-xs">{errors.selectedSource.message}</p>
                            )}
                        </div>
                        
                        {selectedSource ? (
                             <div className="codex-popup-section entity-wizard__panel space-y-4 p-4">
                                <div className="flex items-center justify-between pt-2">
                                    <Label>Available Tables</Label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative w-48">
                                            <Input 
                                                placeholder="Search tables..." 
                                                className="h-9" 
                                                value={tableSearch}
                                                onChange={e => setTableSearch(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            variant="secondary"
                                            onClick={handleFetchTables}
                                            disabled={isLoadingTables}
                                        >
                                            {isLoadingTables ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                            Load Tables
                                        </Button>
                                    </div>
                                </div>
                                
                                {availableTables.length > 0 && (
                                    <ScrollArea className="codex-popup-scroll h-[220px]">
                                        <div className="p-2 space-y-1">
                                            {filteredTables.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-muted-foreground">No tables found.</div>
                                            ) : (
                                                filteredTables.map(table => {
                                                    const uniqueName = table.schema ? `[${table.schema}].[${table.name}]` : table.name;
                                                    return (
                                                    <div key={uniqueName} className="flex items-center space-x-2 rounded-md p-2 transition-colors hover:bg-foreground/6">
                                                        <Checkbox 
                                                            checked={selectedTables.includes(uniqueName)}
                                                            onCheckedChange={(checked) => {
                                                                const current = selectedTables;
                                                                if (checked) setValue("selectedTables", [...current, uniqueName]);
                                                                else setValue("selectedTables", current.filter(t => t !== uniqueName));
                                                            }}
                                                        />
                                                        <Label className="text-sm font-normal cursor-pointer flex-1">
                                                            {table.schema ? `${table.schema}.${table.name}` : table.name}
                                                        </Label>
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() => {
                                                            setPreviewTable({ schema: table.schema, name: table.name });
                                                            setPreviewOpen(true);
                                                          }}
                                                        >
                                                          Preview
                                                        </Button>
                                                    </div>
                                                )})
                                            )}
                                        </div>
                                    </ScrollArea>
                                )}
                                <div className="text-xs text-muted-foreground">
                                    {selectedTables.length} tables selected.
                                </div>
                                {errors.selectedTables && (
                                    <p className="text-destructive text-xs">{errors.selectedTables.message}</p>
                                )}
                            </div>
                        ) : null}

                    </TabsContent>
                </Tabs>
              )}

              {step === 2 && creationMode === "manual" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Sources</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          appendSource({
                            type: "internal",
                            internalZone: "",
                            internalEntityRelPath: "",
                          })
                        }
                        disabled={isSubmitting}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Internal
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          appendSource({
                            type: "external",
                            dataSource: "",
                            sourceLocation: "",
                            sourceAlias: "",
                          })
                        }
                        disabled={isSubmitting}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add External
                      </Button>
                    </div>
                  </div>
                  {sourceFields.length === 0 && (
                    <div className="text-[13px] italic text-muted-foreground">No sources added.</div>
                  )}
                  {sourceFields.map((field, index) => (
                    <SourceRow
                      key={field.id}
                      index={index}
                      control={control}
                      removeSource={removeSource}
                      dataSources={dataSourcesResolved}
                      zones={zones}
                      modelEntities={modelEntities}
                      errors={errors}
                      watch={watch}
                      setValue={setValue}
                      register={register}
                      solutionPath={solutionPath || ""}
                      onSetMetadata={(idx, meta) => {
                          // Simplified manual logic, ideally we would use sanitizeDataType too here
                          const newAttrs = meta.columns.map((col) => {
                              let dataType = "string";
                              const sql = col.dataType.toLowerCase();
                              if (sql.includes("int")) dataType = "int";
                              else if (sql.includes("char") || sql.includes("text")) dataType = "string";
                              else if (sql.includes("date") || sql.includes("time")) dataType = "datetime";
                              else if (sql.includes("decimal") || sql.includes("money") || sql.includes("numeric")) dataType = "decimal";
                              else if (sql.includes("bit") || sql.includes("bool")) dataType = "boolean";
                              else if (sql.includes("float") || sql.includes("double") || sql.includes("real")) dataType = "double";

                              return {
                                  name: col.name,
                                  dataType: dataType,
                                  attributeType: "Regular", // Default
                                  nullable: col.isNullable,
                                  isKey: col.isPrimaryKey,
                                  properties: []
                              };
                          });
                          setValue("attributes", newAttrs);
                      }}
                    />
                  ))}
                </div>
              )}

              {step === 2 && creationMode === "from-source" && (
                   <div className="codex-popup-section entity-wizard__panel space-y-4 p-4">
                        <h3 className="text-lg font-medium">Target Location</h3>
                        <p className="text-sm text-muted-foreground mb-4">Select where the imported entities should be created.</p>
                        <div className="space-y-2">
                          <Label>Target Folder *</Label>
                          <Controller
                            control={control}
                            name="folderPath"
                            render={({ field }) => (
                              <FolderHierarchyPicker
                                value={field.value || ""}
                                onChange={field.onChange}
                                folderItems={zoneScopedFolderHierarchyItems}
                                disabled={isSubmitting}
                                panelClassName="entity-wizard__target-folder-surface"
                                scrollClassName="entity-wizard__target-folder-scroll"
                              />
                            )}
                          />
                          {errors.folderPath ? <p className="text-destructive text-xs">{errors.folderPath.message}</p> : null}
                        </div>
                   </div>
              )}

              {step === 3 && creationMode === "manual" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Attributes</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendAttribute({
                          name: "",
                          dataType: "",
                          attributeType: "",
                          nullable: true,
                          isKey: false,
                        })
                      }
                      disabled={isSubmitting}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Attribute
                    </Button>
                  </div>
                  {attributeFields.length === 0 && (
                    <div className="text-[13px] italic text-muted-foreground">No attributes added.</div>
                  )}
                  <div className="space-y-3">
                    {attributeFields.map((field, index) => (
                      <Card key={field.id} className="entity-wizard__attribute-card">
                        <CardContent className="p-3 flex items-start gap-3">
                           {/* Existing Attribute Editor Content - simplified for brevity, kept structure */}
                           <div className="flex-1 grid grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Input
                                {...register(`attributes.${index}.name`)}
                                className="h-8"
                                disabled={isSubmitting}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Data Type</Label>
                              <Controller
                                control={control}
                                name={`attributes.${index}.dataType`}
                                render={({ field: f }) => (
                                  <FormSelect
                                    value={f.value}
                                    onChange={f.onChange}
                                    options={dataTypes.map((t: string) => ({ value: t, label: t }))}
                                    className="h-8"
                                    disabled={isSubmitting}
                                  />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Attribute Type</Label>
                              <Controller
                                control={control}
                                name={`attributes.${index}.attributeType`}
                                render={({ field: f }) => (
                                  <FormSelect
                                    value={f.value}
                                    onChange={f.onChange}
                                    options={attributeTypes.map((t: string) => ({
                                      value: t,
                                      label: t,
                                    }))}
                                    className="h-8"
                                    disabled={isSubmitting}
                                  />
                                )}
                              />
                            </div>
                            <div className="flex items-center gap-3 pt-5">
                              <div className="flex items-center space-x-2">
                                <Controller
                                  control={control}
                                  name={`attributes.${index}.nullable`}
                                  render={({ field: f }) => (
                                    <Checkbox checked={f.value} onCheckedChange={f.onChange} disabled={isSubmitting} />
                                  )}
                                />
                                <Label className="text-xs font-normal">Null</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Controller
                                  control={control}
                                  name={`attributes.${index}.isKey`}
                                  render={({ field: f }) => (
                                    <Checkbox checked={f.value} onCheckedChange={f.onChange} disabled={isSubmitting} />
                                  )}
                                />
                                <Label className="text-xs font-normal">Key</Label>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive mt-4"
                            onClick={() => removeAttribute(index)}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                        <CardContent className="pt-0 pb-3 px-3 border-t mt-2">
                           <PropertyEditor control={control} name={`attributes.${index}.properties`} propertyOptions={propertyOptions} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && creationMode === "from-source" && (
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base">Review Entities</Label>
                        <span className="text-sm text-muted-foreground">{selectedTables.length} tables selected</span>
                      </div>
                      
                      <div className="codex-popup-section entity-wizard__panel overflow-hidden">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Source Table</TableHead>
                                      <TableHead>Entity Name</TableHead>
                                      <TableHead className="w-[50px]"></TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {selectedTables.map((table) => {
                                      const isDup = duplicates.has(table);
                                      return (
                                      <TableRow key={table}>
                                          <TableCell className="align-top py-3">{table}</TableCell>
                                          <TableCell className="align-top py-3">
                                              <div className="space-y-1">
                                                <Input 
                                                    defaultValue={tableRenames[table] || table.replace(/^\[.*\]\.\[(.*)\]$/, "$1").replace(/^\[|\]$/g, "")}
                                                    className={isDup ? "border-destructive" : ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setValue("tableRenames", { ...tableRenames, [table]: val });
                                                    }}
                                                />
                                                {isDup && (
                                                    <div className="flex items-center text-destructive text-xs">
                                                        <AlertCircle className="h-3 w-3 mr-1" />
                                                        Entity name already exists
                                                    </div>
                                                )}
                                              </div>
                                          </TableCell>
                                          <TableCell className="align-top py-3">
                                              <Button 
                                                  variant="ghost" 
                                                  size="icon"
                                                  onClick={() => setValue("selectedTables", selectedTables.filter(t => t !== table))}
                                              >
                                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                              </Button>
                                          </TableCell>
                                      </TableRow>
                                  )})}
                              </TableBody>
                          </Table>
                      </div>
                  </div>
              )}

              {step === 4 && creationMode === "manual" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Relationships</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendRelationship({
                          targetRelPath: "",
                          sourceAttribute: "",
                          targetAttribute: "",
                          targetZone: "",
                        })
                      }
                      disabled={isSubmitting}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Relationship
                    </Button>
                  </div>
                  {relationshipFields.length === 0 && (
                    <div className="text-[13px] italic text-muted-foreground">
                      No relationships added.
                    </div>
                  )}
                  {relationshipFields.map((field, index) => (
                    <RelationshipRow
                        key={field.id}
                        index={index}
                        control={control}
                        removeRelationship={removeRelationship}
                        modelEntities={modelEntities}
                        zones={zones}
                        watchedAttributes={watchedAttributes}
                        errors={errors}
                        watch={watch}
                        setValue={setValue}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 border-t border-border/75 px-6 py-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={prevStep} disabled={step === 1 || isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            
            {(step < 4 && creationMode === "manual") || (step < 3 && creationMode === "from-source") ? (
              <Button onClick={nextStep} disabled={isSubmitting}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={() => void handleSubmit(onSubmit)()} disabled={isSubmitting || duplicates.size > 0}>
                {isSubmitting ? (
                  <>
                    Creating... <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  </>
                ) : (
                  <>
                    {creationMode === "manual" ? "Create Entity" : "Import Entities"} <Check className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
          <div className="error-surface-slot error-surface-slot--flush">
            <ErrorSurfaceHost scope="dialog:create-entity-wizard" />
          </div>
        </div>
        <SourceTablePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dataSource={selectedSource || ""}
          table={previewTable}
          limit={10}
        />
      </DialogContent>
    </Dialog>
  );
}

