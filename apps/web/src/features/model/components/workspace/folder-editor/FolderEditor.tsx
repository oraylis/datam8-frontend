import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormSelect, Input, Textarea } from "@datam8/ui";
import type { PropertyAssignment } from "@datam8/types";
import { EditorPanelHeader } from "../common/EditorPanelHeader";
import { PropertyChips, type PropertyChipItem } from "../common/PropertyChips";
import type { FolderEntity, PropertyOption } from "../../../model-types";
import { mergeInheritedProps } from "../../../model-utils";
import { deepEqual } from "../../../../../shared/utils/deepEqual";
import { useSaveFailureToast } from "../../../../../shared/ui/useSaveFailureToast";

type FolderEditorProps = {
  selectedFolderPath: string;
  folderEntity: FolderEntity | null;
  propertyOptions: PropertyOption[];
  productOptions: string[];
  moduleOptionsByProduct: Record<string, string[]>;
  inheritedFolderProps?: PropertyAssignment[];
  onSave: (params: { relPath: string; content: any; folderPath: string; name: string }) => Promise<void>;
  registerPersist?: (persist: (() => Promise<boolean>) | null) => void;
  onDirtyChange?: (folderPath: string, dirty: boolean) => void;
};

type FolderProperty = { property: string; value: string };
const PRODUCT_NONE = "__none_product__";
const MODULE_NONE = "__none_module__";

function defaultFolderId(folderPath: string) {
  let hash = 0;
  for (let i = 0; i < folderPath.length; i += 1) {
    hash = (hash << 5) - hash + folderPath.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function extractFolderMeta(content: any): any | null {
  if (!content || typeof content !== "object") return null;

  const directName = typeof content?.name === "string" ? content.name.trim() : "";
  if (directName) return content;

  const folders = content?.folders;
  if (!Array.isArray(folders) || !folders.length) return null;
  const first = folders[0];
  return first && typeof first === "object" ? first : null;
}

export function FolderEditor({
  selectedFolderPath,
  folderEntity,
  propertyOptions,
  productOptions,
  moduleOptionsByProduct,
  inheritedFolderProps = [],
  onSave,
  registerPersist,
  onDirtyChange,
}: FolderEditorProps) {
  const [mode, setMode] = useState<"ui" | "json">("ui");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [dataProduct, setDataProduct] = useState("");
  const [dataModule, setDataModule] = useState("");
  const [properties, setProperties] = useState<FolderProperty[]>([]);
  const [jsonText, setJsonText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error" | "success">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const baselineRef = useRef<any>(null);
  const dirtyRef = useRef(false);
  const persistInFlightRef = useRef(false);
  const persistQueuedRef = useRef(false);
  const pendingPersistReasonRef = useRef<"text-blur" | "dropdown-change" | "tab-switch" | "add-item" | null>(null);
  const pendingPersistRevisionRef = useRef(0);
  const changeRevisionRef = useRef(0);
  const [changeRevision, setChangeRevision] = useState(0);
  const [persistRequestTick, setPersistRequestTick] = useState(0);

  const bumpChangeRevision = useCallback(() => {
    const next = changeRevisionRef.current + 1;
    changeRevisionRef.current = next;
    setChangeRevision(next);
  }, []);

  const currentMeta = useMemo(() => extractFolderMeta(folderEntity?.content), [folderEntity?.content]);

  const targetRelPath = useMemo(() => {
    if (folderEntity?.relPath) return folderEntity.relPath;
    const folder = selectedFolderPath ? `/${selectedFolderPath}` : "";
    return `Model${folder}/.properties.json`;
  }, [folderEntity, selectedFolderPath]);

  const moduleOptions = useMemo(
    () => (dataProduct ? moduleOptionsByProduct[dataProduct] || [] : []),
    [dataProduct, moduleOptionsByProduct],
  );

  const usedPropertyNames = useMemo(
    () => new Set(properties.map((p) => `${p?.property ?? ""}`).filter((v) => v.trim().length > 0)),
    [properties],
  );

  const inheritedPropertyChipItems = useMemo((): PropertyChipItem[] => {
    const inherited = mergeInheritedProps(inheritedFolderProps, [], properties);
    return inherited.reduce<PropertyChipItem[]>((acc, entry, idx) => {
      const property = `${entry?.property ?? ""}`;
      if (!property.trim()) return acc;
      acc.push({
        key: `inherit-${property}-${idx}`,
        property,
        value: `${entry?.value ?? ""}`,
        inherited: true,
        title: "Inherited from parent folder (add the same property to override)",
        removeKey: undefined,
      });
      return acc;
    }, []);
  }, [inheritedFolderProps, properties]);

  const localPropertyChipItems = useMemo(
    (): PropertyChipItem[] =>
      properties.reduce<PropertyChipItem[]>((acc, entry, idx) => {
        const property = `${entry?.property ?? ""}`;
        if (!property.trim()) return acc;
        acc.push({
          key: `${property}::${idx}`,
          property,
          value: `${entry?.value ?? ""}`,
          inherited: false,
          title: "Folder property",
          removeKey: idx,
        });
        return acc;
      }, []),
    [properties],
  );

  const propertyChipItems = useMemo(
    () => [...inheritedPropertyChipItems, ...localPropertyChipItems],
    [inheritedPropertyChipItems, localPropertyChipItems],
  );

  const addProperty = useCallback((property: string, value: string) => {
    setProperties((prev) => [...prev, { property, value }]);
  }, []);

  const removeProperty = useCallback((removeKey: number | string) => {
    const idx = Number(removeKey);
    if (!Number.isFinite(idx)) return;
    setProperties((prev) => prev.filter((_item, i) => i !== idx));
  }, []);

  const buildUiContent = useCallback(() => {
    const cleanName = name.trim();
    const folderId =
      typeof currentMeta?.id === "number" && Number.isFinite(currentMeta.id)
        ? currentMeta.id
        : defaultFolderId(selectedFolderPath);

    const folder: any = {
      id: folderId,
      name: cleanName,
      properties: properties
        .map((item) => ({
          property: (item.property || "").trim(),
          value: (item.value || "").trim(),
        }))
        .filter((item) => item.property),
    };
    if (displayName.trim()) folder.displayName = displayName.trim();
    if (description.trim()) folder.description = description.trim();
    if (selectedFolderPath) folder.path = selectedFolderPath;
    if (dataProduct.trim()) folder.dataProduct = dataProduct.trim();
    if (dataModule.trim()) folder.dataModule = dataModule.trim();

    return folder;
  }, [currentMeta?.id, dataModule, dataProduct, description, displayName, name, properties, selectedFolderPath]);

  const saveFolder = useCallback(async (): Promise<boolean> => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      let content: any;
      if (mode === "json") {
        try {
          content = JSON.parse(jsonText);
        } catch {
          throw new Error("Please fix JSON before saving.");
        }
      } else {
        if (!name.trim()) {
          throw new Error("Folder name is required.");
        }
        content = buildUiContent();
      }

      const meta = extractFolderMeta(content);
      const folderName =
        (typeof meta?.name === "string" && meta.name.trim()) ||
        name.trim() ||
        selectedFolderPath.split("/").filter(Boolean).pop() ||
        "Folder";

      await onSave({
        relPath: targetRelPath,
        content,
        folderPath: selectedFolderPath,
        name: folderName,
      });

      baselineRef.current = content;
      dirtyRef.current = false;
      persistQueuedRef.current = false;
      setJsonText(JSON.stringify(content, null, 2));
      onDirtyChange?.(selectedFolderPath, false);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 1200);
      return true;
    } catch (err) {
      setSaveStatus("error");
      setSaveError((err as Error).message || "Save failed.");
      onDirtyChange?.(selectedFolderPath, true);
      return false;
    }
  }, [buildUiContent, jsonText, mode, name, onDirtyChange, onSave, selectedFolderPath, targetRelPath]);

  useEffect(() => {
    const fallbackName = selectedFolderPath.split("/").filter(Boolean).pop() || "";
    const nextName = (currentMeta?.name || fallbackName || "").trim();
    const nextDisplayName = (currentMeta?.displayName || "").trim();
    const nextDescription = (currentMeta?.description || "").trim();
    const nextProduct = (currentMeta?.dataProduct || "").trim();
    const nextModule = (currentMeta?.dataModule || "").trim();
    const nextProperties: FolderProperty[] = Array.isArray(currentMeta?.properties)
      ? currentMeta.properties
          .map((item: any) => ({
            property: typeof item?.property === "string" ? item.property : "",
            value: typeof item?.value === "string" ? item.value : "",
          }))
          .filter((item: FolderProperty) => item.property.trim().length > 0)
      : [];

    setMode("ui");
    setName(nextName);
    setDisplayName(nextDisplayName);
    setDescription(nextDescription);
    setDataProduct(nextProduct);
    setDataModule(nextModule);
    setProperties(nextProperties);
    setSaveStatus("idle");
    setSaveError(null);

    const folderId =
      typeof currentMeta?.id === "number" && Number.isFinite(currentMeta.id)
        ? currentMeta.id
        : defaultFolderId(selectedFolderPath);
    const initialFolder: any = {
      id: folderId,
      name: nextName,
      properties: nextProperties
        .map((item) => ({
          property: (item.property || "").trim(),
          value: (item.value || "").trim(),
        }))
        .filter((item) => item.property),
    };
    if (nextDisplayName) initialFolder.displayName = nextDisplayName;
    if (nextDescription) initialFolder.description = nextDescription;
    if (selectedFolderPath) initialFolder.path = selectedFolderPath;
    if (nextProduct) initialFolder.dataProduct = nextProduct;
    if (nextModule) initialFolder.dataModule = nextModule;

    const initialContent = initialFolder;
    baselineRef.current = initialContent;
    setJsonText(JSON.stringify(initialContent, null, 2));
    onDirtyChange?.(selectedFolderPath, false);
    dirtyRef.current = false;
    persistQueuedRef.current = false;
    pendingPersistReasonRef.current = null;
    pendingPersistRevisionRef.current = 0;
    changeRevisionRef.current = 0;
    setChangeRevision(0);
  }, [currentMeta, onDirtyChange, selectedFolderPath]);

  useEffect(() => {
    if (dataProduct && dataModule) {
      const modules = moduleOptionsByProduct[dataProduct] || [];
      if (!modules.includes(dataModule)) {
        setDataModule("");
      }
    }
  }, [dataModule, dataProduct, moduleOptionsByProduct]);

  useEffect(() => {
    if (!baselineRef.current) return;
    let dirty = false;
    if (mode === "json") {
      try {
        const parsed = JSON.parse(jsonText);
        dirty = !deepEqual(parsed, baselineRef.current);
      } catch {
        dirty = true;
      }
    } else {
      const current = buildUiContent();
      dirty = !deepEqual(current, baselineRef.current);
    }
    dirtyRef.current = dirty;
    if (!dirty) {
      persistQueuedRef.current = false;
      pendingPersistReasonRef.current = null;
      pendingPersistRevisionRef.current = 0;
      setSaveStatus("idle");
      setSaveError(null);
      return;
    }
    bumpChangeRevision();
  }, [buildUiContent, bumpChangeRevision, jsonText, mode]);

  const persistNow = useCallback(
    async (reason: "text-blur" | "dropdown-change" | "tab-switch" | "add-item"): Promise<boolean> => {
      if (!dirtyRef.current) return true;
      if (persistInFlightRef.current) {
        persistQueuedRef.current = true;
        return false;
      }
      persistInFlightRef.current = true;
      const ok = await saveFolder();
      persistInFlightRef.current = false;
      if (persistQueuedRef.current && dirtyRef.current) {
        persistQueuedRef.current = false;
        return persistNow(reason);
      }
      return ok;
    },
    [saveFolder],
  );

  useEffect(() => {
    const reason = pendingPersistReasonRef.current;
    if (!reason) return;
    if (!dirtyRef.current) {
      pendingPersistReasonRef.current = null;
      pendingPersistRevisionRef.current = 0;
      return;
    }
    if (changeRevision < pendingPersistRevisionRef.current) return;
    void persistNow(reason);
  }, [changeRevision, persistNow, persistRequestTick]);

  const persistAfterStateFlush = useCallback(
    (reason: "text-blur" | "dropdown-change" | "tab-switch" | "add-item") => {
      pendingPersistReasonRef.current = reason;
      pendingPersistRevisionRef.current = changeRevisionRef.current;
      setPersistRequestTick((value) => value + 1);
    },
    [],
  );

  useEffect(() => {
    registerPersist?.(() => persistNow("tab-switch"));
    return () => {
      registerPersist?.(null);
      pendingPersistReasonRef.current = null;
      pendingPersistRevisionRef.current = 0;
    };
  }, [persistNow, registerPersist]);

  useEffect(() => {
    const onSelectChanged = () => persistAfterStateFlush("dropdown-change");
    const onCheckboxChanged = () => persistAfterStateFlush("add-item");
    const onValueCommitted = () => persistAfterStateFlush("add-item");
    window.addEventListener("dm8:form-select-change", onSelectChanged as EventListener);
    window.addEventListener("dm8:checkbox-change", onCheckboxChanged as EventListener);
    window.addEventListener("dm8:value-commit", onValueCommitted as EventListener);
    return () => {
      window.removeEventListener("dm8:form-select-change", onSelectChanged as EventListener);
      window.removeEventListener("dm8:checkbox-change", onCheckboxChanged as EventListener);
      window.removeEventListener("dm8:value-commit", onValueCommitted as EventListener);
    };
  }, [persistAfterStateFlush]);

  const retrySave = useCallback(() => {
    void persistNow("tab-switch");
  }, [persistNow]);

  const { notifySaveFailure, resetSaveFailureToastMemory } = useSaveFailureToast({
    contextKey: `folder:${selectedFolderPath || "none"}`,
    onRetry: retrySave,
  });

  useEffect(() => {
    if (saveStatus === "error") {
      notifySaveFailure(saveError);
      return;
    }
    resetSaveFailureToastMemory();
  }, [notifySaveFailure, resetSaveFailureToastMemory, saveError, saveStatus]);

  const handleTextFieldBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target instanceof HTMLInputElement) {
        const blocked = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "hidden", "color", "range"]);
        if (blocked.has((target.type || "").toLowerCase())) return;
      }
      void persistNow("text-blur");
    },
    [persistNow],
  );

  return (
    <div className="panel">
      <EditorPanelHeader
        eyebrow={targetRelPath}
        title={name || selectedFolderPath || "Folder"}
        meta={
          <PropertyChips
            className="panel__chips chips--sm"
            items={propertyChipItems}
            propertyOptions={propertyOptions}
            usedPropertyNames={usedPropertyNames}
            onAdd={(property, value) => {
              addProperty(property, value);
              persistAfterStateFlush("add-item");
            }}
            onRemove={removeProperty}
            addLabel="Add folder property"
          />
        }
        actions={null}
      />
      <div className="panel__body" onBlurCapture={handleTextFieldBlurCapture}>
        {mode === "ui" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Folder Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Optional display name" />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Product</label>
                <FormSelect
                  value={dataProduct || PRODUCT_NONE}
                  onChange={(value) => {
                    const next = value === PRODUCT_NONE ? "" : (value || "");
                    setDataProduct(next);
                    if (!next) setDataModule("");
                  }}
                  options={[{ value: PRODUCT_NONE, label: "None" }, ...productOptions.map((p) => ({ value: p, label: p }))]}
                  placeholder="Select data product"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Module</label>
                <FormSelect
                  value={dataModule || MODULE_NONE}
                  onChange={(value) => setDataModule(value === MODULE_NONE ? "" : (value || ""))}
                  options={[{ value: MODULE_NONE, label: "None" }, ...moduleOptions.map((m) => ({ value: m, label: m }))]}
                  placeholder={dataProduct ? "Select data module" : "Select product first"}
                  disabled={!dataProduct}
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label>JSON</label>
            <Textarea
              rows={20}
              className="code"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
