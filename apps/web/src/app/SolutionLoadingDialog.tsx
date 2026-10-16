import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@datam8/ui";
import { Loader2 } from "lucide-react";

export function SolutionLoadingDialog({ open }: { open: boolean }) {
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    if (!open) { setStarting(false); setCancelling(false); return; }
    let active = true;
    const bridge = window.desktop?.solution;
    void bridge?.isStarting?.().then(value => { if (active) setStarting(value); });
    const unsubscribe = bridge?.onStartupChanged?.(setStarting);
    return () => { active = false; unsubscribe?.(); };
  }, [open]);
  return <Dialog open={open}>
    <DialogContent onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>{starting ? "Starting backend" : "Opening solution"}</DialogTitle>
        <DialogDescription>{starting ? "The first start can take up to a minute. Please wait." : "Saving pending changes and loading the workspace. Please wait."}</DialogDescription>
      </DialogHeader>
      <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />
      {starting && <DialogFooter><Button variant="secondary" disabled={cancelling} onClick={async () => {
        setCancelling(true);
        await window.desktop?.solution?.cancelStart?.();
      }}>{cancelling ? "Cancelling…" : "Cancel"}</Button></DialogFooter>}
    </DialogContent>
  </Dialog>;
}
