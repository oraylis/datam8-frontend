import { useEffect, useMemo, useState } from "react";
import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { Badge, Button, Card, CardContent, FormSelect, Input, Label } from "@datam8/ui";
import { Trash2, Loader2 } from "lucide-react";
import { apiBase } from "../../../../config";
import { readBackendErrorMessage } from "../../../../shared/api/errorMessage";
import type { ModelEntity, TableMetadata } from "../../model-types";
import type { WizardFormValues } from "./schema";

const AUTH_FAILURE_MESSAGE =
  "Authentication failed. Update the Data Source configuration (including secrets) and try again.";

type ConnectorDescriptor = { id?: string | null; version?: string | null };
type WizardDataSourceType = Record<string, unknown>;
type WizardDataSource = {
  name: string;
  type: string;
  extendedProperties?: Record<string, unknown>;
  dataSourceType?: WizardDataSourceType | null;
  connectorId?: string | null;
  connector?: ConnectorDescriptor | null;
};
type WizardZone = { name: string; displayName: string; localFolderName: string; targetName: string };

type HttpError = Error & { status?: number };

export const ExternalSourceConfigurator = ({
  dataSource,
  dataSourceObject,
  solutionPath: _solutionPath,
  onTableSelected,
  selectedTable,
}: {
  dataSource: string;
  dataSourceObject?: WizardDataSource;
  solutionPath: string;
  onTableSelected: (table: string, metadata: TableMetadata) => void;
  selectedTable?: string;
}) => {
  const [httpSourceLocation, setHttpSourceLocation] = useState(selectedTable || "");

  const [tables, setTables] = useState<Array<{ schema?: string; name: string; type?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TableMetadata | null>(null);

  const connectorId =
    dataSourceObject?.connectorId ||
    dataSourceObject?.connector?.id ||
    "";
  const isHttpApi = connectorId === "http-api";
  const supportsMetadata = !!connectorId && !isHttpApi;
  const isUnsupportedType = useMemo(() => !!dataSource && !connectorId, [connectorId, dataSource]);

  const isAuthFailure = (status?: number, message?: string) => {
    if (status === 401 || status === 403) return true;
    const m = (message || "").toLowerCase();
    return m.includes("auth_failed") || m.includes("authentication") || m.includes("unauthorized") || m.includes("forbidden");
  };

  useEffect(() => {
    setTables([]);
    setMetadata(null);
    setError(null);
    if (isHttpApi) {
      setHttpSourceLocation(selectedTable || "");
    }
  }, [dataSource, isHttpApi, selectedTable]);

  const handleAuthFailure = (status?: number, message?: string) => {
    if (isAuthFailure(status, message)) {
      setError(AUTH_FAILURE_MESSAGE);
      return true;
    }
    return false;
  };

  const fetchTables = async () => {
    if (!dataSource) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/sources/${dataSource}/tables`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: HttpError = new Error(readBackendErrorMessage(data, "Failed to list tables"));
        err.status = res.status;
        throw err;
      }
      setTables(Array.isArray((data as { items?: unknown[] }).items) ? ((data as { items: Array<{ schema?: string; name: string; type?: string }> }).items) : []);
    } catch (err) {
      const typedError = err as HttpError;
      const status = typedError?.status;
      const message = typedError?.message || "Failed to list tables";
      if (!handleAuthFailure(status, message)) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async (tableRef: { schema?: string; name: string }) => {
    if (!dataSource) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = tableRef.schema
        ? `${apiBase}/sources/${dataSource}/schemas/${encodeURIComponent(tableRef.schema)}/tables/${encodeURIComponent(tableRef.name)}`
        : `${apiBase}/sources/${dataSource}/tables/${encodeURIComponent(tableRef.name)}`;
      const response = await fetch(endpoint);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err: HttpError = new Error(readBackendErrorMessage(data, "Failed to fetch metadata"));
        err.status = response.status;
        throw err;
      }
      const columns = Array.isArray((data as any)?.items) ? (data as any).items : [];
      const metadataValue: TableMetadata = {
        schema: tableRef.schema || "",
        name: tableRef.name,
        type: "BASE TABLE",
        columns: columns.map((col: any) => ({
          name: `${col?.name || ""}`,
          ordinal: Number(col?.ordinal || 0),
          dataType: `${col?.dataType || ""}`,
          maxLength: typeof col?.maxLength === "number" ? col.maxLength : null,
          numericPrecision: typeof col?.numericPrecision === "number" ? col.numericPrecision : null,
          numericScale: typeof col?.numbericScale === "number" ? col.numbericScale : null,
          isNullable: Boolean(col?.isNullable),
          isPrimaryKey: Boolean(col?.isPrimaryKey),
        })),
      };
      if (metadataValue.columns.length > 0) {
        setMetadata(metadataValue);
        const full = tableRef.schema ? `${tableRef.schema}.${tableRef.name}` : tableRef.name;
        onTableSelected(full, metadataValue);
      }
    } catch (err) {
      const typedError = err as HttpError;
      const status = typedError?.status;
      const message = typedError?.message || "Failed to fetch metadata";
      if (!handleAuthFailure(status, message)) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHttpApiMetadata = async () => {
    if (!dataSource || !httpSourceLocation) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = `${apiBase}/sources/${dataSource}/tables/${encodeURIComponent(httpSourceLocation)}`;
      const res = await fetch(endpoint);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: HttpError = new Error(readBackendErrorMessage(data, "Failed to fetch HTTP metadata"));
        err.status = res.status;
        throw err;
      }
      const columns = Array.isArray((data as any)?.items) ? (data as any).items : [];
      const metadataValue: TableMetadata = {
        schema: "",
        name: httpSourceLocation,
        type: "BASE TABLE",
        columns: columns.map((col: any) => ({
          name: `${col?.name || ""}`,
          ordinal: Number(col?.ordinal || 0),
          dataType: `${col?.dataType || ""}`,
          maxLength: typeof col?.maxLength === "number" ? col.maxLength : null,
          numericPrecision: typeof col?.numericPrecision === "number" ? col.numericPrecision : null,
          numericScale: typeof col?.numbericScale === "number" ? col.numbericScale : null,
          isNullable: Boolean(col?.isNullable),
          isPrimaryKey: Boolean(col?.isPrimaryKey),
        })),
      };
      if (metadataValue) {
        setMetadata(metadataValue);
        onTableSelected(httpSourceLocation, metadataValue);
      }
    } catch (err) {
      const typedError = err as HttpError;
      const status = typedError?.status;
      const message = typedError?.message || "Failed to fetch HTTP metadata";
      if (!handleAuthFailure(status, message)) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const showTableList = !!dataSource && supportsMetadata;
  const errorMessage = error;

  return (
    <div className="codex-popup-section entity-wizard__source-config space-y-3 p-3">
      {isUnsupportedType ? (
        <div className="text-sm text-muted-foreground">
          This data source type is not supported for metadata inspection here. You can still type the table name/path manually.
        </div>
      ) : null}

      {showTableList ? (
        <div className="space-y-2">
          <Button size="sm" variant="secondary" onClick={fetchTables} disabled={loading || !dataSource}>
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Load Tables
          </Button>
          {tables.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Tables</Label>
              <div className="codex-popup-scroll max-h-40 overflow-auto">
                {tables.map((t) => {
                  const full = t.schema ? `${t.schema}.${t.name}` : t.name;
                  return (
                    <div
                      key={`${t.schema}::${t.name}`}
                      className="flex items-center justify-between px-2 py-1 text-sm transition-colors hover:bg-foreground/6"
                    >
                      <span>{full}</span>
                      <div className="flex items-center gap-2">
                        {t.type ? <Badge variant="outline">{t.type}</Badge> : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            fetchMetadata({ schema: t.schema, name: t.name });
                          }}
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isHttpApi ? (
        <div className="space-y-2">
          <Label>API Path *</Label>
          <Input
            value={httpSourceLocation}
            onChange={(e) => setHttpSourceLocation(e.target.value)}
            placeholder="/groups/{groupId}/datasets"
          />
          <Button size="sm" variant="secondary" onClick={fetchHttpApiMetadata} disabled={loading || !httpSourceLocation}>
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Fetch Metadata
          </Button>
        </div>
      ) : null}

      {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}
      {metadata ? (
        <div className="codex-popup-scroll p-2 text-xs">
          <div className="font-semibold mb-1">
            {metadata.schema}.{metadata.name} ({metadata.type})
          </div>
          <div className="space-y-1">
            {metadata.columns?.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <span>{c.name}</span>
                <span className="text-muted-foreground">{c.dataType}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

type SourceRowProps = {
  index: number;
  control: Control<WizardFormValues>;
  removeSource: (index: number) => void;
  dataSources: WizardDataSource[];
  zones: WizardZone[];
  modelEntities: ModelEntity[];
  errors: FieldErrors<WizardFormValues>;
  watch: UseFormWatch<WizardFormValues>;
  setValue: UseFormSetValue<WizardFormValues>;
  register: UseFormRegister<WizardFormValues>;
  solutionPath: string;
  onSetMetadata: (idx: number, meta: TableMetadata) => void;
};

export const SourceRow = ({
  index,
  control,
  removeSource,
  dataSources,
  zones,
  modelEntities,
  errors,
  watch,
  setValue,
  register,
  solutionPath,
  onSetMetadata,
}: SourceRowProps) => {
  const sourceType = watch(`sources.${index}.type`) as WizardFormValues["sources"][number]["type"] | undefined;
  const internalZone = watch(`sources.${index}.internalZone`) as string | undefined;
  const currentDataSourceName = watch(`sources.${index}.dataSource`) as string | undefined;
  const currentTable = watch(`sources.${index}.sourceLocation`) as string | undefined;

  const currentDataSourceObj = useMemo(
    () => dataSources.find((d) => d.name === currentDataSourceName),
    [dataSources, currentDataSourceName],
  );

  const connectorId = currentDataSourceObj?.connectorId || currentDataSourceObj?.connector?.id || null;
  const isHttpApi = connectorId === "http-api";
  const supportsMetadata = !!connectorId && !isHttpApi;

  const internalEntityOptions = useMemo(() => {
    if (sourceType !== "internal") return [];
    const selectedZoneObj = zones.find((z) => z.name === internalZone);
    const filterFolder = selectedZoneObj?.localFolderName || selectedZoneObj?.targetName || internalZone;

    return modelEntities
      .filter((e) => {
        if (!internalZone) return true;
        const parts = e.relPath.split("/");
        return parts[1] === filterFolder;
      })
      .map((e) => ({ value: e.relPath, label: e.name }));
  }, [modelEntities, internalZone, sourceType, zones]);

  return (
    <Card className="entity-wizard__source-card">
      <CardContent className="p-4 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => removeSource(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <div className="mb-4">
          <Badge variant={sourceType === "internal" ? "secondary" : "default"}>
            {sourceType === "internal" ? "Internal" : "External"}
          </Badge>
        </div>

        {sourceType === "external" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Source *</Label>
                <Controller
                  control={control}
                  name={`sources.${index}.dataSource`}
                  render={({ field: f }) => (
                    <FormSelect
                      value={f.value}
                      onChange={f.onChange}
                      options={dataSources.map((d) => ({ value: d.name, label: d.name }))}
                      placeholder="Select Data Source"
                      className={errors.sources?.[index]?.dataSource ? "border-destructive" : ""}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Source Location *</Label>
                <Input
                  {...register(`sources.${index}.sourceLocation`)}
                  placeholder="Table/View/API Path"
                  className={errors.sources?.[index]?.sourceLocation ? "border-destructive" : ""}
                  readOnly={supportsMetadata}
                />
              </div>
              <div className="space-y-2">
                <Label>Alias (Optional)</Label>
                <Input {...register(`sources.${index}.sourceAlias`)} placeholder="Alias" />
              </div>
            </div>

            <ExternalSourceConfigurator
              dataSource={currentDataSourceName || ""}
              dataSourceObject={currentDataSourceObj}
              solutionPath={solutionPath}
              selectedTable={currentTable}
              onTableSelected={(table, meta) => {
                setValue(`sources.${index}.sourceLocation`, table);
                setValue(`sources.${index}.metadata`, meta);
                onSetMetadata(index, meta);
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zone Filter</Label>
              <Controller
                control={control}
                name={`sources.${index}.internalZone`}
                render={({ field: f }) => (
                  <FormSelect
                    value={f.value}
                    onChange={(val) => {
                      f.onChange(val);
                      setValue(`sources.${index}.internalEntityRelPath`, "");
                    }}
                    options={[
                      { value: "", label: "All Zones" },
                      ...zones.map((z) => ({ value: z.name, label: z.displayName || z.name })),
                    ]}
                    placeholder="Filter by Zone"
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Entity *</Label>
              <Controller
                control={control}
                name={`sources.${index}.internalEntityRelPath`}
                render={({ field: f }) => (
                  <FormSelect
                    value={f.value}
                    onChange={f.onChange}
                    options={internalEntityOptions}
                    placeholder="Select Entity"
                    className={errors.sources?.[index]?.internalEntityRelPath ? "border-destructive" : ""}
                  />
                )}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

