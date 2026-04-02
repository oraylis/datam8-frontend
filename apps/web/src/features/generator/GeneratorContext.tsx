import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSolution } from "../solution/SolutionContext";
import { apiBase } from "../../config";
import { useErrorSurface } from "../../shared/ui/ErrorSurface";

type GeneratorLogLevel = "debug" | "info" | "warning" | "error" | "critical";

type GeneratorContextValue = {
  generatorTargets: string[];
  generatorTarget: string;
  generatorLog: string;
  generatorStderr: string | null;
  generatorExit: number | null;
  generatorError: string | null;
  generatorRunning: boolean;
  generatorLogLevel: GeneratorLogLevel;
  setGeneratorTarget: (value: string) => void;
  setGeneratorLogLevel: (value: GeneratorLogLevel) => void;
  runGenerator: (targetOverride?: string) => Promise<void>;
};

type GenerateResponse = {
  status: string;
  target: string;
  outputPath: string;
  messages?: string[];
};

const GeneratorContext = createContext<GeneratorContextValue | undefined>(undefined);

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
    const maybeError = (payload as { error?: { message?: unknown } }).error?.message;
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError;
    }
  }
  return fallback;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeMessageLines(values: string[]): string[] {
  const lines: string[] = [];
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

  for (const value of values) {
    const split = value
      .split(/\r\n|\n|\r/g)
      .map((line) => line.replace(ansiRegex, "").trim())
      .filter((line) => line.length > 0);
    lines.push(...split);
  }

  return lines;
}

function readGenerateMessages(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];

  const direct = normalizeMessageLines(toStringList((payload as { messages?: unknown }).messages));
  if (direct.length > 0) return direct;

  const single = normalizeMessageLines(
    toStringList([
      (payload as { message?: unknown }).message,
      (payload as { details?: { message?: unknown } }).details?.message,
    ]),
  );
  if (single.length > 0) return single;

  const nested = normalizeMessageLines(
    toStringList((payload as { details?: { messages?: unknown } }).details?.messages),
  );
  if (nested.length > 0) return nested;

  return [];
}

export function GeneratorProvider({ children }: { children: React.ReactNode }) {
  const { solution, solutionPath } = useSolution();
  const { showError, clearError } = useErrorSurface();
  const [generatorTarget, setGeneratorTarget] = useState<string>("default");
  const [generatorLogLevel, setGeneratorLogLevel] = useState<GeneratorLogLevel>("info");
  const [generatorLog, setGeneratorLog] = useState("");
  const [generatorStderr, setGeneratorStderr] = useState<string | null>(null);
  const [generatorExit, setGeneratorExit] = useState<number | null>(null);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [generatorRunning, setGeneratorRunning] = useState(false);
  const runInFlightRef = useRef(false);

  const generatorTargets = useMemo(() => {
    const targets = solution?.generatorTargets?.map((t) => t.name).filter((name): name is string => !!name);
    return targets || [];
  }, [solution]);

  useEffect(() => {
    const defaultTarget = solution?.generatorTargets?.find((t) => t.isDefault)?.name;
    if (defaultTarget) {
      setGeneratorTarget(defaultTarget);
    } else if (generatorTargets.length > 0) {
      setGeneratorTarget(generatorTargets[0]);
    } else {
      setGeneratorTarget("");
    }
  }, [solution, generatorTargets]);

  const runGenerator = useCallback(
    async (targetOverride?: string) => {
      if (runInFlightRef.current) {
        return;
      }

      const validTargetOverride = typeof targetOverride === "string" ? targetOverride : undefined;
      const target = validTargetOverride || generatorTarget || generatorTargets[0];
      if (!target) {
        showError("app", {
          title: "No target configured",
          description: "Add a generator target in the solution before running generation.",
        });
        return;
      }
      runInFlightRef.current = true;

      setGeneratorRunning(true);
      setGeneratorLog("");
      setGeneratorStderr(null);
      setGeneratorError(null);
      setGeneratorExit(null);
      clearError("app");

      try {
        const desktopGenerate = window.desktop?.solution?.generate;
        if (desktopGenerate && solutionPath) {
          const result = await desktopGenerate({
            solutionPath,
            target,
            logLevel: generatorLogLevel,
          });
          const payload = {
            messages: Array.isArray(result?.messages) ? result?.messages : result?.message ? [result.message] : [],
            target: result?.target || target,
          } as Record<string, unknown>;
          const messages = readGenerateMessages(payload);
          if (result?.success === false) {
            if (messages.length > 0) {
              setGeneratorLog(messages.join("\n"));
            }
            throw new Error(readErrorMessage(payload, "Generation failed."));
          }

          if (messages.length > 0) {
            setGeneratorLog(messages.join("\n"));
          } else {
            setGeneratorLog(`Generation completed for target '${target}'.`);
          }
          setGeneratorExit(0);
          return;
        }

        const res = await fetch(`${apiBase}/model/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target,
            logLevel: generatorLogLevel,
            cleanOutput: true,
            payloads: [],
          }),
        });

        const json = (await res.json().catch(() => ({}))) as GenerateResponse | Record<string, unknown>;
        const messages = readGenerateMessages(json);
        if (!res.ok) {
          if (messages.length > 0) {
            setGeneratorLog(messages.join("\n"));
          }
          throw new Error(readErrorMessage(json, `Generation failed (${res.status}).`));
        }

        const payload = json as GenerateResponse;
        if (messages.length > 0) {
          setGeneratorLog(messages.join("\n"));
        } else {
          setGeneratorLog(`Generation succeeded for target '${payload.target}'.\nOutput: ${payload.outputPath}`);
        }
        setGeneratorExit(0);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        showError("app", {
          title: "Generator execution failed",
          description: errorMessage,
        });
        setGeneratorError(errorMessage);
        setGeneratorExit(1);
      } finally {
        runInFlightRef.current = false;
        setGeneratorRunning(false);
      }
    },
    [clearError, generatorLogLevel, generatorTarget, generatorTargets, showError, solutionPath],
  );

  return (
    <GeneratorContext.Provider
      value={{
        generatorTargets,
        generatorTarget,
        generatorLog,
        generatorStderr,
        generatorExit,
        generatorError,
        generatorRunning,
        generatorLogLevel,
        setGeneratorTarget,
        setGeneratorLogLevel,
        runGenerator,
      }}
    >
      {children}
    </GeneratorContext.Provider>
  );
}

export function useGenerator() {
  const ctx = useContext(GeneratorContext);
  if (!ctx) {
    throw new Error("useGenerator must be used within a GeneratorProvider");
  }
  return ctx;
}
