import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { BaseEntity, FolderEntity, ModelEntity } from "../model/model-types";
import type { Solution } from "./solution-types";
import { loadSolution as loadSolutionFromSource, loadCurrentSolution, type SolutionSource } from "./solutionLoader";
import { V1SolutionDetectedError } from "./errors";
import { compactErrorMessage } from "../../shared/api/errorMessage";

type LoadSolutionResult = {
  solution: Solution;
  modelEntities: ModelEntity[];
  baseEntities: BaseEntity[];
  folderEntities: FolderEntity[];
};

type SolutionContextValue = {
  solution?: Solution;
  solutionSource?: SolutionSource | null;
  solutionPath: string;
  loading: boolean;
  error: string | null;
  migrationOpen: boolean;
  migrationSourcePath: string | null;
  pickerOpen: boolean;
  pickerInput: string;
  pickerError: string | null;
  setPickerOpen: (open: boolean) => void;
  setPickerInput: (value: string) => void;
  setPickerError: (value: string | null) => void;
  clearError: () => void;
  openMigration: (sourcePath: string) => void;
  closeMigration: () => void;
  loadSolution: (source: SolutionSource) => Promise<LoadSolutionResult | void>;
  refreshSolution: () => Promise<LoadSolutionResult>;
  beforeLoad: React.MutableRefObject<(() => Promise<void>) | null>;
};

const SolutionContext = createContext<SolutionContextValue | undefined>(undefined);

export function SolutionProvider({ children }: { children: React.ReactNode }) {
  const [solution, setSolution] = useState<Solution | undefined>();
  const [solutionSource, setSolutionSource] = useState<SolutionSource | null>(null);
  const [solutionPath, setSolutionPath] = useState("");
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const beforeLoad = useRef<(() => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationSourcePath, setMigrationSourcePath] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState("");
  const [pickerError, setPickerError] = useState<string | null>(null);

  const openMigration = useCallback((sourcePath: string) => {
    setMigrationSourcePath(sourcePath);
    setMigrationOpen(true);
  }, []);

  const closeMigration = useCallback(() => {
    setMigrationOpen(false);
    setMigrationSourcePath(null);
  }, []);

  const loadSolution = useCallback(
    async (source: SolutionSource) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      setPickerError(null);
      try {
        if (source.kind === "electron-path") await beforeLoad.current?.();
        const result = await loadSolutionFromSource(source);
        setSolution(result.solution);
        setSolutionSource(source);
        const path = source.kind === "server-path" || source.kind === "electron-path" ? source.path : "";
        setSolutionPath(path);
        setPickerInput(source.kind === "server-path" ? source.path : "");
        if (source.kind === "server-path" || source.kind === "electron-path") {
          if (path) {
            localStorage.setItem("dm8_solution_path", path);
          } else {
            localStorage.removeItem("dm8_solution_path");
          }
        } else {
          localStorage.removeItem("dm8_solution_path");
        }
        setPickerOpen(false);
        closeMigration();
        return result;
      } catch (err) {
        if (/Backend startup cancel(?:led|ed)/i.test((err as Error).message)) return;
        if (err instanceof V1SolutionDetectedError) {
          setPickerOpen(false);
          setPickerError(null);
          setError(null);
          openMigration(err.sourceSolutionPath);
          return;
        }
        const message = compactErrorMessage((err as Error).message, "Failed to load solution.");
        setError(message);
        setPickerError(message);
        if (source.kind === "server-path") {
          setPickerOpen(true);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [closeMigration, openMigration],
  );

  const clearError = useCallback(() => {
    setError(null);
    setPickerError(null);
  }, []);

  const refreshSolution = useCallback(async () => {
    const result = await loadCurrentSolution();
    setSolution(result.solution);
    return result;
  }, []);

  return (
    <SolutionContext.Provider
      value={{
        solution,
        solutionSource,
        solutionPath,
        loading,
        error,
        migrationOpen,
        migrationSourcePath,
        pickerOpen,
        pickerInput,
        pickerError,
        setPickerOpen,
        setPickerInput,
        setPickerError,
        clearError,
        openMigration,
        closeMigration,
        loadSolution,
        refreshSolution,
        beforeLoad,
      }}
    >
      {children}
    </SolutionContext.Provider>
  );
}

export function useSolution() {
  const ctx = useContext(SolutionContext);
  if (!ctx) {
    throw new Error("useSolution must be used within SolutionProvider");
  }
  return ctx;
}
