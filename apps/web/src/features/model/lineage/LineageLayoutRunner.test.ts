import type { ELK, ElkNode } from "elkjs/lib/elk-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LineageLayoutRunner } from "./LineageLayoutRunner";

const input: ElkNode = { id: "root", children: [{ id: "a", x: 0, y: 0, width: 270, height: 98 }], edges: [], width: 300, height: 200 };

function setup() {
  vi.useFakeTimers();
  const engines: Array<{ layout: ReturnType<typeof vi.fn>; terminateWorker: ReturnType<typeof vi.fn>; fail: () => void }> = [];
  const runner = new LineageLayoutRunner((fail) => {
    const engine = { layout: vi.fn(async () => structuredClone(input)), terminateWorker: vi.fn(), fail };
    engines.push(engine);
    return { ...engine, layout: engine.layout as ELK["layout"] };
  });
  return { runner, engines };
}

afterEach(() => vi.useRealTimers());

describe("lineage layout runtime", () => {
  it("warms once, reuses the worker across completed views and returns cached geometry without running ELK", async () => {
    const { runner, engines } = setup();
    runner.warm();
    const first = runner.request("first", input);
    const layout = await first.promise;
    first.cancel();
    await runner.request("second", input).promise;
    expect(engines).toHaveLength(1);
    expect(engines[0].terminateWorker).not.toHaveBeenCalled();
    expect(await runner.request("first", input).promise).toBe(layout);
    expect(engines[0].layout).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engines[0].terminateWorker).toHaveBeenCalledTimes(1);
    expect(runner.peek("first")).toBe(layout);
  });

  it("cancels superseded work and ignores late results without terminating the replacement worker", async () => {
    const { runner, engines } = setup();
    runner.warm();
    let finish!: (graph: ElkNode) => void;
    engines[0].layout.mockImplementationOnce(() => new Promise<ElkNode>((resolve) => { finish = resolve; }));
    const first = runner.request("first", input);
    const rejection = expect(first.promise).rejects.toMatchObject({ name: "AbortError" });
    first.cancel();
    await rejection;
    const second = runner.request("second", input);
    first.cancel();
    await second.promise;
    finish(input);
    await Promise.resolve();
    expect(runner.peek("first")).toBeUndefined();
    expect(runner.peek("second")).toBeDefined();
    expect(engines[0].terminateWorker).toHaveBeenCalledTimes(1);
    expect(engines[1].terminateWorker).not.toHaveBeenCalled();
  });

  it("restarts after worker failure or timeout", async () => {
    const { runner, engines } = setup();
    runner.warm();
    engines[0].layout.mockImplementation(() => new Promise(() => {}));
    const failed = runner.request("failed", input);
    const rejection = expect(failed.promise).rejects.toThrow("Layout worker failed");
    engines[0].fail();
    await rejection;
    await runner.request("retry", input).promise;
    engines[1].layout.mockImplementation(() => new Promise(() => {}));
    const timedOut = runner.request("timeout", input);
    const timeout = expect(timedOut.promise).rejects.toThrow("Layout timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await timeout;
    expect(engines[1].terminateWorker).toHaveBeenCalledTimes(1);
    await runner.request("recovered", input).promise;
    expect(engines).toHaveLength(3);
  });

  it("bounds the geometry cache", async () => {
    const { runner } = setup();
    for (let index = 0; index < 33; index++) await runner.request(String(index), input).promise;
    expect(runner.peek("0")).toBeUndefined();
    expect(runner.peek("1")).toBeDefined();
    expect(runner.peek("32")).toBeDefined();
  });
});
