# Maintain the Guide and Screenshots

[Guide index](README.md) · [Documentation index](../index.md)

## Check documentation

```sh
npm run docs:check
```

The dependency-free check validates frontend Markdown title/heading spacing,
trailing whitespace, local links, GitHub-style heading fragments, image existence
and alt text, reference links and any local exported capture manifest. It does not fetch
external URLs or lint vendored Generator/Sample docs. Checker regressions run with
Node's test runner. This check is part of normal CI and requires no sample checkout.

## Regenerate browser screenshots

Prerequisites: Node 24, installed frontend dependencies and Playwright Chromium,
Git/tar, the submodule Python virtual environment with backend extras, and the
separate sample Git repository containing the revision below.

```sh
npm ci
npm --workspace apps/web exec playwright install chromium
```

```powershell
# Repo root; separate sample clone is a sibling in this example

$env:DATAM8_SAMPLE_REPO = (Resolve-Path ..\datam8-sample-solution).Path
npm run docs:capture
```

```sh
DATAM8_SAMPLE_REPO=/path/to/datam8-sample-solution npm run docs:capture
```

The runner archives sample commit `1e1855e59e2734b3a393f9128193504626ab9380` into a
new temporary directory; it never modifies the source clone. It replaces connection
host/username with neutral values, starts its own loopback backend and Vite,
captures the real UI, tests autosave/reload, demonstrates an offline save failure
and retries through a context switch before verifying real `docs` generation after
deleting the copied pre-existing index.
It retains the temporary workspace for inspection and stops the processes it started.

| Setting | Default |
| --- | --- |
| `DATAM8_PYTHON_PATH` | Submodule virtual-environment interpreter |
| `DATAM8_DOCS_WEB_PORT` | 4325; choose a free port if occupied |
| `DATAM8_DOCS_HEADED` | Set to `1` for a visible browser |
| Viewport | 1440 × 1000 CSS pixels, scale 1, English locale, light color scheme |

Raw images, accessibility snapshots, backend logs and generated output evidence
are retained below ignored `output/playwright/user-guide/`. The default publication bundle is `output/playwright/user-guide/publish/`.
Use `npm run docs:capture -- --publish-dir /path/to/export/assets` to select another
export directory. Inspect the bundle, then copy its PNGs and manifest to the central
`datam8/docs/user-guide/assets/` in the same review as affected chapter text.
Frontend does not retain a second committed image set. The generated success image masks only the
temporary output path; the raw image is retained locally. Do not publish raw logs,
temporary usernames or credentials.

The manifest records frontend source changes and whether the backend checkout is
dirty. Preserve that information; do not present a development capture as a pristine
installed release. Keep the handbook's published manifest paired with its images.

## Review before publishing

1. Inspect every image at its intended Markdown display size. Check readable labels,
   clipped panels, open overlays and accidental private information.
2. Compare captions and exercises with the captured state; a wizard or refresh
   selection image must not claim a successful import/refresh.
3. Confirm all required manifest checks pass and inspect saved/generated files.
4. Update the [acceptance report](acceptance.md) and run `npm run docs:check`.
5. Review the image and Markdown diff together. Regenerate affected captures when
   UI behavior changes, rather than changing captions around stale pictures.

The runner is separate from regular tests and does not make the external sample a
CI dependency. It leaves generated evidence in temporary/ignored locations rather
than adding sample model/template files to this frontend repository.

## Optional connected and desktop evidence

The automated browser runner deliberately does not access the sample's cloud
source. To extend coverage, use a new disposable copy and the backend's
[local SQL fixture setup](../../submodules/datam8-generator/tests/db/README.md).
Record source/driver/connector versions and connection, import, scan/review/apply
results. Capture real review states only after configuring that fixture.

Native Electron picker and function create/delete need separate desktop acceptance.
Use [the computer-use procedure](../e2e-computer-use-full-workflows.md) for manual
UI verification; that procedure's computer-use-only requirement does not apply to
this separate Playwright documentation runner. Do not mark browser evidence as
native desktop coverage or manufacture a native-dialog image.
