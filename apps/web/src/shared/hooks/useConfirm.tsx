import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@datam8/ui";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type Pending = {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
} | null;

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const resolve = useCallback(
    (result: boolean) => {
      if (pending) {
        pending.resolve(result);
      }
      setPending(null);
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => !open && resolve(false)}>
        <DialogContent
          className="max-w-md"
          onEnter={() => resolve(true)}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            confirmButtonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{pending?.options.title || "Are you sure?"}</DialogTitle>
            {pending?.options.description ? <DialogDescription>{pending.options.description}</DialogDescription> : null}
          </DialogHeader>
          <DialogFooter className="border-t border-border/70 pt-4">
            <Button variant="ghost" onClick={() => resolve(false)}>
              {pending?.options.cancelText || "Cancel"}
            </Button>
            <Button ref={confirmButtonRef} onClick={() => resolve(true)}>{pending?.options.confirmText || "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx.confirm;
}
