# Generator (Web)

Frontend for synchronous generation via the backend `POST /generate` endpoint.

## Entry Points
- `GeneratorContext.tsx` - invokes `POST /generate`, tracks running/error/success state, and supports local cancel via `AbortController`.
- `GeneratorPanel.tsx` - bottom panel UI (target picker, log level, Run/Cancel button, output view).

## Flow
1. Context derives targets from the loaded solution (`generatorTargets`).
2. `runGenerator` sends one synchronous request to `POST /generate`.
3. On success, the UI shows target + output path and enables Run again.
4. On failure/cancel, the UI shows the error state and keeps previous logs visible.
