# Roll out the desktop build and release process

The maintained [release process](release.md) replaces the former desktop build
and publishing process. This checklist covers the one-time transition; it is
not a requirement to operate two product generations indefinitely. During the
current test phase, changes stay on `feature/external_refresh`; no public release
or change to `main` is made by manual verification.

## Register the workflows and retire superseded triggers

1. Complete a signed four-platform manual run at the final candidate commit.
   Keep its workflow URL, package checksums and build manifest as evidence.
2. Integrate the reviewed changes into the default branch as a separate rollout
   step. Replace the former .NET/MSI publishing workflow with the maintained
   desktop workflow; do not leave an independent old release trigger active.
3. Register `build-desktop.yml` on the default branch before using it as the
   normal manual entry point. GitHub requires manual workflows to be registered
   there even when the selected execution ref is another branch. See
   [GitHub's manual workflow documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
4. For manual signed builds on `main`, allow that branch in the GitHub signing
   environment and update the trusted-ref guards in `desktop.yml` together.
   The current guards allow the feature branch and protected version tags only.
   Require reviewed changes on the production branch and keep PR refs excluded.
5. Configure active protection for release tags. The signing environment's
   `v*` allowlist alone does not protect tags. The workflow checks
   `github.ref_protected` and the package version before publishing.
6. Choose one normal manual entry point. The registered
   `ci-push-and-pull-request-merged.yml` wrapper currently also provides the
   `windows_update_fixture_run` diagnostic input. Retain or move that diagnostic
   explicitly before retiring the wrapper. Both wrappers call the same reusable
   desktop workflow; neither creates a separate build/signing process.

## Replace installed applications and preserve user data

The previous Windows distribution used an MSI; the current distribution uses
an NSIS EXE. The packaged CI gates install/uninstall NSIS and test automatic
updates between two signed Electron fixture versions. They do not establish
automatic migration from an existing MSI installation.

Before broad rollout, test on a Windows 11 machine with the previous application
installed and disposable copies of real older solutions:

- Back up solution directories, referenced Base/Model/Plugins/templates and
  existing application settings. Keep originals outside the application install
  directory. Redact credentials and customer identifiers from evidence.
- Establish the supported uninstall/install sequence. Check for duplicate
  installed applications, old shortcuts, stale launchers and `.dm8s` associations.
  Do not assume the new installer removes an unrelated MSI product.
- Open a copied solution, edit/save, restart and generate concrete expected
  output with its plugins/templates. Check any schema/format migration against
  the pinned Generator's contract. Retain the original copy for recovery.
- Document which settings are retained or must be configured again. The startup
  fallback for an earlier Electron user-data path is not proof of importing the
  previous desktop application's settings.
- Verify the approved corporate CA trust and Defender/SmartScreen behavior using
  the [Windows release checklist](windows-defender-release-checklist.md). The app
  does not install a root certificate. Public trust requires a suitable signer.

Use a verified manual download for the initial replacement unless an existing
installation's upgrade path has been explicitly demonstrated. After installation,
Windows uses the signed Electron update feed in `oraylis/datam8-frontend`.
macOS and Linux continue with verified manual downloads. Keep package identity,
user-data locations, publisher identity and update-channel behavior stable for
subsequent releases; test deliberate changes before publishing them.

Retaining backup copies for recovery does not require continuing the previous
release pipeline. Do not overwrite a solution with a migrated format and assume
that an earlier application can still open it.

## Retire unused credentials and infrastructure

The dedicated OIDC signing principal is the maintained release identity. Reusing
the previous automation principal is not required to complete the product
replacement. Keep the existing Windows signing certificate and GPG release key
so their trust continuity does not depend on the retirement of a workflow.

Before removing old client-secret credentials, repository secrets, access
policies or an app registration, inventory their remaining consumers. A principal
may also be referenced by deployment templates or external automation. Remove
only resources confirmed unused; an inaccessible app registration requires its
owner or an authorized Entra administrator for cleanup. Do not delete shared
signing keys, certificates or GPG recovery material.

Record actual identities, effective permissions and retirement evidence in the
private operations runbook. The public release/install documents need the current
workflow interfaces and public verification identities, not the old infrastructure
inventory. Existing technical names containing a version suffix can remain until
a coordinated rename is justified.

## Publish through the maintained process

After the transition checks, commit the release version and matching lockfile,
then push an authorized protected tag matching the desktop package version.
`release.yml` performs a new complete build, signing and installed-package
verification before publication. A prior manual run is evidence, not a bypass
of those release gates. Preserve the workflow URL, commit, fingerprints and
manifest for the published release.
