# @datam8/ui

Lightweight UI kit used by the web app (Radix-based primitives, theme, styles).

## Contents
- `src/theme.tsx` — theme provider/hooks.
- `src/styles.css` — base styles.
- `src/lib/utils.ts` — className helpers.
- `src/index.ts` — exports primitives and utilities.

## Usage
- Import components and wrap the app with the theme provider in `apps/web`.
- Keep this package focused on generic UI primitives; feature/domain logic belongs in the apps.
