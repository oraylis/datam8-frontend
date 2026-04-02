import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveEntities } from "./v2Client";

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
});
