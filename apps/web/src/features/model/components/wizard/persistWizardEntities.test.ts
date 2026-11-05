import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelEntity, TableMetadata } from "../../model-types";
import { persistWizardEntities } from "./useWizardSubmit";

const assignedIds = [Number.MAX_SAFE_INTEGER, 8123456789012345];

function draft(name: string): ModelEntity {
  return {
    name,
    locator: `/modelEntities/Raw/${name}`,
    relPath: `Model/Raw/${name}.json`,
    content: { name, attributes: [], sources: [{ sourceLocation: 7 }], relationships: [], transformations: [] },
  };
}

function metadata(target: string): TableMetadata {
  return {
    name: "table", schema: "", type: "TABLE",
    columns: [{
      name: "Id", ordinal: 1, dataType: "int", isNullable: false, isPrimaryKey: true,
      maxLength: null, numericPrecision: null, numericScale: null,
      relationships: [{ relationshipType: "internal", targetEntityName: target, sourceName: "Id", targetName: "Id" }],
    }],
  };
}

function backend(fail?: "create" | "patch" | "save") {
  const state = new Map<string, Record<string, unknown>>();
  const deleted: string[] = [];
  let creations = 0;
  let saves = 0;
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const pathname = new URL(String(input), "http://localhost").pathname;
    const body = JSON.parse(String(init?.body || "{}"));
    const locator = pathname.replace(/^\/entities/, "");
    let response: unknown = {};
    if (init?.method === "PUT") {
      if (fail === "create" && creations === 1) return Response.json({ message: "Create failed" }, { status: 400 });
      const entity = { ...body, id: assignedIds[creations++] };
      state.set(locator, entity);
      response = { item: { locator, entity } };
    } else if (init?.method === "PATCH") {
      if (fail === "patch") return Response.json({ message: "Patch failed" }, { status: 400 });
      const entity = { ...state.get(locator), ...body };
      state.set(locator, entity);
      response = { item: { locator, entity } };
    } else if (init?.method === "DELETE") {
      deleted.push(locator);
      state.delete(locator);
    } else if (pathname === "/model/save") {
      if (fail === "save" && saves++ === 1) return Response.json({ message: "Save failed" }, { status: 500 });
    } else {
      throw new Error(`Unexpected request: ${pathname}`);
    }
    return Response.json(response);
  });
  vi.stubGlobal("fetch", fetch);
  return { state, deleted, fetch };
}

afterEach(() => vi.unstubAllGlobals());

describe("wizard persistence", () => {
  it("uses returned IDs for cyclic batch relationships and keeps existing source IDs", async () => {
    const server = backend();
    const entities = [draft("First"), draft("Second")];
    const existing = [draft("Existing")];
    existing[0].content.id = 7;
    await persistWizardEntities(entities, existing, new Map([
      [entities[0].relPath, metadata("Second")],
      [entities[1].relPath, metadata("First")],
    ]));

    expect(entities.map((entity) => entity.content.id)).toEqual(assignedIds);
    expect(entities[0].content.relationships?.[0].targetLocation).toBe(assignedIds[1]);
    expect(entities[1].content.relationships?.[0].targetLocation).toBe(assignedIds[0]);
    expect(entities[0].content.sources).toEqual([{ sourceLocation: 7 }]);
    const requests = server.fetch.mock.calls.map(([url, init]) => ({
      url: String(url), method: init?.method, body: JSON.parse(String(init?.body || "{}")),
    }));
    expect(requests.filter((request) => request.method === "PUT").every((request) => !("id" in request.body))).toBe(true);
    expect(requests.map((request) => request.method)).toEqual(["PUT", "PUT", "PATCH", "PATCH", "POST", "POST"]);
    expect(requests.filter((request) => request.method === "POST").map((request) => request.body.locator))
      .toEqual(["/modelEntities/Raw/First", "/modelEntities/Raw/Second"]);
    expect(server.deleted).toEqual([]);
  });

  it.each(["create", "patch", "save"] as const)("cleans up only its own creations on %s failure", async (failure) => {
    const server = backend(failure);
    const entities = [draft("First"), draft("Second")];
    await expect(persistWizardEntities(entities, [], new Map([[entities[0].relPath, metadata("Second")]])))
      .rejects.toThrow(`${failure[0].toUpperCase()}${failure.slice(1)} failed`);
    expect(server.state.size).toBe(0);
    expect(server.deleted).toEqual(failure === "create"
      ? ["/modelEntities/Raw/First"]
      : ["/modelEntities/Raw/Second", "/modelEntities/Raw/First"]);
  });
});
