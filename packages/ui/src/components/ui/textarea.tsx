import * as React from "react";

import { cn } from "../../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[92px] w-full rounded-md border border-border/75 bg-input/95 px-3 py-2 text-[13px] leading-5 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors placeholder:text-muted-foreground/86 focus-visible:outline-none focus-visible:border-ring/55 focus-visible:shadow-[0_0_0_1px_color-mix(in_srgb,hsl(var(--ui-ring))_38%,transparent),0_10px_22px_rgba(0,0,0,0.14)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
