import { useCallback } from "react";
import { useToast } from "@datam8/ui";
import { useModelEditor } from "../ModelEditorContext";
import { useConfirm } from "../../../shared/hooks/useConfirm";
import { ModelEntity } from "../model-types";
import { findModelEntityDependents, EntityDependency } from "../model-deps";
import { generateModelEntityId } from "../model-utils";
import { modelLocatorFromRelPath } from "../locator-utils";
import { deleteModelEntityByRelPath, saveModelEntityByRelPath } from "../../../shared/api/v2Client";

export function useModelActions() {
  const { 
    modelEntities,
    setModelEntities,
    toggleEntitySelection,
    setSelectedRelPaths,
    setSelectedRelPath,
    solutionPath,
    modelTabs,
    setModelTabs,
    closeTab,
  } = useModelEditor() as any;

  const confirm = useConfirm();
  const { toast } = useToast();

  const generateNewName = useCallback(
    (originalName: string, existingNames: Set<string>) => {
      let name = `${originalName}_copy`;
      let counter = 1;
      while (existingNames.has(name)) {
        counter++;
        name = `${originalName}_copy${counter}`;
      }
      return name;
    },
    [],
  );

  const duplicateModelEntities = useCallback(
    async (relPaths: string[], _currentSolutionPath: string) => {
      const selected = modelEntities.filter((m: ModelEntity) => relPaths.includes(m.relPath));
      if (selected.length === 0) return;

      const newEntities: ModelEntity[] = [];
      const updates: ModelEntity[] = []; // Other entities updated (deps)

      // 1. Create duplicates
      const allEntities = [...modelEntities, ...newEntities];
      for (const ent of selected) {
        const existingNames: Set<string> = new Set(modelEntities.map((m: ModelEntity) => m.name).concat(newEntities.map(n => n.name)));
        const newName = generateNewName(ent.name, existingNames);
        
        // Construct new relPath
        const parts = ent.relPath.split("/");
        const oldFileName = parts[parts.length - 1];
        // Preserve extension if present
        const extension = oldFileName.endsWith(".json") ? ".json" : ""; 
        
        parts[parts.length - 1] = newName + extension;
        const newRelPath = parts.join("/");
        
        // Match backend locator logic: /Zone/Product/Module/Name
        // The locator should NOT include the extension, similar to how it is derived in backend listModelEntities
        // but we are building it manually here.
        // The backend logic in listModelEntities:
        // const relPath = path.relative(root, absPath);
        // const locator = normalizeLocator(relPath); -> removes .json
        // So we should construct locator from relPath without extension.
        
        const newLocator = modelLocatorFromRelPath(newRelPath);

        const newContent = structuredClone(ent.content);
        
        // Generate new unique content ID
        // Note: we need to pass current + already created newEntities to avoid collision in this batch
        const newId = generateModelEntityId([...modelEntities, ...newEntities]);
        // Always assign the new ID
        newContent.id = newId;

        // Update content.name and content.displayName if they exist
        newContent.name = newName;
        if (typeof newContent.displayName === "string") {
            newContent.displayName = newName;
        }
        
        const newEntity: ModelEntity = {
          ...ent,
          name: newName, // This is for relPath, etc.
          relPath: newRelPath,
          locator: newLocator,
          content: newContent,
        };
        newEntities.push(newEntity);
      }

      // 2. Propagate dependencies (Update OTHER entities to reference new duplicates)
      // For each (original, duplicate) pair
      for (let i = 0; i < selected.length; i++) {
        const original = selected[i];
        const duplicate = newEntities[i];

        const deps = findModelEntityDependents(original, modelEntities);
        for (const dep of deps) {
           // We only propagate to collections (dep.kind === "collection").
           // Single-reference dependencies (optional-single, required-single) are not automatically updated
           // to point to the duplicate, to avoid unintended changes to existing entity models
           // which may assume a single, specific source/target.
          if (dep.kind === "collection") {
             // Find the entity to update
             let entityToUpdate = updates.find(u => u.locator === dep.dependentEntityId);
             if (!entityToUpdate) {
                entityToUpdate = modelEntities.find((m: ModelEntity) => m.locator === dep.dependentEntityId);
                if (entityToUpdate) {
                    // Clone it before modifying
                    entityToUpdate = structuredClone(entityToUpdate);
                    updates.push(entityToUpdate);
                }
             }

             if (entityToUpdate) {
                 const content = entityToUpdate.content;
                 const dupId = duplicate.content?.id;
                 const dupLocator = duplicate.locator;

                 // Handle sourceEntityIds (collection of locators/IDs)
                 if (dep.field === "sourceEntityIds" && Array.isArray(content.sourceEntityIds)) {
                     if (dep.matchType === "locator" && typeof dupLocator === "string") {
                        if (!content.sourceEntityIds.includes(dupLocator)) {
                            content.sourceEntityIds.push(dupLocator);
                        }
                     } else if (dep.matchType === "id" && dupId !== undefined) {
                        if (!content.sourceEntityIds.includes(dupId)) {
                             content.sourceEntityIds.push(dupId);
                        }
                     }
                 }
                 
                 // Handle relationships (collection of objects)
                 if (Array.isArray(content.relationships)) {
                     // Find the original relationship entry that caused this dependency
                     const match = dep.field.match(/relationships\[(\d+)\]/);
                     if (match) {
                         const idx = parseInt(match[1], 10);
                         const originalRel = content.relationships[idx];
                         if (originalRel) {
                             // Check if we haven't already added a duplicate for this specific relationship type to avoid double adding
                             const alreadyExists = content.relationships.some((r: any) => {
                                 // Check if a relationship with the same original target/source already points to the duplicate
                                 const isTargetDup = (dep.field.includes("targetModelEntityId") && r.targetModelEntityId === dupId);
                                 const isSourceDup = (dep.field.includes("sourceModelEntityId") && r.sourceModelEntityId === dupId);
                                 const isTargetLocatorDup = (dep.field.includes("targetEntityId") && r.targetEntityId === dupLocator);
                                 const isSourceLocatorDup = (dep.field.includes("sourceEntityId") && r.sourceEntityId === dupLocator);
                                 return isTargetDup || isSourceDup || isTargetLocatorDup || isSourceLocatorDup;
                             });
                             
                             if (!alreadyExists) {
                                 const newRel = structuredClone(originalRel);
                                 // Update relevant field in newRel to point to the duplicate
                                 if (dep.field.includes("targetModelEntityId") && dupId !== undefined) newRel.targetModelEntityId = dupId;
                                 if (dep.field.includes("sourceModelEntityId") && dupId !== undefined) newRel.sourceModelEntityId = dupId;
                                 if (dep.field.includes("targetEntityId") && dupLocator !== undefined) newRel.targetEntityId = dupLocator;
                                 if (dep.field.includes("sourceEntityId") && dupLocator !== undefined) newRel.sourceEntityId = dupLocator;
                                 
                                 content.relationships.push(newRel);
                             }
                         }
                     }
                 }

                 // Handle sources array (internal sources collection)
                 if (Array.isArray(content.sources)) {
                     const match = dep.field.match(/sources\[(\d+)\]/);
                     if (match) {
                         const idx = parseInt(match[1], 10);
                         const originalSrc = content.sources[idx];
                         if (originalSrc) {
                             const isInternal = originalSrc.type === "internal" || originalSrc.type === undefined;
                             if (isInternal && dep.matchType === "id" && dupId !== undefined) {
                                 // Check duplicates
                                 const alreadyExists = content.sources.some((s: any) => 
                                     (s.type === "internal" || s.type === undefined) && s.sourceLocation === dupId
                                 );
                                 if (!alreadyExists) {
                                     const newSrc = structuredClone(originalSrc);
                                     newSrc.sourceLocation = dupId;
                                     // Update name and other path-related fields if they matched the original
                                     if (newSrc.name === original.name) newSrc.name = duplicate.name;
                                     if (newSrc.zone === original.content?.zone) newSrc.zone = duplicate.content?.zone;

                                     content.sources.push(newSrc);
                                 }
                             }
                         }
                     }
                 }
             }
          }
        }
      }

      // 3. Save all new and updated entities
      try {
          const allToSave = [...newEntities, ...updates];
          await Promise.all(allToSave.map(e => 
             saveModelEntityByRelPath(e.relPath, e.content as Record<string, unknown>)
               .catch(() => { throw new Error("Failed to save " + e.name); })
          ));

          // 4. Update state
          setModelEntities((prev: ModelEntity[]) => {
              const map = new Map(prev.map(p => [p.locator, p]));
              updates.forEach(u => map.set(u.locator, u));
              newEntities.forEach(n => map.set(n.locator, n));
              return Array.from(map.values());
          });
          
          // 5. Update selection
          setSelectedRelPaths(new Set(newEntities.map(e => e.relPath)));
          if (newEntities.length > 0) {
              setSelectedRelPath(newEntities[0].relPath);
          }

          toast({ title: `Duplicated ${newEntities.length} entities` });

      } catch (err) {
          toast({ title: "Duplication failed", description: (err as Error).message, variant: "destructive" });
      }
    },
    [modelEntities, setModelEntities, setSelectedRelPaths, setSelectedRelPath, toast, generateNewName]
  );

  const deleteModelEntities = useCallback(
    async (relPaths: string[], _currentSolutionPath: string) => {
       const selected = modelEntities.filter((m: ModelEntity) => relPaths.includes(m.relPath));
       if (selected.length === 0) return;

       // 1. Analyze dependencies
       let blocked: ModelEntity[] = [];
       let deletable: ModelEntity[] = [];

       for (const ent of selected) {
           const deps = findModelEntityDependents(ent, modelEntities);
           const isBlocked = deps.some(d => d.kind === "required-single" && !selected.find((s: ModelEntity) => s.locator === d.dependentEntityId));
           
           if (isBlocked) blocked.push(ent);
           else deletable.push(ent);
       }

       // 2. Dialogs
       if (blocked.length === selected.length) {
           await confirm({
               title: "Cannot delete entities",
               description: `The selected entities are required by other entities and cannot be deleted.\n\n${blocked.map(b => b.name).join(", ")}`,
               confirmText: "Close",
           });
           return;
       }
       
       // Calculate impacted references for deletable entities
       const impactSummary: string[] = [];
       for (const del of deletable) {
          const deps = findModelEntityDependents(del, modelEntities);
          const referencingEntities = deps
            .filter(d => !deletable.some(x => x.locator === d.dependentEntityId)) // Filter out internal refs within selection
            .map(d => d.dependentEntityName);
          
          if (referencingEntities.length > 0) {
              const uniqueRefs = Array.from(new Set(referencingEntities));
              impactSummary.push(`${del.name} is used by: ${uniqueRefs.join(", ")}`);
          }
       }

       let description = "This action cannot be undone.";
       if (impactSummary.length > 0) {
           description += "\n\nThe following references will be automatically removed:\n" + impactSummary.join("\n");
       }

       if (blocked.length > 0) {
           const proceed = await confirm({
               title: "Delete partial selection?",
               description: `Some entities cannot be deleted because they are required:\n${blocked.map(b => b.name).join(", ")}\n\nThe following will be deleted:\n${deletable.map(d => d.name).join(", ")}\n\n${description}`,
               confirmText: "Delete deletable",
               cancelText: "Cancel",
           });
           if (!proceed) return;
       } else {
           const proceed = await confirm({
               title: `Delete ${deletable.length} entities?`,
               description: description,
               confirmText: "Delete",
           });
           if (!proceed) return;
       }

       // 3. Execute delete
       // Cleanup references in OTHER entities
       const updates: ModelEntity[] = [];
       
       for (const del of deletable) {
           const deps = findModelEntityDependents(del, modelEntities);
           for (const dep of deps) {
               if (deletable.some(d => d.locator === dep.dependentEntityId)) continue; // dependent is also deleted

               let entityToUpdate = updates.find(u => u.locator === dep.dependentEntityId);
               if (!entityToUpdate) {
                   entityToUpdate = modelEntities.find((m: ModelEntity) => m.locator === dep.dependentEntityId);
                   if (entityToUpdate) {
                       entityToUpdate = structuredClone(entityToUpdate);
                       updates.push(entityToUpdate);
                   }
               }
               
               if (entityToUpdate) {
                   const content = entityToUpdate.content;
                   const normDelLocator = del.locator.startsWith("/") ? del.locator : `/${del.locator}`;
                   const delId = del.content?.id;

                   // Remove from collection (sourceEntityIds)
                   if (dep.field === "sourceEntityIds" && Array.isArray(content.sourceEntityIds)) {
                       content.sourceEntityIds = content.sourceEntityIds.filter((id: any) => {
                           if (dep.matchType === "locator" && typeof id === "string") {
                               const normId = id.startsWith("/") ? id : `/${id}`;
                               return normId !== normDelLocator;
                           }
                           if (dep.matchType === "id" && delId !== undefined) {
                               return id !== delId;
                           }
                           return true;
                       });
                   }
                   
                   // Null out optional single (sourceEntityId)
                   if (dep.field === "sourceEntityId" && content.sourceEntityId) {
                       const sourceEntityId = content.sourceEntityId;
                       if (dep.matchType === "locator") {
                           if (typeof sourceEntityId === "string") {
                               const normSource = sourceEntityId.startsWith("/") ? sourceEntityId : `/${sourceEntityId}`;
                               if (normSource === normDelLocator) content.sourceEntityId = null;
                           }
                       } else if (dep.matchType === "id" && delId !== undefined) {
                           if (sourceEntityId === delId) content.sourceEntityId = null;
                       }
                   }
                   
                   // Relationships cleanup (targetModelEntityId, etc.)
                   if (Array.isArray(content.relationships)) {
                        content.relationships = content.relationships.filter((rel: any) => {
                            // Check targetModelEntityId (ID match)
                            if (delId !== undefined && rel.targetModelEntityId === delId) return false;
                            
                            // Check sourceModelEntityId (ID match)
                            if (delId !== undefined && rel.sourceModelEntityId === delId) return false;

                            // Check targetEntityId (Locator match)
                            if (rel.targetEntityId) {
                                const norm = rel.targetEntityId.startsWith("/") ? rel.targetEntityId : `/${rel.targetEntityId}`;
                                if (norm === normDelLocator) return false;
                            }
                            
                            // Check sourceEntityId (Locator match)
                            if (rel.sourceEntityId) {
                                const norm = rel.sourceEntityId.startsWith("/") ? rel.sourceEntityId : `/${rel.sourceEntityId}`;
                                if (norm === normDelLocator) return false;
                            }
                            return true;
                        });
                   }
                   
                   // Sources array cleanup (internal sources via ID)
                   if (Array.isArray(content.sources)) {
                       content.sources = content.sources.filter((src: any) => {
                           const isInternal = src.type === "internal" || src.type === undefined;
                           if (isInternal && delId !== undefined && src.sourceLocation === delId) {
                               return false;
                           }
                           return true;
                       });
                   }
               }
           }
       }

       try {
           // Save updates
           await Promise.all(updates.map(e => 
               saveModelEntityByRelPath(e.relPath, e.content as Record<string, unknown>)
                 .catch(() => { throw new Error("Failed to update " + e.name); })
           ));
           
           // Delete files
           await Promise.all(deletable.map(e => 
               deleteModelEntityByRelPath(e.relPath)
                 .catch(() => { throw new Error("Failed to delete " + e.name); })
           ));

           // Update state
           setModelEntities((prev: ModelEntity[]) => {
               const map = new Map(prev.map(p => [p.locator, p]));
               updates.forEach(u => map.set(u.locator, u));
               deletable.forEach(d => map.delete(d.locator));
               return Array.from(map.values());
           });
           
           // Close tabs for deleted
           deletable.forEach(d => closeTab("entity", d.relPath));
           
           // Update selection
           setSelectedRelPaths(new Set());
           setSelectedRelPath(null);

           toast({ title: `Deleted ${deletable.length} entities` });

       } catch (err) {
           toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });
       }
    },
    [closeTab, confirm, modelEntities, setModelEntities, setSelectedRelPath, setSelectedRelPaths, toast]
  );

  return { duplicateModelEntities, deleteModelEntities };
}

