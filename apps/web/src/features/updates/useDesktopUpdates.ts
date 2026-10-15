import { useEffect, useRef, useState } from "react";
import type { DesktopUpdateStatus, UpdatePreparation } from "@datam8/types";

export function useDesktopUpdates(prepare: () => Promise<UpdatePreparation>) {
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
  const prepareRef = useRef(prepare);
  useEffect(() => { prepareRef.current = prepare; }, [prepare]);
  useEffect(() => {
    const bridge = window.desktop?.updates;
    if (!bridge) return;
    let live = true, receivedEvent = false;
    const changed = bridge.onStatusChanged(next => { receivedEvent = true; if (live) setStatus(next); });
    void bridge.getStatus().then(next => { if (live && !receivedEvent) setStatus(next); }).catch(() => {});
    const preparing = bridge.onPrepareInstall(id => {
      void (async () => {
        let result: UpdatePreparation;
        try { result = await prepareRef.current(); }
        catch (error) { result = { ok: false, reason: error instanceof Error ? error.message : "Could not save open changes." }; }
        await bridge.completePreparation(id, result);
      })().catch(() => {});
    });
    return () => { live = false; changed(); preparing(); };
  }, []);
  return status;
}
