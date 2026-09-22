# @datam8/types

Shared type package. Currently a placeholder for generated DataM8 model/base schemas and cross-app types.

## Intended Use
- Consume from web/API/desktop to avoid `any` for model/base entities, data sources, products, zones, properties, etc.
- Generated definitions (future) should live under `src/` and be exported via `index.ts`.

## Today
- Minimal `Solution` type stub in `src/index.ts`.
- Expand as soon as upstream schemas are available.
