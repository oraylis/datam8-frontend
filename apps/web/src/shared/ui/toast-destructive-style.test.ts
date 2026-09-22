import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("destructive toast styling", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const toastComponentPath = resolve(here, "../../../../../packages/ui/src/components/ui/toast.tsx");

  it("defines inherited contrast classes so destructive text cannot fall back to muted gray", () => {
    const source = readFileSync(toastComponentPath, "utf8");

    expect(source).toContain('data-variant={variant ?? "default"}');
    expect(source).toContain("text-sm text-current/90");
    expect(source).toContain("text-current/70");
    expect(source).toContain("text-current");
    expect(source).not.toContain("text-muted-foreground");
  });
});
