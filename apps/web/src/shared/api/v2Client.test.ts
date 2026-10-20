import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneEntity, createEntity, deleteEntity, moveEntities, moveSingleEntity, patchEntity, renameEntity } from "./v2Client";

describe("v2Client.moveEntities", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/entities/move")) {
        return new Response(JSON.stringify({ items: [{ locator: "moved" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/entities/move-single")) {
        return new Response(JSON.stringify({ item: { locator: "renamed" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/entities/rename")) {
        return new Response(JSON.stringify({ item: { locator: "renamed" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/entities/clone")) {
        return new Response(JSON.stringify({ items: [{ locator: "cloned" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/entities/modelEntities/Raw/Sales/")) {
        return new Response(JSON.stringify({ items: [{ locator: "deleted" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/entities/folders/Raw/Sales")) {
        return new Response(JSON.stringify({ items: [{ locator: "deleted-folder" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/model/save")) {
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method || "GET"}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses /entities/move for model entity locators", async () => {
    const result = await moveEntities("/modelEntities/ZoneA/Customer", "/modelEntities/ZoneB/Customer");

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/entities\/move$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ from: "/modelEntities/ZoneA/Customer", to: "/modelEntities/ZoneB/Customer" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/model\/save$/),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual([{ locator: "moved" }]);
  });

  it("uses /entities/move for folder locators", async () => {
    await moveEntities("/folders/ZoneA/ProductA", "/folders/ZoneB/ProductB");

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/entities\/move$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ from: "/folders/ZoneA/ProductA", to: "/folders/ZoneB/ProductB" }),
      }),
    );
  });

  it("uses /entities/rename for entity renames", async () => {
    const result = await renameEntity("/properties/domain", "businessDomain");

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/entities\/rename$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ from: "/properties/domain", to: "businessDomain" }),
      }),
    );
    expect(result).toEqual({ locator: "renamed" });
  });

  it("uses /entities/move-single when an entity changes folders", async () => {
    await moveSingleEntity("/propertyValues/domain/internal", "/propertyValues/category/internal", { save: false });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/entities\/move-single$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          from: "/propertyValues/domain/internal",
          to: "/propertyValues/category/internal",
        }),
      }),
    );
  });

  it("uses PUT /entities/clone for entity clones", async () => {
    const result = await cloneEntity("/modelEntities/ZoneA/Customer", "/modelEntities/ZoneA/Customer_copy", {
      save: false,
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/entities\/clone$/),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          locator: "/modelEntities/ZoneA/Customer",
          newLocator: "/modelEntities/ZoneA/Customer_copy",
        }),
      }),
    );
    expect(result).toEqual({ locator: "cloned" });
  });

  it("uses DELETE /entities with model folder subtree locators", async () => {
    await deleteEntity("/modelEntities/Raw/Sales/", { save: false });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/entities\/modelEntities\/Raw\/Sales\/$/),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("uses DELETE /entities with folder metadata locators", async () => {
    await deleteEntity("/folders/Raw/Sales", { save: false });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/entities\/folders\/Raw\/Sales$/),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("v2Client collection creation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("encodes the selected source file without adding it to the entity body or saving early", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ item: { name: "New" } })));
    vi.stubGlobal("fetch", fetchMock);
    const body = { name: "New", property: "Priority" };
    const sourceFile = "Base/Custom/Values ä & #.json";

    await createEntity("/propertyValues/Priority/New", body, { sourceFile, save: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe("/entities/propertyValues/Priority/New");
    expect(parsed.searchParams.get("sourceFile")).toBe(sourceFile);
    expect(parsed.hash).toBe("");
    expect(init).toMatchObject({ method: "PUT", body: JSON.stringify(body) });
  });

  it("keeps creation without a target compatible and saves once by default", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await createEntity("dataTypes/New", { name: "New", targets: {} });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/entities\/dataTypes\/New$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/model\/save$/);
  });

  it("keeps existing items on PATCH without a file placement parameter", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const options = { sourceFile: "Base/Custom/Values.json", save: false };

    await patchEntity("/propertyValues/Priority/Existing", { displayName: "Changed" }, options);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/entities\/propertyValues\/Priority\/Existing$/),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ displayName: "Changed" }) }),
    );
  });
});
