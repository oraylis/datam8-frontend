import { useEffect, useMemo, useState } from "react";
import type { LineageGraph } from "./buildLineageGraph";
import { prepareLineageLayout, type LineageLayout } from "./layoutLineageGraph";
import { lineageLayoutRunner } from "./lineageLayoutRuntime";

type View = { graph: LineageGraph; schemaOpen: boolean; layout: LineageLayout };

export function useLineageLayout(graph: LineageGraph, schemaOpen: boolean) {
  const input = useMemo(() => prepareLineageLayout(graph, schemaOpen), [graph, schemaOpen]);
  const key = useMemo(() => JSON.stringify(input), [input]);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; layout?: LineageLayout; error?: string }>({ key: "" });
  const [previousView, setPreviousView] = useState<View>();
  // Cache hits are available in the same render, without a loading flash.
  const layout = lineageLayoutRunner.peek(key) ?? (state.key === key ? state.layout : undefined);
  const error = state.key === key ? state.error : undefined;
  const pending = !layout && !error;
  const [indicatorKey, setIndicatorKey] = useState("");
  useEffect(() => {
    if (layout) setPreviousView({ graph, schemaOpen, layout });
  }, [graph, schemaOpen, layout]);
  useEffect(() => {
    if (lineageLayoutRunner.peek(key)) return;
    let active = true;
    let cancel: (() => void) | undefined;
    // Coalesce rapid changes and React StrictMode's initial effect replay.
    const timer = setTimeout(() => {
      const request = lineageLayoutRunner.request(key, JSON.parse(key));
      cancel = request.cancel;
      void request.promise.then((result) => {
        if (active) setState({ key, layout: result });
      }).catch(() => {
        if (active) setState({ key, error: "Could not arrange lineage. Try a smaller view or retry." });
      });
    }, 40);
    return () => { active = false; clearTimeout(timer); cancel?.(); };
  }, [key, retry]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setIndicatorKey(key), 250);
    return () => clearTimeout(timer);
  }, [key, pending, retry]);
  return {
    view: layout ? { graph, schemaOpen, layout } : previousView,
    pending, showProgress: pending && indicatorKey === key, error,
    retry: () => { setState({ key }); setRetry((value) => value + 1); },
  };
}
