import { Badge, Button, Card, CardContent, CardHeader, cn } from "@datam8/ui";
import { Loader2, Play } from "lucide-react";

export function ValidatorPanel({
  running,
  messages,
  resolvedSolutionPath,
  error,
  canRun,
  onRun,
}: {
  running: boolean;
  messages: string[];
  resolvedSolutionPath: string | null;
  error: string | null;
  canRun: boolean;
  onRun: () => void;
}) {
  const statusBadge = running ? (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Running
    </Badge>
  ) : error ? (
    <Badge variant="destructive">Failed</Badge>
  ) : messages.length || resolvedSolutionPath ? (
    <Badge variant="muted">Done</Badge>
  ) : (
    <Badge variant="muted">Idle</Badge>
  );

  return (
    <Card
      className={cn("validator-drawer validator-drawer--expanded flex flex-col border-border/70 bg-card/80 shadow-md")}
    >
      <CardHeader className="px-4 py-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 px-2 py-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground">Validator</span>
              {statusBadge}
            </div>
          </div>
          <Button size="sm" className="min-w-[120px]" onClick={onRun} disabled={!canRun || running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex flex-1 flex-col gap-3 pb-4">
        <div className="validator-panel__output min-h-0 flex-1 overflow-auto rounded-md border border-border/70 bg-background/60 p-3 font-mono text-[11px] text-foreground">
          {messages.length ? (
            <div className="space-y-1">
              {messages.map((line, idx) => (
                <div key={`${idx}-${line.slice(0, 32)}`} className="min-h-[1.2em] break-words">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">
              {running
                ? "Validation running..."
                : !error && resolvedSolutionPath
                  ? "Validation completed. No backend messages."
                  : "Run validation to check whether the loaded solution model is valid."}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
