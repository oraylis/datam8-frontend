# @datam8/types

Hand-written shared types for solution targets, JSON values, connection metadata
and property-refactor payloads. Generated web schema types live separately in
`apps/web/src/features/model/generated-schema-types.ts`.

## Intended Use

- Consume from web/API/desktop to avoid `any` for model/base entities, data sources, products, zones, properties, etc.
- Keep stable cross-app types in `src/index.ts`; do not duplicate the generated
  schema source of truth in this package.

## Today

- `src/index.ts` exports the current shared types.
- `npm run generate:schema-types` regenerates the web schema interfaces from the
  pinned upstream model. Inspect generated changes; change upstream schemas first.
