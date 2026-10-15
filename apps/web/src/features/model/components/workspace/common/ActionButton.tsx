import * as React from "react";
import { Button } from "@datam8/ui";

export type ActionButtonProps = React.ComponentProps<typeof Button>;

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(({ size = "sm", ...props }, ref) => (
  <Button ref={ref} size={size as any} {...props} />
));

ActionButton.displayName = "ActionButton";
