import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSolution } from "./solutionLoader";

afterEach(() => vi.unstubAllGlobals());

describe("Windows-1252 solution files", () => {
  it("loads umlauts and the Windows-1252 euro sign from an uploaded solution", async () => {
    const solution = {
      schemaVersion: "2.0.0",
      basePath: "Basis für Größen €",
      modelPath: "Model",
    };
    const bytes = Uint8Array.from(
      [...JSON.stringify(solution)].map((character) => character === "€" ? 0x80 : character.charCodeAt(0)),
    );
    const loaded = await loadSolution({ kind: "uploaded-file", file: new File([bytes], "Test.dm8s") });

    expect(loaded.solution.basePath).toBe(solution.basePath);
  });

  it("rejects undefined Windows-1252 bytes", async () => {
    const file = new File([Uint8Array.of(0x81)], "Invalid.dm8s");
    await expect(loadSolution({ kind: "uploaded-file", file })).rejects.toThrow("Windows-1252");
  });

  it("continues to consume UTF-8 HTTP JSON without restricting Unicode", async () => {
    const solution = { schemaVersion: "2.0.0", basePath: "Basis 東京", modelPath: "Model" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ solution }), {
      headers: { "Content-Type": "application/json" },
    })));

    const loaded = await loadSolution({ kind: "server-path", path: "ignored" });

    expect(loaded.solution.basePath).toBe(solution.basePath);
  });
});
