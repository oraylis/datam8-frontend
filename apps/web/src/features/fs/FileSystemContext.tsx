import { createContext, useCallback, useContext, useState } from "react";
import { toast } from "@datam8/ui";
import { apiBase } from "../../config";

export type FsEntry = { name: string; path: string; type: "file" | "dir" };

type FileSystemContextValue = {
  fsPath: string;
  fsEntries: FsEntry[];
  fsLoading: boolean;
  fsError: string | null;
  loadFs: (path?: string) => Promise<void>;
};

const FileSystemContext = createContext<FileSystemContextValue | undefined>(undefined);

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
  const [fsPath, setFsPath] = useState("");
  const [fsEntries, setFsEntries] = useState<FsEntry[]>([]);
  const [fsLoading, setFsLoading] = useState(false);
  const [fsError, setFsError] = useState<string | null>(null);

  const loadFs = useCallback(async (path?: string) => {
    setFsLoading(true);
    setFsError(null);
    try {
      const q = path ? `?path=${encodeURIComponent(path)}` : "";
      const res = await fetch(`${apiBase}/fs/list${q}`);
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const serverMsg = typeof (errPayload as any)?.message === "string" ? (errPayload as any).message.trim() : "";
        throw new Error(serverMsg || "Failed to load the file list. Check the backend connection and try again.");
      }
      const data = await res.json();
      setFsEntries(data.entries || []);
      setFsPath(path || "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load files";
      setFsError(message);
      toast({ variant: "destructive", title: "File system error", description: message });
    } finally {
      setFsLoading(false);
    }
  }, []);

  return (
    <FileSystemContext.Provider value={{ fsPath, fsEntries, fsLoading, fsError, loadFs }}>
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

