import { createContext, useCallback, useContext, useState } from "react";
import { apiBase } from "../../config";

export type FsEntry = { name: string; path: string; type: "file" | "dir" };

type FileSystemContextValue = {
  fsPath: string;
  fsEntries: FsEntry[];
  fsLoading: boolean;
  loadFs: (path?: string) => Promise<void>;
};

const FileSystemContext = createContext<FileSystemContextValue | undefined>(undefined);

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
  const [fsPath, setFsPath] = useState("");
  const [fsEntries, setFsEntries] = useState<FsEntry[]>([]);
  const [fsLoading, setFsLoading] = useState(false);

  const loadFs = useCallback(async (path?: string) => {
    setFsLoading(true);
    try {
      const q = path ? `?path=${encodeURIComponent(path)}` : "";
      const res = await fetch(`${apiBase}/fs/list${q}`);
      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }
      const data = await res.json();
      setFsEntries(data.entries || []);
      setFsPath(path || "");
    } finally {
      setFsLoading(false);
    }
  }, []);

  return (
    <FileSystemContext.Provider value={{ fsPath, fsEntries, fsLoading, loadFs }}>
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystem() {
  const ctx = useContext(FileSystemContext);
  if (!ctx) {
    throw new Error("useFileSystem must be used within FileSystemProvider");
  }
  return ctx;
}

