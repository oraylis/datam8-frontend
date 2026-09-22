import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFunctionSource,
  deleteFunctionSource,
  readFunctionSource,
  renameFunctionSource,
  saveFunctionSource,
} from "./functionSourceBridge";

describe("functionSourceBridge", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/functions/1/1") && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            item: {
              source_code: "def transform(df):\n    return df\n",
              source_file_path: "C:\\solution\\model\\020_gold\\clean_data.py",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/functions/1/1") && init?.method === "POST") {
        return new Response(JSON.stringify({ item: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/functions/1/1/move")) {
        return new Response(JSON.stringify({ item: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method || "GET"}`);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads snake_case source_code from the Generator Functions API", async () => {
    const content = await readFunctionSource({
      relPath: "model/020_gold/api_audit_function_entity.json",
      source: "clean_data.py",
      modelEntityId: 1,
      stepNo: 1,
    });

    expect(content).toBe("def transform(df):\n    return df\n");
  });

  it("updates function source through POST /functions/{modelEntityId}/{stepNo}", async () => {
    await saveFunctionSource({
      relPath: "model/020_gold/api_audit_function_entity.json",
      source: "clean_data.py",
      modelEntityId: 1,
      stepNo: 1,
      content: "def transform(df):\n    return df.limit(10)\n",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/functions\/1\/1$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sourceCode: "def transform(df):\n    return df.limit(10)\n" }),
      }),
    );
  });

  it("moves function source through POST /functions/{modelEntityId}/{stepNo}/move", async () => {
    await renameFunctionSource({
      relPath: "model/020_gold/api_audit_function_entity.json",
      fromSource: "clean_data.py",
      toSource: "functions/clean_data.py",
      modelEntityId: 1,
      stepNo: 1,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/functions\/1\/1\/move$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ newPath: "functions/clean_data.py", force: true }),
      }),
    );
  });

  it("creates a function source through the temporary Electron file bridge", async () => {
    const saveFunctionSourceToDisk = vi.fn(async () => ({ path: "model/entity/clean_data.py" }));
    vi.stubGlobal("window", {
      desktop: {
        isElectron: true,
        solution: { saveFunctionSource: saveFunctionSourceToDisk },
      },
    });

    await createFunctionSource({
      relPath: "model/020_gold/entity.json",
      source: "clean_data.py",
      entityName: "entity",
    });

    expect(saveFunctionSourceToDisk).toHaveBeenCalledWith(
      expect.objectContaining({ source: "clean_data.py", content: "" }),
    );
  });

  it("deletes a function source through the temporary Electron file bridge", async () => {
    const deleteFunctionSourceFromDisk = vi.fn(async () => ({ path: "model/entity/clean_data.py" }));
    vi.stubGlobal("window", {
      desktop: {
        isElectron: true,
        solution: { deleteFunctionSource: deleteFunctionSourceFromDisk },
      },
    });

    await deleteFunctionSource({
      relPath: "model/020_gold/entity.json",
      source: "clean_data.py",
    });

    expect(deleteFunctionSourceFromDisk).toHaveBeenCalledWith(
      expect.objectContaining({ source: "clean_data.py" }),
    );
  });
});
