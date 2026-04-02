import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("toast notification behavior", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const toasterPath = resolve(here, "../../../../../packages/ui/src/components/ui/toaster.tsx");
  const useToastPath = resolve(here, "../../../../../packages/ui/src/components/ui/use-toast.ts");

  it("supports a fixed action row and details toggle for long error messages", () => {
    const source = readFileSync(toasterPath, "utf8");

    expect(source).toContain("const MAX_INLINE_DESCRIPTION_CHARS = 140;");
    expect(source).toContain("action || canShowDetails");
    expect(source).toContain("Show details");
    expect(source).toContain("Hide details");
    expect(source).toContain("mt-auto flex items-center justify-between");
  });

  it("uses sticky destructive toasts and auto-dismiss defaults for non-errors", () => {
    const source = readFileSync(useToastPath, "utf8");

    expect(source).toContain("const INFO_TOAST_DURATION_MS = 4000;");
    expect(source).toContain("const STICKY_ERROR_DURATION_MS = 2147483647;");
    expect(source).toContain('if (props.variant === "destructive")');
    expect(source).toContain("return STICKY_ERROR_DURATION_MS;");
    expect(source).toContain("return INFO_TOAST_DURATION_MS;");
    expect(source).toContain("const userOnOpenChange = props.onOpenChange;");
    expect(source).toContain("userOnOpenChange?.(open);");
    expect(source).toContain("const wrapOnOpenChange =");
    expect(source).toContain("onOpenChange: wrapOnOpenChange(userOnOpenChange)");
  });
});
