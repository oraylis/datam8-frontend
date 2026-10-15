import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60 focus:ring-offset-0",
  {
    variants: {
      variant: {
        default: "border-primary/50 bg-primary/14 text-primary",
        secondary: "border-border/75 bg-card/72 text-foreground",
        outline: "border-border/80 bg-transparent text-foreground/92",
        muted: "border-border/65 bg-foreground/6 text-muted-foreground",
        destructive: "border-destructive/45 bg-destructive/18 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
