import React, { createContext, useContext } from "react";
import { ChevronRight } from "lucide-react";
import {
  formatDeepDiffValue,
  readableChangeFields,
  readableFieldLabel,
  type DeepDiffEntry,
  type DeepDiffColumnGroup,
  type DeepDiffSourceGroup,
} from "./deepDiffPresenter";

const STATUS = {
  added: {
    marker: "+",
    label: "New",
    color: "text-emerald-800 dark:text-emerald-300",
  },
  changed: {
    marker: "~",
    label: "Changed",
    color: "text-amber-800 dark:text-amber-300",
  },
  removed: { marker: "−", label: "Removed", color: "text-destructive" },
};

export function ChangeSummary({
  changes,
}: {
  changes: Array<Pick<DeepDiffEntry, "operation">>;
}) {
  return (["added", "changed", "removed"] as const).map((operation) => {
    const count = changes.filter(
      (change) => change.operation === operation,
    ).length;
    return count ? (
      <span
        key={operation}
        className={`text-xs tabular-nums ${STATUS[operation].color}`}
        data-testid={`change-count-${operation}`}
      >
        {operation === "added"
          ? `+${count} added`
          : operation === "removed"
            ? `−${count} removed`
            : `${count} modified`}
      </span>
    ) : null;
  });
}

type Expansion = { expanded: Set<string>; toggle: (key: string) => void };
export const RefreshReviewExpansion = createContext<Expansion>({
  expanded: new Set(),
  toggle: () => {},
});

function ReviewDetails({
  nodeKey,
  label,
  summary,
  testId,
  children,
}: {
  nodeKey: string;
  label: string;
  summary: React.ReactNode;
  testId: string;
  children: React.ReactNode;
}) {
  const { expanded, toggle } = useContext(RefreshReviewExpansion);
  const open = expanded.has(nodeKey);
  return (
    <details
      open={open}
      className="min-w-0 border-b border-border/60 last:border-b-0"
      data-testid={testId}
    >
      <summary
        aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          toggle(nodeKey);
        }}
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        {summary}
        <ChevronRight
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
      </summary>
      <div className="min-w-0 pb-2 pl-6">{children}</div>
    </details>
  );
}

function Status({ operation }: { operation: DeepDiffEntry["operation"] }) {
  return (
    <span
      className={`w-4 shrink-0 font-medium ${STATUS[operation].color}`}
      aria-label={STATUS[operation].label}
    >
      {STATUS[operation].marker}
    </span>
  );
}

export function ChangeLine({
  change,
  label,
}: {
  change: DeepDiffEntry;
  label: string;
}) {
  return (
    <div
      className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-x-2 gap-y-1 border-b border-border/50 py-2.5 last:border-b-0 sm:grid-cols-[1rem_minmax(7rem,0.8fr)_minmax(0,1fr)_1rem_minmax(0,1fr)]"
      title={`${change.category}: ${change.path}`}
      data-testid="diff-entry"
    >
      <span
        className={STATUS[change.operation].color}
        aria-label={`${change.operation}; ${change.category}; ${change.path}`}
      >
        {STATUS[change.operation].marker}
      </span>
      <span className="min-w-0 break-words [overflow-wrap:anywhere] text-xs text-muted-foreground">
        {readableFieldLabel(label)}
      </span>
      <span className="col-start-2 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs text-muted-foreground sm:col-start-auto">
        {change.operation !== "added" ? (
          <s>{formatDeepDiffValue(change.before)}</s>
        ) : null}
      </span>
      <span
        className="col-start-2 text-xs text-muted-foreground sm:col-start-auto"
        aria-hidden="true"
      >
        {change.operation === "changed" ? "→" : ""}
      </span>
      <span className="col-start-2 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs font-medium sm:col-start-auto">
        {change.operation !== "removed"
          ? formatDeepDiffValue(change.after)
          : null}
      </span>
      {change.beforeType || change.afterType ? (
        <span className="col-start-2 col-end-[-1] text-xs text-muted-foreground">
          type: {change.beforeType || "—"} → {change.afterType || "—"}
        </span>
      ) : null}
    </div>
  );
}

export function ObjectChanges({
  changes,
  sourceLabel,
  expanded = false,
}: {
  changes: DeepDiffEntry[];
  sourceLabel?: string;
  expanded?: boolean;
}) {
  const fields = expanded ? changes : changes.flatMap(readableChangeFields);
  return fields.length ? (
    <div className="min-w-0" data-testid="object-changes">
      {fields.map((change) => (
        <ChangeLine
          key={change.id}
          change={change}
          label={
            sourceLabel
              ? change.displayPath.split(" › ").slice(1).join(" › ")
              : change.displayPath
          }
        />
      ))}
    </div>
  ) : null;
}

export function reviewNodeKeys(
  entityKey: string,
  columns: DeepDiffColumnGroup[],
  sources: DeepDiffSourceGroup[],
): string[] {
  return [
    ...(columns.length
      ? [
          `${entityKey}:columns`,
          ...columns.map((column) => `${entityKey}:${column.key}`),
        ]
      : []),
    ...(sources.length
      ? [
          `${entityKey}:sources`,
          ...sources.flatMap((source) => [
            `${entityKey}:${source.key}`,
            ...(source.columns.length
              ? [
                  `${entityKey}:${source.key}:mappings`,
                  ...source.columns.map(
                    (mapping) => `${entityKey}:${source.key}:${mapping.key}`,
                  ),
                ]
              : []),
          ]),
        ]
      : []),
  ];
}

function ColumnList({
  groups,
  nodePrefix,
  mapping = false,
}: {
  groups: DeepDiffColumnGroup[];
  nodePrefix: string;
  mapping?: boolean;
}) {
  return (
    <div className="min-w-0" data-testid="column-change-list">
      {groups.map((group) => (
        <ReviewDetails
          key={group.key}
          nodeKey={`${nodePrefix}:${group.key}`}
          label={`${mapping ? "mapping" : "column"} ${group.label}`}
          testId="diff-column-group"
          summary={
            <>
              <Status operation={group.operation} />
              <div className="min-w-0 flex-1">
                <div className="break-words [overflow-wrap:anywhere] font-mono text-xs font-medium">
                  {group.label}
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {group.changes.length}{" "}
                {group.changes.length === 1 ? "change" : "changes"}
              </span>
            </>
          }
        >
          {group.fields.map((field) => (
            <ChangeLine
              key={field.id}
              change={field}
              label={field.displayPath
                .split(" › ")
                .slice(mapping ? 2 : 1)
                .join(" › ")}
            />
          ))}
        </ReviewDetails>
      ))}
    </div>
  );
}

function GroupChangeCount({
  groups,
}: {
  groups: Array<{ changes: DeepDiffEntry[] }>;
}) {
  const count = new Set(
    groups.flatMap((group) => group.changes.map((change) => change.id)),
  ).size;
  return (
    <span className="text-xs text-muted-foreground">
      {count} {count === 1 ? "change" : "changes"}
    </span>
  );
}

export function ColumnsSection({
  groups,
  entityKey,
}: {
  groups: DeepDiffColumnGroup[];
  entityKey: string;
}) {
  return groups.length ? (
    <ReviewDetails
      nodeKey={`${entityKey}:columns`}
      label="Columns"
      testId="column-changes"
      summary={
        <>
          <span className="font-medium">Columns</span>
          <span className="text-xs text-muted-foreground">
            {groups.length} affected
          </span>
          <GroupChangeCount groups={groups} />
        </>
      }
    >
      <ColumnList groups={groups} nodePrefix={entityKey} />
    </ReviewDetails>
  ) : null;
}

export function SourcesSection({
  sources,
  entityKey,
}: {
  sources: DeepDiffSourceGroup[];
  entityKey: string;
}) {
  return sources.length ? (
    <ReviewDetails
      nodeKey={`${entityKey}:sources`}
      label="External Sources"
      testId="external-source-change-section"
      summary={
        <>
          <span className="font-medium">External Sources</span>
          <span className="text-xs text-muted-foreground">
            {sources.length} affected
          </span>
          <GroupChangeCount groups={sources} />
        </>
      }
    >
      {sources.map((source) => (
        <ReviewDetails
          key={source.key}
          nodeKey={`${entityKey}:${source.key}`}
          label={`source ${source.label}`}
          testId="external-source-details"
          summary={
            <>
              <Status operation={source.operation} />
              <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] font-mono text-xs font-medium">
                {source.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {source.changes.length}{" "}
                {source.changes.length === 1 ? "change" : "changes"}
              </span>
            </>
          }
        >
          <ObjectChanges
            changes={source.objectChanges}
            sourceLabel={source.label}
            expanded
          />
          {source.columns.length ? (
            <ReviewDetails
              nodeKey={`${entityKey}:${source.key}:mappings`}
              label={`Mappings for ${source.label}`}
              testId="mapping-changes"
              summary={
                <>
                  <span className="font-medium">Mappings</span>
                  <span className="text-xs text-muted-foreground">
                    {source.columns.length} affected
                  </span>
                  <GroupChangeCount groups={source.columns} />
                </>
              }
            >
              <ColumnList
                groups={source.columns}
                nodePrefix={`${entityKey}:${source.key}`}
                mapping
              />
            </ReviewDetails>
          ) : null}
        </ReviewDetails>
      ))}
    </ReviewDetails>
  ) : null;
}
