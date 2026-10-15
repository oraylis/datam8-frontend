# Working in DataM8 Frontend

React 19/Vite web editor and Electron shell for DataM8 2.0. Use Node 24 and npm
workspaces. Generator is the pinned backend submodule; its nested `datam8-model`
submodule owns schemas.

## Ownership and invariants

- UI changes belong here; generate/validate/index semantics belong in Generator.
- For HTTP changes, update the [canonical contract](submodules/datam8-generator/docs/backend-contract.md)
  first, then coordinate consumers and tests. Use implemented root routes without
  `/api`; generation is synchronous, without Jobs/SSE.
- Browser mode reads the solution bound at backend startup. Its path input does
  not switch workspaces. Desktop selects/loads paths through preload.
- Preserve editor drafts, autosave ordering, dirty state and keyboard navigation.
- Preserve unrelated changes, including submodule work. Change upstream schemas
  before regenerating types; do not patch generated types as a substitute.
- Use self-contained regression fixtures. The separate sample repo is reference
  and an opt-in documentation/acceptance input, not a new CI dependency. Run
  save/import/generate exercises on disposable copies; do not contact the sample's
  cloud source for routine checks.

## Read what the task needs

- Orientation: [README](README.md), [docs index](docs/index.md), [architecture](ARCHITECTURE.md).
- HTTP consumption: [backend integration](docs/backend-contract.md).
- Editor persistence: [autosave](docs/autosave.md).
- Connectors: [usage](docs/connectors.md), [developer notes](docs/connectors_dev.md).
- Desktop: [development](docs/dev-desktop.md), [release](docs/release.md).
- User workflows: [guide](docs/user-guide/README.md), [screenshot maintenance](docs/user-guide/capture.md).

## Entry points

- `apps/web/src/app/AppShell.tsx`: composition and global actions.
- `apps/web/src/features/{solution,model,generator,fs}`: feature state and editors.
- `apps/desktop/src/{main,preload}.ts`: backend lifecycle and constrained IPC.
- `packages/ui`: generic primitives; `packages/types`: hand-written shared types.

## Commands and verification

```sh
npm ci
npm run dev:desktop
npm run typecheck
npm --workspace apps/web run test
npm run test:e2e
npm run ci:gates
npm run docs:check
```

Prepare Generator with `uv sync --all-extras` in its submodule; see desktop development
for Windows commands and interpreter overrides. Behavior changes need focused
UI/unit tests; critical flows need Playwright. Cross-repo features need
UI → real backend completion → output/state assertions. Documentation-only edits
need documentation checks; screenshots need the opt-in capture run. Report passes,
failures and skips separately. Link canonical contracts rather than copying payload
specifications into frontend documents.
