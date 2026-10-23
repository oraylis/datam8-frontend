# Historical Frontend Documentation Handoff

This page preserves the original documentation transfer. The branch and workspace
states below describe that task, not the current checkout. Maintained redirects
now target the central handbook on `main`; screenshot evidence retains its exact
capture commits. Current downloads start at [installation](desktop-installation.md).

The central handbook, original 22 images and acceptance evidence have moved to
`datam8` on `codex/documentation-v2`. This checkout remains on
`feature/external_refresh`. [Central handoff](https://github.com/oraylis/datam8/blob/main/docs/handoff.md) records
the five packages and manual merge order.

Frontend retains developer references, chapter redirect pages, screenshot tooling
and capture maintenance. `--publish-dir` exports a reviewed image/manifest bundle;
the default is ignored output rather than a second committed image set.

Run `npm run docs:check`, `node --check scripts/capture-user-guide.mjs` and the opt-in
capture when changing its behavior. The current verification export stays local;
published guide images retain their original provenance.

Pre-existing generated schema types and submodule changes are outside this package.
No changes were pushed or merged. Publish central targets before publishing redirects;
after manual merges, change development links to main without changing evidence pins.
