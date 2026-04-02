# GEMINI.md

This file gives quick technical context for `datam8-neon`.

## Project Overview

DataM8 Neon is the DataM8 2.0 UI workspace: a React/Vite web app plus an Electron desktop shell.

- Desktop launches a bundled `datam8` binary with `datam8 serve --host 127.0.0.1 --port 0 --token ...`.
- Renderer calls backend over HTTP.
- Long-running work runs through Jobs (`/jobs`) and is streamed with SSE (`/jobs/:id/events`).
- Backend source of truth is the submodule: `submodules/datam8-generator`.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run web:

```bash
npm run dev:web
```

3. Run desktop (spawns backend):

```bash
npm run dev:desktop
```

## Monorepo Structure

- `apps/web`: React/Vite frontend.
- `apps/desktop`: Electron main/preload and backend process lifecycle.
- `packages/ui`: shared UI primitives.
- `packages/types`: shared TS types.
- `submodules/datam8-generator`: backend CLI/server/jobs implementation.

## Key Commands

- `npm run dev:web`
- `npm run dev:desktop`
- `npm run typecheck`

## Backend Contract

Use the canonical backend contract in:

- `submodules/datam8-generator/docs/backend-contract.md`

Neon-side summary link:

- `docs/backend-contract.md`
