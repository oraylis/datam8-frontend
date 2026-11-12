import type { ELK, ElkNode } from "elkjs/lib/elk-api";
import { layoutLineageGraph, type LineageLayout } from "./layoutLineageGraph";

type Engine = Pick<ELK, "layout" | "terminateWorker">;
type Task = { cancel: () => void; fail: (error: Error) => void };

/** Reuse the expensive ELK runtime between completed layouts, with bounded idle lifetime. */
export class LineageLayoutRunner {
  private engine?: Engine;
  private active?: Task;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private cache = new Map<string, LineageLayout>();

  constructor(private createEngine: (onError: () => void) => Engine) {}

  peek(key: string) { return this.cache.get(key); }

  warm() {
    try { this.getEngine(); this.releaseWhenIdle(); } catch { /* Retry on actual use. */ }
  }

  private getEngine(): Engine {
    if (!this.engine) {
      const engine = this.createEngine(() => {
        if (this.engine !== engine) return;
        if (this.active) this.active.fail(new Error("Layout worker failed"));
        else this.disposeEngine();
      });
      this.engine = engine;
    }
    return this.engine;
  }

  private disposeEngine() {
    clearTimeout(this.idleTimer);
    this.engine?.terminateWorker();
    this.engine = undefined;
  }

  private releaseWhenIdle() {
    clearTimeout(this.idleTimer);
    if (!this.active && this.engine) this.idleTimer = setTimeout(() => this.disposeEngine(), 60_000);
  }

  request(key: string, input: ElkNode): { promise: Promise<LineageLayout>; cancel: () => void } {
    const cached = this.peek(key);
    if (cached) return { promise: Promise.resolve(cached), cancel: () => {} };
    this.active?.cancel();
    clearTimeout(this.idleTimer);
    let cancel = () => {};
    const promise = new Promise<LineageLayout>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const task: Task = {
        cancel: () => task.fail(new DOMException("Superseded layout", "AbortError")),
        fail: (error) => {
          if (this.active !== task) return;
          clearTimeout(timer);
          this.active = undefined;
          this.disposeEngine();
          reject(error);
        },
      };
      cancel = task.cancel;
      this.active = task;
      timer = setTimeout(() => task.fail(new Error("Layout timed out")), 15_000);
      try {
        void layoutLineageGraph(this.getEngine(), input).then((layout) => {
          if (this.active !== task) return;
          clearTimeout(timer);
          this.active = undefined;
          this.cache.set(key, layout);
          if (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value!);
          this.releaseWhenIdle();
          resolve(layout);
        }).catch(task.fail);
      } catch (error) { task.fail(error instanceof Error ? error : new Error(String(error))); }
    });
    return { promise, cancel: () => cancel() };
  }
}
