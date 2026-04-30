import * as z from "zod";

export const propertySchema = z.object({
  property: z.string().min(1, "Property name required"),
  value: z.string(),
});

// We make the base fields looser to support different modes validation
export const step1Schema = z.object({
  creationMode: z.enum(["manual", "from-source"]).default("manual"),
  
  // Fields that might be optional depending on mode
  name: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  
  // Required in both modes (eventually)
  folderPath: z.string().optional(),
  zoneName: z.string().optional(), // Made optional here, enforced via refine
  productName: z.string().optional(),
  moduleName: z.string().optional(),
  
  properties: z.array(propertySchema).optional(),
  
  // New fields for bulk mode
  selectedSource: z.string().optional(),
  selectedTables: z.array(z.string()).optional(),
  tableRenames: z.record(z.string()).optional(),
  tableDescriptions: z.record(z.string()).optional(),
  tableProperties: z.record(z.array(propertySchema)).optional(),
});

export const sourceSchema = z
  .object({
    type: z.enum(["external", "internal"]),
    dataSource: z.string().optional(),
    sourceLocation: z.string().optional(),
    sourceAlias: z.string().optional(),
    metadata: z.any().optional(),
    internalZone: z.string().optional(),
    internalEntityRelPath: z.string().optional(),
    mapping: z.any().optional(), // Added to support mapping persistence
    properties: z.array(propertySchema).optional(), // Added properties support
  })
  .refine(
    (data) => {
      if (data.type === "external") {
        return !!data.dataSource && !!data.sourceLocation;
      }
      if (data.type === "internal") {
        return !!data.internalEntityRelPath;
      }
      return true;
    },
    {
      message: "Required fields missing for selected source type",
      path: ["sourceLocation"],
    },
  );

export const attributeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dataType: z.string().min(1, "Data Type is required"),
  attributeType: z.string().min(1, "Attribute Type is required"),
  nullable: z.boolean().optional(),
  isKey: z.boolean().optional(),
  properties: z.array(propertySchema).optional(),
});

export const relationshipSchema = z.object({
  targetZone: z.string().min(1, "Zone is required"),
  targetRelPath: z.string().min(1, "Target Entity is required"),
  sourceAttribute: z.string().min(1, "Source Attribute is required"),
  targetAttribute: z.string().min(1, "Target Attribute is required"),
});

export const wizardSchema = step1Schema.extend({
  sources: z.array(sourceSchema),
  attributes: z.array(attributeSchema),
  relationships: z.array(relationshipSchema),
}).superRefine((data, ctx) => {
    if (data.creationMode === "manual") {
        if (!data.name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name is required", path: ["name"] });
        else if (!/^[a-zA-Z0-9_]+$/.test(data.name)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Alphanumeric and underscores only", path: ["name"] });
        if (!data.folderPath) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Folder is required", path: ["folderPath"] });
        if (!data.attributes || data.attributes.length === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one attribute is required", path: ["attributes"] });
        }
    } else {
        // from-source mode
        if (!data.folderPath) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Folder is required", path: ["folderPath"] });
        
        if (!data.selectedSource) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source is required", path: ["selectedSource"] });
        if (!data.selectedTables || data.selectedTables.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select at least one table", path: ["selectedTables"] });
    }
});

export type WizardFormValues = z.infer<typeof wizardSchema>;
