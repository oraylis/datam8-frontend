import { useEffect, useState } from "react";
import { apiBase } from "../../../../config";
import { readBackendErrorMessage } from "../../../../shared/api/errorMessage";

export type SourceCapabilities = { listSource: boolean; metadata: boolean; previewData: boolean };

export function useSourceCapabilities(dataSource: string | null | undefined, connection?: unknown) {
  const [state, setState] = useState<{
    source: string; connection?: unknown; capabilities: SourceCapabilities | null; error: string | null;
  }>({ source: "", capabilities: null, error: null });
  useEffect(() => {
    if (!dataSource) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/sources/${encodeURIComponent(dataSource)}/capabilities`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(readBackendErrorMessage(payload, "Failed to load source capabilities"));
        if (!controller.signal.aborted) setState({ source: dataSource, connection, capabilities: {
          listSource: payload.listSource === true,
          metadata: payload.metadata === true,
          previewData: payload.previewData === true,
        }, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setState({ source: dataSource, connection, capabilities: null, error: (error as Error).message });
      }
    })();
    return () => controller.abort();
  }, [dataSource, connection]);
  return state.source === dataSource && state.connection === connection ? state : { capabilities: null, error: null };
}
