import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "../../lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-2xl border border-border/70 bg-card/75 p-1 text-muted-foreground backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:bg-elevated/85 data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 rounded-2xl border border-border/70 bg-card/75 p-4 text-foreground backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
