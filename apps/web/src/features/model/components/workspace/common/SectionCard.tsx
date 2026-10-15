import type React from "react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@datam8/ui";

type SectionCardProps = {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export const SectionCard = ({ title, subtitle, actions, children, className, contentClassName }: SectionCardProps) => {
  return (
    <Card className={cn("dm8-framed-card", className)}>
      <CardHeader className={cn("section-card__header flex flex-row justify-between space-y-0", subtitle ? "items-start" : "items-center")}>
        <div>
          <CardTitle className="section-card__title text-base font-semibold">{title}</CardTitle>
          {subtitle ? <div className="muted small mt-1">{subtitle}</div> : null}
        </div>
        {actions ? <div className="section-card__actions flex items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn("section-card__content pt-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
};
