import test from "node:test";
import assert from "node:assert/strict";
import { checkMarkdown, headingAnchors, checkCapture, checkTargetDocumentation } from "./check-docs.mjs";

test("checks local links, images and anchors without reading example code as prose", () => {
  const file = "/docs/guide.md";
  const files = new Map([[file, "# Guide\n\n## Open & Save\n\n"]]);
  const source = "# Guide\n\n[valid](#open--save)\n[broken](#missing)\n![Image](missing.png)\n\n```md\n[example](not-a-real-file.md)\n```\n\n## Open & Save\n\n";
  files.set(file, source);
  const errors = checkMarkdown(file, source, name => files.get(name), name => files.has(name));
  assert.equal(errors.length, 2);
  assert.ok(errors.some(error => error.includes("missing heading")));
  assert.ok(errors.some(error => error.includes("missing local target")));
});

test("handles duplicate heading fragments and referenced links", () => {
  const source = "# Guide\n\n## Save\n\n## Save\n\n[second](#save-1)\n[ref][home]\n\n[home]: https://example.com\n";
  assert.ok(headingAnchors(source).has("save-1"));
  assert.deepEqual(checkMarkdown("/guide.md", source, () => source, () => true), []);
});

test("reports empty alt text and heading spacing", () => {
  const source = "# Guide\nNo blank line\n![](image.png)\n";
  const errors = checkMarkdown("/guide.md", source, () => "", () => true);
  assert.equal(errors.length, 2);
});

test("capture evidence rejects incomplete exports, missing images and failed acceptance", () => {
  const manifest = {
    frontendCommit: "a".repeat(40), backendCommit: "b".repeat(40),
    schemaCommit: "c".repeat(40), sampleCommit: "d".repeat(40),
    screenshots: Array.from({ length: 22 }, (_, i) => ({ file: `${String(i + 1).padStart(2, "0")}-example.png`, description: "Real state", status: "captured" })),
    checks: Array.from({ length: 5 }, () => ({ result: "PASS" })),
  };
  assert.deepEqual(checkCapture(manifest, "/assets", () => true), []);
  assert.equal(checkCapture(manifest, "/assets", () => false).length, 22);
  manifest.checks[0].result = "FAIL";
  manifest.screenshots[1].file = manifest.screenshots[0].file;
  const errors = checkCapture(manifest, "/assets", () => true);
  assert.ok(errors.some(error => error.includes("unique")));
  assert.ok(errors.some(error => error.includes("passing")));
});

test("target reference detects stale output paths and omitted targets", () => {
  const solution = { generatorTargets: [{ name: "docs", sourcePath: "Generate/docs", outputPath: "Output/docs" }] };
  assert.deepEqual(checkTargetDocumentation("| docs | `Generate/docs` | `Output/docs` |\n", solution), []);
  assert.equal(checkTargetDocumentation("| docs | `Generate/docs` | `Output/old` |\n", solution).length, 1);
  assert.equal(checkTargetDocumentation("No target rows\n", solution).length, 2);
});
