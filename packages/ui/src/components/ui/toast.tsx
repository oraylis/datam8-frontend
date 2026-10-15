import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed right-3 top-3 z-50 flex max-h-screen w-full max-w-sm flex-col gap-2 p-2 outline-none sm:right-4 sm:top-4 sm:max-w-md",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex min-h-[108px] w-full flex-col justify-between gap-3 overflow-hidden rounded-2xl border p-3 pr-10 shadow-[0_14px_38px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all",
  {
    variants: {
      variant: {
        default: "border-border/75 bg-popover/95 text-popover-foreground",
        destructive: "border-destructive/45 bg-destructive/20 text-destructive-foreground",
        success: "border-primary/45 bg-primary/18 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      data-variant={variant ?? "default"}
      className={cn(
        toastVariants({ variant }),
        "data-[swipe=move]:transition-none data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:duration-200 data-[swipe=cancel]:ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-3",
        className,
      )}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-current/35 bg-transparent px-3 text-sm font-medium text-current transition hover:bg-current/12 focus:outline-none focus:ring-2 focus:ring-current/35 focus:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-current/70 transition hover:bg-current/10 hover:text-current focus:outline-none focus:ring-2 focus:ring-current/35 focus:ring-offset-0",
      className,
    )}
    toast-close=""
    {...props}
  >
    x
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm text-current/90", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastActionElement,
  type ToastProps,
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};
