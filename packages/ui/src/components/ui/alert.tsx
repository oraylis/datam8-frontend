import * as React from "react";
import { cn } from "../../lib/utils";

const alertVariants = {
  default: "border-border/80 bg-card/82 text-foreground",
  destructive: "border-destructive/42 text-destructive bg-destructive/16",
  success: "border-primary/40 text-foreground bg-primary/14",
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof alertVariants;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "default", ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "relative w-full rounded-xl border px-4 py-3 text-[13px] leading-5 shadow-sm",
        alertVariants[variant],
        className,
      )}
      {...props}
    />
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 text-[13px] font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-[13px] leading-relaxed text-current", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
