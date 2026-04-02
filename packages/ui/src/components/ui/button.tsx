import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-primary/40 bg-primary text-primary-foreground shadow-none hover:border-primary/60 hover:bg-primary/95",
        secondary:
          "border border-border/70 bg-card/82 text-foreground shadow-sm hover:border-border hover:bg-elevated/70",
        utility:
          "border border-border/70 bg-elevated/75 text-foreground shadow-sm hover:border-ring/40 hover:bg-elevated",
        ghost:
          "border border-transparent bg-transparent text-foreground shadow-none hover:border-border/60 hover:bg-foreground/5",
        outline:
          "border border-border bg-transparent text-foreground shadow-none hover:border-border/90 hover:bg-card/55",
        destructive:
          "border border-destructive/55 bg-destructive/90 text-destructive-foreground shadow-sm hover:bg-destructive",
        subtle:
          "border border-border/65 bg-card/55 text-foreground/90 shadow-none hover:bg-card/75",
        link: "border-transparent bg-transparent p-0 text-primary shadow-none hover:text-primary/90 hover:underline",
        sidebar:
          "w-full justify-start rounded-lg border border-transparent bg-transparent px-3.5 text-left text-[13px] font-normal leading-5 text-foreground/88 shadow-none hover:border-border/60 hover:bg-foreground/6",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-4",
        icon: "h-9 w-9",
      },
    },
    compoundVariants: [
      {
        variant: "sidebar",
        size: "sm",
        className: "h-8 px-3",
      },
      {
        variant: "sidebar",
        size: "lg",
        className: "h-10 px-4",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} data-variant={variant ?? "default"} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
