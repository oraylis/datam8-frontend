import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@datam8/ui";
import { ActionButton } from "../../src/features/model/components/workspace/common/ActionButton";
import "@datam8/ui/styles.css";
import "../../src/index.css";

document.documentElement.className =
  new URL(location.href).searchParams.get("theme") || "light";

function ButtonFeedbackFixture() {
  const [dialog, setDialog] = useState<"cancel" | "back" | null>(null);
  return (
    <main
      style={{
        padding: 32,
        background: "hsl(var(--ui-surface-dialog))",
        minHeight: "100vh",
      }}
    >
      <h1>Button feedback</h1>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 24, paddingBlock: 24 }}
      >
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="utility">Utility</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="subtle">Subtle</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button variant="sidebar">Sidebar</Button>
        <Button size="icon" aria-label="Shared icon">
          +
        </Button>
        <ActionButton variant="outline">Action wrapper</ActionButton>
        <Button variant="outline" disabled>
          Disabled
        </Button>
        <Button asChild variant="outline">
          <a href="#" aria-disabled="true">
            ARIA disabled
          </a>
        </Button>
      </div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 24, paddingBlock: 24 }}
      >
        <button className="btn">Legacy</button>
        <button className="btn btn--primary">Legacy primary</button>
        <button className="btn btn--ghost">Legacy ghost</button>
        <button className="icon-btn" aria-label="Legacy icon">
          +
        </button>
        <button
          className="icon-btn icon-btn--active"
          aria-label="Selected icon"
          aria-pressed="true"
        >
          ✓
        </button>
        <button className="btn" disabled>
          Legacy disabled
        </button>
        <button className="icon-btn" aria-label="Legacy disabled icon" disabled>
          +
        </button>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <Button variant="outline" onClick={() => setDialog("cancel")}>
          Open cancel dialog
        </Button>
        <Button variant="outline" onClick={() => setDialog("back")}>
          Open back dialog
        </Button>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "cancel" ? "Cancel feedback" : "Back feedback"}
            </DialogTitle>
          </DialogHeader>
          <p>All buttons use the shared feedback policy.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {dialog === "cancel" ? "Cancel" : "Back"}
            </Button>
            <Button>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ButtonFeedbackFixture />);
