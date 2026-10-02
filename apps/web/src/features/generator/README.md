# Generator (Web)

Browser frontend for synchronous `POST /model/generate`; desktop uses the preload
generation bridge to the CLI. See the [consumer constraints](../../../../../docs/backend-contract.md).

## Entry Points

- `GeneratorContext.tsx` - invokes `POST /model/generate`, tracks running/error/success state, and prevents parallel runs.
- `GeneratorPanel.tsx` - drawer UI (target picker, log level, Generate button, close control and output view).

## Flow

1. Context derives targets from the loaded solution (`generatorTargets`).
2. `runGenerator` sends one synchronous request to `POST /model/generate`.
3. On success, the UI shows target + output path and enables Run again.
4. On failure, the UI shows the error state and keeps previous logs visible.
   Closing the drawer is not backend cancellation; there is no Jobs/SSE cancellation API.
