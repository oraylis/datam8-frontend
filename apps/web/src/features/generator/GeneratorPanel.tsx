import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@datam8/ui";
import { ChevronDown, Loader2, Play, ShieldCheck, X } from "lucide-react";

type GeneratorLogLevel = "debug" | "info" | "warning" | "error" | "critical";

// Basic ANSI stripper to clean up CLI output
const stripAnsi = (str: string) =>
  str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");

export function GeneratorPanel({
  targets,
  onRun,
  onValidate,
  onClose,
  running,
  selectedTarget,
  onSelectTarget,
  selectedLogLevel,
  onSelectLogLevel,
  log,
  stderr,
  error,
}: {
  targets: string[];
  onRun: () => void;
  onValidate: () => void;
  onClose: () => void;
  running: boolean;
  selectedTarget: string;
  onSelectTarget: (value: string) => void;
  selectedLogLevel: GeneratorLogLevel;
  onSelectLogLevel: (value: GeneratorLogLevel) => void;
  log: string;
  stderr?: string | null;
  error: string | null;
}) {
  const logLevelOptions: GeneratorLogLevel[] = ["debug", "info", "warning", "error", "critical"];

  return (
    <Card
      className={cn("generator-drawer generator-drawer--expanded flex flex-col border-border/70 bg-card/80 shadow-md")}
    >
      <CardHeader className="px-4 py-2">
        <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
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
            <div className="ml-auto inline-flex shrink-0" data-testid="generator-actions">
              <Button
                size="sm"
                className="min-w-[120px] rounded-r-none"
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
                    Generate
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                    disabled={running}
                    aria-label="More generator actions"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onValidate}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Validate only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={onClose}
            aria-label="Close generator panel"
            title="Close generator panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex flex-1 gap-3 px-4 pb-4 pt-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {!error && stderr ? (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
              <strong>Stderr Output:</strong>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs opacity-90">{stripAnsi(stderr)}</pre>
            </div>
          ) : null}

          <div
            className="generator-panel__output min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground"
            data-testid="generator-log-output"
          >
            {log ? (
              <div className="space-y-1">
                {stripAnsi(log).split("\n").map((line, idx) => (
                  <div key={idx} className={cn("min-h-[1.2em]", line.startsWith("Error:") ? "text-destructive font-medium" : "text-foreground")}>
                    {line || " "}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">No logs yet.</span>
            )}
          </div>
        </div>
        <div className="w-9 shrink-0" aria-hidden="true" />
      </CardContent>
    </Card>
  );
}
