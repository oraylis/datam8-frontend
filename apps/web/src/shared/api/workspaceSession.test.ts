import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { getWorkspaceSignal, setWorkspaceId } from "./workspaceSession";

afterEach(() => setWorkspaceId(null));

it("aborts a native fetch body that finishes after the workspace changes", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write('{"name":');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    setWorkspaceId("A");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const response = await fetch(`http://127.0.0.1:${address.port}`, { signal: getWorkspaceSignal() });
    const body = response.json();
    setWorkspaceId("B");
    await expect(body).rejects.toMatchObject({ name: "AbortError" });
    expect(response).toBeInstanceOf(Response);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

it("keeps requests alive when the active workspace ID is unchanged", () => {
  setWorkspaceId("A");
  const signal = getWorkspaceSignal();
  setWorkspaceId("A");
  expect(getWorkspaceSignal()).toBe(signal);
  expect(signal.aborted).toBe(false);
});
