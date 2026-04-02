import { createContext, useCallback, useContext, useState } from "react";
import type { BaseEntity, FolderEntity, ModelEntity } from "../model/model-types";
import type { Solution } from "./solution-types";
import { loadSolution as loadSolutionFromSource, type SolutionSource } from "./solutionLoader";
import { V1SolutionDetectedError } from "./errors";

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
};

const SolutionContext = createContext<SolutionContextValue | undefined>(undefined);

export function SolutionProvider({ children }: { children: React.ReactNode }) {
  const [solution, setSolution] = useState<Solution | undefined>();
  const [solutionSource, setSolutionSource] = useState<SolutionSource | null>(null);
  const [solutionPath, setSolutionPath] = useState("");
  const [loading, setLoading] = useState(false);
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
      setLoading(true);
      setError(null);
      setPickerError(null);
      try {
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
        if (err instanceof V1SolutionDetectedError) {
          setPickerOpen(false);
          setPickerError(null);
          setError(null);
          openMigration(err.sourceSolutionPath);
          return;
        }
        const message = (err as Error).message;
        setError(message);
        setPickerError(message);
        if (source.kind === "server-path") {
          setPickerOpen(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [closeMigration, openMigration],
  );

  const clearError = useCallback(() => {
    setError(null);
    setPickerError(null);
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
