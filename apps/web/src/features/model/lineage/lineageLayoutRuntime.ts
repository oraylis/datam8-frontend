import ELK from "elkjs/lib/elk-api";
import ElkWorker from "./lineageLayout.worker?worker";
import { LineageLayoutRunner } from "./LineageLayoutRunner";

export const lineageLayoutRunner = new LineageLayoutRunner((onError) => new ELK({
  algorithms: ["layered"],
  workerFactory: () => {
    const worker = new ElkWorker();
    worker.addEventListener("error", (event) => { event.preventDefault(); onError(); });
    worker.addEventListener("messageerror", onError);
    return worker;
  },
}));

export function warmLineageLayout() { lineageLayoutRunner.warm(); }
