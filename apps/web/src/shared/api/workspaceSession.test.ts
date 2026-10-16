import { afterEach, expect, it } from "vitest";
import { guardWorkspaceResponse, setWorkspaceId } from "./workspaceSession";

afterEach(() => setWorkspaceId(null));

it("rejects an earlier workspace response whose body finishes after switching", async () => {
  setWorkspaceId("A");
  let finish!: () => void;
  const stream = new ReadableStream({ start(controller) { finish = () => {
    controller.enqueue(new TextEncoder().encode('{"name":"A"}')); controller.close();
  }; } });
  const response = guardWorkspaceResponse(new Response(stream), "A");
  const body = response.json();
  setWorkspaceId("B");
  finish();
  await expect(body).rejects.toMatchObject({ name: "AbortError" });
  expect(() => response.ok).toThrow(/workspace changed/);
});

it("retains Response branding, cloning and normal body parsing for the active workspace", async () => {
  setWorkspaceId("A");
  const response = guardWorkspaceResponse(Response.json({ name: "A" }), "A");
  expect(response).toBeInstanceOf(Response);
  expect(response.ok).toBe(true);
  const copy = response.clone();
  expect(await response.json()).toEqual({ name: "A" });
  expect(await copy.json()).toEqual({ name: "A" });
});
