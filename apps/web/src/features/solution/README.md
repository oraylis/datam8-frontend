# Solution Loading (Web)

Handles locating and loading `.dm8s` solutions and associated entities.

## Entry Points
- `SolutionContext.tsx` — stores loaded solution, path/source, picker state, error handling; exposes `loadSolution`.
- `solutionLoader.ts` — fetches solution/base/model from server, electron bridge, or uploaded file; normalizes payload.
- `solution-types.ts` — solution shape.

## Sources Supported
- Server path (`/solution/full?path=`) — remembers last path in `localStorage` (`dm8_solution_path`).
- Electron path (via preload bridge `window.desktop.solution` or legacy `window.electron`).
- Uploaded `.dm8s` JSON file (browser mode).

## Flow
1) UI triggers `loadSolution` with a source descriptor.
2) Loader fetches/reads payload and normalizes model/base entities (locators, names, relPaths).
3) Context stores solution, source, solutionPath, and closes picker; errors reopen picker in server mode.

## Extending
- Add new source kinds by updating `SolutionSource` union and handling in `solutionLoader`.
- To surface additional metadata, extend `solution-types.ts` and normalization logic.
- Keep picker UX coordinated via `SolutionContext` (open/error states).

