import * as React from "react";

import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-border/75 bg-input/95 px-3 py-2 text-[13px] leading-5 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors placeholder:text-muted-foreground/86 focus-visible:outline-none focus-visible:border-ring/55 focus-visible:shadow-[0_0_0_1px_color-mix(in_srgb,hsl(var(--ui-ring))_38%,transparent),0_10px_22px_rgba(0,0,0,0.14)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
