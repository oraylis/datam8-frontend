import * as React from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastActionElement,
  type ToastProps,
} from "./toast";
import { useToast } from "./use-toast";

const MAX_INLINE_DESCRIPTION_CHARS = 140;

type ToastItemProps = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

function toPlainText(node: React.ReactNode): string | null {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  return null;
}

function truncateText(text: string): string {
  if (text.length <= MAX_INLINE_DESCRIPTION_CHARS) return text;
  return `${text.slice(0, MAX_INLINE_DESCRIPTION_CHARS).trimEnd()}...`;
}

function ToastItem({ id, title, description, action, ...props }: ToastItemProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const descriptionText = toPlainText(description);
  const isError = props.variant === "destructive";
  const isLongDescription = !!descriptionText && descriptionText.length > MAX_INLINE_DESCRIPTION_CHARS;
  const canShowDetails = isError && isLongDescription;
  const shouldCollapse = isLongDescription && (!canShowDetails || !detailsOpen);

  React.useEffect(() => {
    setDetailsOpen(false);
  }, [id]);

  return (
    <Toast {...props}>
      <div className="grid h-full gap-2">
        <div className="grid gap-1">
          {title ? <ToastTitle className="truncate pr-6">{title}</ToastTitle> : null}
          {description ? (
            <ToastDescription
              className={
                canShowDetails && detailsOpen
                  ? "max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-current/30 bg-black/10 p-2 text-xs leading-relaxed"
                  : "whitespace-pre-wrap break-words"
              }
            >
              {shouldCollapse && descriptionText ? truncateText(descriptionText) : description}
            </ToastDescription>
          ) : null}
        </div>
        {action || canShowDetails ? (
          <div className="mt-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">{action}</div>
            {canShowDetails ? (
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-current/40 bg-transparent px-3 text-sm font-medium text-current transition hover:bg-current/10 focus:outline-none focus:ring-2 focus:ring-current/40 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                onClick={(event) => {
                  event.preventDefault();
                  setDetailsOpen((value) => !value);
                }}
              >
                {detailsOpen ? "Hide details" : "Show details"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ToastClose />
    </Toast>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
