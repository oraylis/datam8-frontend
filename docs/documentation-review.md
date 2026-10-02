# Documentation Review — 2026-09-30

## Result and sources

Reviewed frontend instructions, root and subsystem READMEs, every frontend Markdown
document, the Generator/nested schema documentation, and the separate sample's
Markdown documentation. Compared runtime claims with frontend code, package scripts,
the canonical contract and the running backend OpenAPI surface. This is a documentation
review, not a security audit or acceptance of every listed product feature.

The frontend uses React 19, root APIs and synchronous browser generation through
`/model/generate`. Browser selection reads the startup-bound workspace. Historical
API parity lists are the main source of misleading claims. Sample tutorials have
drifted from their own `.dm8s` configuration and CLI generation.

Changes in this patch are frontend-owned documentation and maintenance scripts;
Generator and Sample files are not edited, and the pre-existing submodule revision
change is preserved. The [capture manifest](https://github.com/oraylis/datam8/blob/codex/documentation-v2/docs/user-guide/assets/manifest.json) records
the actual runtime revisions used for evidence.

## Frontend inventory and disposition

| Document | Finding and action |
| --- | --- |
| `AGENTS.md` | Keep repo-specific invariants and task-based links; remove repeated architecture, stale generate/save claims and POSIX-only override guidance |
| `README.md` | Correct React version; add locked install/submodules, complete web startup, user/developer entry points and mode limits |
| `ARCHITECTURE.md` | Correct generation and solution selection; remove claims of a separate validation UI |
| `CHANGELOG.md` | Preserve release history; annotate older beta notes as historical, not current capability guarantees |
| `docs/backend-contract.md` | Replace duplicated/contradictory endpoint specification with consumer constraints and canonical links |
| `docs/autosave.md` | Keep trigger/order guidance; replace obsolete SaveErrorAlert/Retry now descriptions with actual transient status/context-switch recovery |
| `docs/troubleshooting.md` | Correct error recovery and startup-bound browser behavior |
| `docs/dev-desktop.md` | Explain .venv enforcement and Windows/POSIX overrides; correct plugin discovery |
| `docs/connectors.md` | Replace obsolete routes/discovery with current frontend responsibilities and canonical links |
| `docs/connectors_dev.md` | Update implementation pointers, metadata/capability boundaries and verification requirements |
| `docs/plugins_spec_v1.md` | Retain public path as a short reference entry point; old v1 routes are not a current spec |
| `docs/release.md` | Preserve packaged-runtime smoke guidance; link index and separate release evidence from user workflows |
| `docs/windows-defender-release-checklist.md` | Preserve release procedure; clarify signing availability is workflow-dependent, not assumed |
| `docs/e2e-computer-use-full-workflows.md` | Preserve distinct manual computer-use acceptance procedure; scope it separately from screenshot automation |
| `docs/computer-use-ui-test-matrix.md` | Mark historical environment-specific evidence; remove exact duplicate result rows |
| `docs/computer-use-ui-performance-order.md` | Keep dated results/limitations as historical observations, not performance thresholds |
| `apps/web/src/app/README.md` | Identify retained New Project consumer as unverified against absent backend parity route |
| `apps/web/src/features/solution/README.md` | Correct path query/switch claims and lone-file upload expectations |
| `apps/web/src/features/fs/README.md` | Identify legacy context; current dialog does not implement this filesystem picker |
| `apps/web/src/features/generator/README.md` | Distinguish browser HTTP from desktop CLI bridge and panel-close/cancellation behavior |
| `apps/web/src/features/model/README.md` | Correct error presentation; retained retry helper is not wired into editor rendering |
| `apps/desktop/src/README.md` | Clarify development interpreter restrictions, current runtime and bridge boundaries |
| `packages/ui/README.md` | Keep generic/domain separation; normalize Markdown formatting |
| `packages/types/README.md` | Replace placeholder claims with actual hand-written shared types and separate generated schema types |

The illustrated guide and its images now belong to the central `datam8` repository.
Frontend retains `docs/index.md`, this report, capture tooling and chapter redirects. Chapter
navigation separates tutorials, task instructions, technical references and historical
evidence. Existing document paths remain available for incoming links.

**Frontend product follow-up:** editor failures are only a transient sidebar status;
the detailed error/retry helper exists but is not connected to current editors.
Restore a persistent, accessible error description and explicit retry control in
a separate UI patch with failure/recovery regression coverage. This documentation
patch records the current behavior and tests recovery through context switching.

## External follow-ups (no changes in this patch)

| Repository/document | Finding or disposition |
| --- | --- |
| Generator `AGENTS.md` | Good task-specific routing and generated-schema boundaries; retain |
| Generator `README.md` | Old datam8-cli clone/release URLs and Python range need reconciliation with actual project metadata |
| Generator `docs/backend-contract.md` | Current/historical separation is valuable; old Neon naming and extensive parity appendix still invite accidental reuse |
| Generator `docs/server.md` | Mostly aligned startup/auth/CORS documentation; keep linked to implemented route surface |
| Generator `docs/neon-cli-mapping.md` | February parity matrix and hard-coded code line numbers are obsolete; archive or regenerate from supported interfaces |
| Generator `docs/connectors.md` | Current plugin interface/ownership guidance is useful; frontend duplication removed |
| Generator `tests/README.md` | Good self-contained-regression guidance; distinguish legacy sample-dependent full suite from new fixture policy |
| Generator `tests/db/README.md` | Useful local AdventureWorks fixture; clarify OS driver setup and reproducible image/sample pins upstream |
| Generator Windows JSON persistence | Capture preparation found a non-ASCII em dash persisted using a platform encoding rather than UTF-8. The guide uses an ASCII exercise suffix; consistent UTF-8 writes need a separate backend regression/fix |
| Generator `SECURITY.md` | 1.0.x supported-version table does not explain v2 beta support |
| Nested schema `README.md` | Incomplete introductory sentence and old central docs naming; clarify generation/compatibility path |
| Nested schema `SECURITY.md` | Same v2 support-policy ambiguity; requires maintainer decision upstream |
| Sample `README.md` | Three active targets listed, but `.dm8s` defines four |
| Sample `SECURITY.md` | Keep vulnerability-report route; verify repo/project naming upstream |
| Sample `docs/index.md` | Helpful task-based organization; update target coverage and distinguish local onboarding from cloud setup |
| Sample `docs/getting-started.md` | Legacy Dm8Data commands; use installed/pinned modern CLI and verify commands |
| Sample `docs/quickstart.md` | Deployment-focused, not frontend onboarding; generic image filenames and broad permission examples need separate current cloud review |
| Sample `docs/howto-template-and-payload-development.md` | Useful Python/Jinja separation and examples; keep linked at a fixed revision |
| Sample `docs/template-development-howto.md` | Good compatibility redirect; retain |
| Sample `docs/reference/generator-contracts.md` | Useful template contracts, but execution/API examples must be checked against pinned Generator |
| Sample `docs/reference/targets.md` | Missing Lakeflow entry |
| Sample `docs/reference/properties.md` | Clearly target-specific; explain Lakeflow support separately when established |
| Sample `docs/reference/output-structure.md` | Compare expected output with actual payload paths; distinguish deploy hand-written files from generated files |
| Sample `Generate/databricks/README.md` | Appropriate short entry point; retain |
| Sample `Generate/databricks/ARCHITECTURE.md` | Useful interpreted-property/payload mapping reference; keep maintained beside target |
| Sample `Generate/databricks-lakeflow/README.md` | Duplicates Databricks wording; lacks target-specific behavior explanation |
| Sample `Generate/databricks-lakeflow/ARCHITECTURE.md` | Duplicate Databricks architecture; do not infer Lakeflow semantics from folder name |
| Sample `Generate/powerbi-tabular/ARCHITECTURE.md` | Useful narrow property surface; retain and verify actual paths |
| Sample `Generate/docs/ARCHITECTURE.md` | Useful deterministic docs/diagram design; capture verifies actual local generation |
| Sample `Output/powerbi-tabular/README.md` | Deployment runner uses a generated subdirectory convention; reconcile with output reference and target paths |

## Agent and documentation best practices

The updated AGENTS.md is a compact router plus invariants, commands and ownership.
It does not require reading all docs before every small patch, encode model-specific
roleplay, or duplicate canonical request bodies. This follows official
[GPT-6 Astra instruction guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
and [Codex AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md).
These are evidence-backed general improvements, not measured model-performance gains.

The guide uses a concrete Customer learning path, prerequisites and observable
checks. Canonical responsibilities are explicit, external links pin revisions,
screenshots have provenance/captions, limitations are visible, and local link/image
checks prevent common drift. Future UI changes should update their affected guide
chapter and screenshot in the same review.
