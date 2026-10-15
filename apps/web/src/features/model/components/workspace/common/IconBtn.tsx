import type React from "react";
import { Button, cn } from "@datam8/ui";

export type IconBtnProps = React.ComponentProps<typeof Button> & { active?: boolean };

export const IconBtn = ({ active, className, ...props }: IconBtnProps) => (
  <Button
    variant="ghost"
    size="icon"
    className={cn("icon-btn", active ? "icon-btn--active" : "", className)}
    {...props}
  />
);
