import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@datam8/ui";
import { Loader2, Play } from "lucide-react";

type GeneratorLogLevel = "debug" | "info" | "warning" | "error" | "critical";

// Basic ANSI stripper to clean up CLI output
const stripAnsi = (str: string) =>
  str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");

export function GeneratorPanel({
  targets,
  onRun,
  running,
  selectedTarget,
  onSelectTarget,
  selectedLogLevel,
  onSelectLogLevel,
  log,
  stderr,
  exitCode,
  error,
}: {
  targets: string[];
  onRun: () => void;
  running: boolean;
  selectedTarget: string;
  onSelectTarget: (value: string) => void;
  selectedLogLevel: GeneratorLogLevel;
  onSelectLogLevel: (value: GeneratorLogLevel) => void;
  log: string;
  stderr?: string | null;
  exitCode: number | null;
  error: string | null;
}) {
  const logLevelOptions: GeneratorLogLevel[] = ["debug", "info", "warning", "error", "critical"];

  const statusBadge =
    running ? (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Running
      </Badge>
    ) : error ? (
      <Badge variant="destructive">Failed</Badge>
    ) : exitCode === null ? (
      <Badge variant="muted">Idle</Badge>
    ) : exitCode === 0 ? (
      <Badge variant="muted">OK</Badge>
    ) : (
      <Badge variant="secondary">Exit {exitCode}</Badge>
    );

  return (
    <Card
      className={cn("generator-drawer generator-drawer--expanded flex flex-col border-border/70 bg-card/80 shadow-md")}
    >
      <CardHeader className="px-4 py-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 px-2 py-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground">Generator</span>
              {statusBadge}
            </div>
          </div>
          <Button
            size="sm"
            className="min-w-[120px]"
            onClick={onRun}
            disabled={!selectedTarget || running}
          >
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

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedTarget || ""} onValueChange={onSelectTarget} disabled={!targets.length || running}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select target" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedLogLevel}
              onValueChange={(value) => onSelectLogLevel(value as GeneratorLogLevel)}
              disabled={running}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Log Level" />
              </SelectTrigger>
              <SelectContent>
                {logLevelOptions.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex flex-1 flex-col gap-3 pb-4">
        {!error && stderr ? (
          <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <strong>Stderr Output:</strong>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs opacity-90">{stripAnsi(stderr)}</pre>
          </div>
        ) : null}

        <div className="generator-panel__output min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
          {log ? (
            <div className="space-y-1">
              {stripAnsi(log).split("\n").map((line, idx) => (
                <div key={idx} className="text-foreground min-h-[1.2em]">
                  {line || " "}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">No logs yet.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
