import { Badge } from "@datam8/ui";

type SaveStatus = "idle" | "saving" | "error" | "success";

export function SaveStatusBadge({ status, error }: { status: SaveStatus; error?: string | null }) {
  if (status === "idle") return null;

  const label = status === "saving" ? "Saving…" : status === "success" ? "Saved" : "Save failed";
  const variant = status === "saving" ? "secondary" : status === "success" ? "muted" : "destructive";

  return (
    <Badge variant={variant} title={status === "error" ? error || "Save failed." : undefined}>
      {label}
    </Badge>
  );
}

