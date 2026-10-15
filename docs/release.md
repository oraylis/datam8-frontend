# Desktop builds, signing and release verification

The desktop workflow builds Windows x64, macOS Intel, macOS ARM64 and Linux
x64 on native GitHub-hosted runners. It tests the installed distributions before
providing the final `DataM8-verified-four-platforms` workflow artifact. No public
release is created by a manual verification run.

This is the maintained build and release process for DataM8 Desktop. The new
application replaces the previous desktop application. Keeping two product
generations or two signing/release processes is not a permanent requirement.
The one-time [rollout checklist](desktop-rollout.md) covers workflow registration,
existing installations and retirement of superseded infrastructure.

## Build and release process

All native builds use Node 24 and the pinned Generator submodule. Each target
bundles its own Python runtime and backend dependencies:

| Target | GitHub runner | Distribution |
| --- | --- | --- |
| Windows x64 | `windows-2025` | NSIS EXE |
| macOS Intel | `macos-15-intel` | DMG and ZIP |
| macOS ARM64 | `macos-15` | DMG and ZIP |
| Linux x64 | `ubuntu-24.04` | AppImage and DEB |

GitHub Actions runs quality gates, builds and signs native packages, tests the
installed packages on fresh runners, then signs and verifies the final download
manifest. The reusable workflow is `.github/workflows/desktop.yml`.

| Entry point | Purpose | Result |
| --- | --- | --- |
| `ci.yml` | Push/PR quality checks and compilation | No distribution |
| `desktop-pr.yml` | Four-platform packaging and installed-app checks on PRs | Test artifacts without release signing or Vault access |
| `ci-push-and-pull-request-merged.yml` | Currently registered manual entry point | Verified four-platform artifact; no public release |
| `build-desktop.yml` | Manual entry point once registered on the default branch | Same verified four-platform artifact; no public release |
| `release.yml` | Protected version-tag push | Rebuild, verify and publish all distributions to a GitHub release |

For the current feature-branch test phase, start the registered manual workflow:

```sh
gh workflow run ci-push-and-pull-request-merged.yml \
  --repo oraylis/datam8-frontend --ref feature/external_refresh
```

Leave `windows_update_fixture_run` empty for full acceptance. Download
`DataM8-verified-four-platforms` only after all required jobs pass. The artifact
includes seven platform packages, signatures, checksums, the public GPG key,
`BUILD-MANIFEST.json` and `INSTALL-AND-VERIFY.md`.

Release filenames must remain unchanged on GitHub. The Windows installer uses
`DataM8-Setup-<version>.exe`; delivery rejects unsafe filenames before signing
checksums, so download names, update URLs and checksum entries stay consistent.

The signed workflow and GitHub environment permit `main`,
`feature/external_refresh` and protected `v*` tags. PR refs cannot use release
signing or Vault access. macOS PR packages still receive local ad-hoc bundle
signatures (`identity: '-'`) so the same strict bundle verification applies.
Local packaging commands such as `npm run build:desktop` use the local host
and architecture; they do not substitute for four-platform signed acceptance.

Before publication, set and commit the intended package version, keep the lockfile
consistent, and complete the rollout and Windows clean-VM checks. The release
tag must be protected and exactly match `v` plus `apps/desktop/package.json`'s
version. Pushing it triggers a new full build and public release, so do not create
test release tags during manual verification. Versions containing a prerelease
suffix publish as GitHub prereleases; other versions publish as normal releases.
Windows update metadata and blockmaps are published with the verified packages.

Before pushing a release tag, commit its curated description at
`docs/releases/<version>.md`; [the 2.0.0 description](releases/2.0.0.md) covers the
first regular v2 desktop release. Publication requires this file and a matching
version/commit in `BUILD-MANIFEST.json`. The workflow appends the actual build
commit and verification URL to the description. The manifest also records the
Generator and schema commits, so the reissued backend's version label alone is
not used as build provenance.

Release preparation stops before the main merge and public tag until approval.
Run the registered manual wrapper with an empty `windows_update_fixture_run`
on the final candidate, retain its verified artifact and review PR #51. A
candidate run does not publish a draft release or reserve a tag. After approval,
tag the actual main merge commit; the tag workflow performs a fresh full build
and verification before publishing.

CodeQL uses the repository workflow for Actions, JavaScript/TypeScript and Python.
Default setup must be disabled when activating this workflow; the old default
branch does not contain the React application and cannot enable its JavaScript
analysis through default setup before the migration is merged.

## Signing configuration

Create the GitHub environment `desktop-signing-v2`. Restrict deployment refs to
`main`, `feature/external_refresh` and protected `v*` release tags. Do not permit PR refs.
The signing configuration uses a dedicated Azure application/service principal
with GitHub OIDC. Its application has a federated credential whose issuer is
`https://token.actions.githubusercontent.com`, audience is
`api://AzureADTokenExchange` and subject is
`repo:oraylis/datam8-frontend:environment:desktop-signing-v2`.

Configure these secrets on the signing GitHub environment:

| Secret | Meaning |
| --- | --- |
| `AZURE_KEY_VAULT_TENANT` | Azure tenant ID |
| `AZURE_KEY_VAULT_URL` | Vault URL, for example `https://example.vault.azure.net` |
| `AZURE_KEY_VAULT_NAME` | Windows certificate name inside the vault; not the vault name |

Set these environment variables:

| Variable | Meaning |
| --- | --- |
| `AZURE_V2_CLIENT_ID` | Application client ID used by the signing OIDC jobs |
| `DATAM8_GPG_FINGERPRINT` | Expected primary release-key fingerprint, without spaces |

The identity needs public certificate read and signing-key get/sign permissions
for the existing Windows certificate. It also needs secret get permissions for
`datam8-v2-gpg-private` (ASCII-armored private signing key) and
`datam8-v2-gpg-passphrase`. Restrict permissions to these resources when the
existing vault permission model supports that. Do not change the vault permission
model or firewall as part of this setup. Review existing consumers before
restricting a principal to certificate get, key get/sign and required secret get
operations.
Check that hosted runners can reach the existing vault before running the workflow.

Review Azure management-role assignments as well as the vault policy. Owner,
Contributor or another role allowing vault policy changes can let the principal
restore broader access, so limiting only its data-plane policy is insufficient.
Identify other deployments that use a principal before removing such
roles. Record the approved remaining permissions privately. See
[Microsoft's access-policy guidance](https://learn.microsoft.com/en-us/azure/key-vault/general/assign-access-policy).

Provision one GPG release key, securely retain its revocation information, and
store the private key and passphrase in those vault secrets. Publish its public
key and expected fingerprint on the official project site as well as in releases.
A public key delivered only alongside a download is not an independent trust
anchor. The workflow checks the vault key against the configured fingerprint.

Windows uses AzureSignTool 6.0.0, SHA-256 and an RFC-3161 timestamp. Its private
key stays in Azure. Vault access uses short-lived GitHub OIDC credentials.
Expired certificates, missing code-signing EKU, failed signatures and missing
permissions stop a signed build.

macOS and Linux distributions have detached GPG signatures. GPG keys exist only
in a temporary runner directory while signing. PR builds cannot access the vault
and are not suitable as signed release candidates.

The configured public GPG fingerprint is `A8987DFCDEC1DEA028294BCACFF392232DB6BB4B`.
The [public key](signing/datam8-release-public.asc) and
[fingerprint file](signing/GPG-FINGERPRINT.txt) are versioned here for verification.
The Windows publisher is `DataM8`, with certificate SHA-256 fingerprint
`32:F6:17:AD:2E:CC:45:CC:28:AB:0E:3D:E7:EF:2C:7B:C9:51:59:99:1E:C8:95:12:82:42:68:73:81:47:1B:BC`.
The existing certificate expires on 20 March 2027. Renew it before that date.
Its issuer is the private ORAYLIS SCEPman CA, not a Windows public trust anchor.
Windows CI explicitly trusts the pinned [ORAYLIS CA](signing/oraylis-signing-root.cer)
only on disposable runners, then removes that trust. Thus passing CI proves
Authenticode integrity, publisher identity, timestamping and updates under corporate
CA trust. It does not prove public Windows trust. Unmanaged PCs can report an
unknown publisher and reject automatic updates unless their administrator has
established this CA trust. The application never installs a root certificate.
Public distribution without that prerequisite requires a publicly trusted signing
certificate; SmartScreen reputation remains separate. See
[Microsoft's Authenticode trust explanation](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/authenticode).
Review the effective permission scope with the vault owner: legacy access policies
apply at vault scope, while resource-scoped permissions require a suitable RBAC
configuration. Record the actual policy and revocation-material location in the
private operations runbook.

### Maintainer configuration and recovery

This public repository documents the workflow interface and verification process.
Keep actual vault endpoints/names, certificate aliases, tenant/subscription IDs,
application/service-principal IDs, effective access policies and recovery records
in an access-controlled operations runbook. Use placeholders in public examples.
Environment/secret variable names used by the public workflows are interface names,
not secret values.

The infrastructure was provisioned once through authorized Azure CLI and GitHub
CLI/API sessions. The workflows consume it; they do not provision it. There is
currently no Terraform, Bicep or idempotent provisioning script in this repository.
Authorized maintainers can inspect the configured GitHub environment and use their
private runbook to locate and inspect Azure resources without retrieving keys.

Before a tagged release, configure tag protection: the environment's tag allowlist
alone does not protect tags. The signing workflow also checks
`github.ref_protected` and refuses unprotected tags. Manual feature-branch runs do
not publish releases.

When restoring the signing identity, coordinate its federation, vault permissions,
management roles and GitHub client-ID setting. Restore GPG signing from
the protected existing key; generating another key changes the fingerprint and
download trust anchor. Keep revocation material and backup/recovery instructions
private until a revocation is intentionally published. Azure resource-group roles
alone do not grant permission to edit an Entra app registration; federation changes
require the app owner or an authorized Entra administrator. Any signing-identity
change needs a complete successful signed four-platform run before retiring the
previous identity. Do not delete signing certificates or GPG secrets during cleanup.

Names such as `desktop-signing-v2`, `AZURE_V2_CLIENT_ID` and the GPG secret names
are the current workflow interfaces. Their suffix does not describe a second
maintained process. Renaming an environment requires coordinated changes to its
OIDC subject, deployment rules, variables/secrets and workflow references. There
is no need to rename working configuration as part of the product replacement.

### Information suitable for publication

Publish the release public key, expected fingerprints, publisher identity,
certificate validity and verification instructions. These identify the signer;
they do not grant signing authority. The Windows signing certificate is also
embedded in signed packages. See [Microsoft's certificate explanation](https://learn.microsoft.com/en-us/windows/win32/seccrypto/certificates-and-public-keys)
and the [GNU Privacy Handbook](https://gnupg.org/gph/en/manual.html).

Never publish PFX files, private keys, passphrases, access tokens or an unused GPG
revocation certificate. Operational resource identifiers and personal/customer
names are unnecessary in download notes even when they are not credentials.
Use neutral fixtures and redact personal paths, connection endpoints and live
credential values in logs/screenshots. Moving information out of current files
does not remove earlier copies from Git history or existing artifacts.

The user-facing [installation guide](desktop-installation.md) is packaged as
`INSTALL-AND-VERIFY.md`. It excludes administrator setup and infrastructure
inventory; this maintainer document is not copied into distribution notes.

## macOS without Apple Developer ID

There is currently no Apple Developer membership, Developer ID or notarization
requirement. Both Mac architectures use ad-hoc bundle signatures. These preserve
bundle integrity but do not establish an Apple-verified publisher or provide an
Apple malware-scan ticket. Automatic macOS updates are disabled.

macOS and Linux still check published releases from inside the app and show
GitHub release notes with a link to the matching downloads. These checks do not
replace the manual signature verification and installation steps below.

Download the DMG or ZIP for your architecture and verify the GPG signature first.
Copy `datam8.app` into Applications. If macOS blocks the initial opening, follow
[Apple's instructions for opening an app from an unidentified developer](https://support.apple.com/en-us/102445):
after the attempted opening, use **System Settings → Privacy & Security → Open
Anyway**, then confirm opening that specific application. Managed Macs may forbid
this exception. There is no need to disable Gatekeeper globally.

The app bundles Python 3.12.15 from python-build-standalone release 20261003.
Runtime downloads are pinned by SHA-256, and every native dependency is checked
for bundle-local or macOS-system resolution. No Homebrew or external Python
installation is required. Runtime startup cannot write bytecode or change file
permissions inside the signed application.

## Verify downloads and update manually

Import the published public key and compare its fingerprint with the independently
published DataM8 fingerprint before trusting it:

```sh
gpg --import datam8-release-public.asc
gpg --fingerprint A8987DFCDEC1DEA028294BCACFF392232DB6BB4B
# Verify the signed manifest, then verify the downloaded package bytes.
gpg --verify SHA256SUMS.asc SHA256SUMS
gpg --verify DataM8-2.0.0-mac-arm64.dmg.asc DataM8-2.0.0-mac-arm64.dmg
```

Use the filename for your release. On Linux use `sha256sum --check SHA256SUMS`;
on macOS use `shasum -a 256 --check SHA256SUMS` when all listed downloads are
present. Detached signatures do not automatically run when opening an AppImage
or installing a downloaded DEB. Verify before installation.

Windows installers instead have Authenticode signatures and are included in the
GPG-signed checksum manifest. Windows automatic updates retain publisher-signature
validation. macOS and Linux updates are manual: close DataM8, verify the new
package and replace/install the application while retaining solution directories.

## In-app update process

All installed platforms expose **Help → Check for Updates…** without requiring a
solution. Checks run only when the user selects this menu item; no release
requests run at startup or periodically. There are no update system notifications
or permanent in-app notices. Drafts, incomplete platform packages
and incompatible channels are excluded: stable installations offer stable releases, beta installations offer
newer beta/stable releases, and downgrades are disabled.

Release notes are fetched from the GitHub API by the exact offered tag in
`oraylis/datam8-frontend`. Native dialogs display up to twelve plaintext lines or
1,200 characters and link to the full notes. Notes failures do not prevent an
otherwise valid update. No tokens or signing credentials are distributed to the
application. Public API rate limits/offline errors are shown on manual checks.

Windows requires `latest.yml` even for beta releases, the NSIS installer and the
release verification files. The updater is pointed at the selected tag's
official download directory, so its metadata, installer and notes describe the
same version. Metadata mismatch blocks downloading. Existing Authenticode
publisher checks remain active. macOS requires both architecture-specific DMG
and ZIP packages and their signatures; Linux requires AppImage and DEB with
signatures. All candidates require the signed checksum manifest and public GPG
key. Asset presence is a selection filter; Windows verifies downloaded bytes and
publisher signatures, while macOS/Linux users verify downloads before installing.

Windows downloads start only by user choice. Installation at ordinary app quit
is disabled. **Restart and Install** first saves focused drafts, drains queued
editor saves and follow-up operations, rejects remaining dirty tabs or active
work, then stops the backend before invoking the installer. Native confirmation
dialogs are asynchronous and attached to the app window.
Download progress uses the Windows taskbar. A postponed installation is offered
again through **Help → Check for Updates…**, without another download.

For an isolated manual preview with native dialogs, see
[the update demo](dev-desktop.md#developer-tools-and-update-simulation).

## Required verification

The workflow performs lint, typecheck, workspace unit tests, documentation checks,
web Playwright tests and real-backend gates. Fresh verification runners install
NSIS and DEB packages, mount/copy DMGs, extract ZIPs and launch AppImages.

The Windows signature gate requires Windows SDK SignTool, provided by the
`windows-2025` image. It uses `/pa /all /tw` to validate embedded signatures and
timestamps, and reads the embedded PKCS#7 record to check the expected certificate,
SHA-256 and RFC-3161 timestamp. A Windows catalog signature cannot substitute for
the DataM8 signature. See [Microsoft's SignTool reference](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool).

Packaged Playwright tests exercise real preload, IPC and backend behavior with
disposable local fixtures in paths containing spaces. They open a solution,
check health/authenticated config, edit and persist a model value, restart,
generate `Hello world`, switch solutions and verify backend shutdown. Only the
native file chooser and update-dialog answers are replaced. Update-link tests
capture the browser-opening call; they assert the official release URL without
opening an external browser. Preload, IPC, HTTP and persistence stay real. No
sample-cloud source is contacted.

```sh
npm run test:runtime:packaged -- --runtime-root /absolute/path/to/python-runtime
DATAM8_INSTALLED_MANIFEST=/absolute/path/to/installed.json npm run test:desktop:packaged
npm run test:desktop:signatures -- /absolute/path/to/installed/datam8.app
npm run test:desktop:updates -- artifacts/update-fixtures
npm run test:desktop:updates:ui
```

To diagnose only the Windows update test, the manual entry workflow accepts the
optional `windows_update_fixture_run` input with the ID of a previous successful
Windows fixture build (within its two-day artifact retention). This downloads the
already signed fixtures onto a fresh Windows runner and executes the current test
code without Vault access or final delivery. A diagnostic pass does not count as
four-platform acceptance. Leave the input empty for the required final full run.

`installed.json` is generated by `scripts/desktop-distributions.mjs install`.
Windows update tests use two signed private fixture versions and an HTTP loopback
feed. They verify installation and restart, and reject unsigned or incorrectly
signed updates through the UI's download and installation paths, including a
focused edit immediately before installation and a real installer restart. The
internal `DATAM8_UPDATE_TEST_FEED` and `DATAM8_UPDATE_TEST_RELEASES` overrides
accept only HTTP on `127.0.0.1`. `DATAM8_UPDATE_TEST_PROFILE` retains the isolated
profile across an installer restart and is honored only when both loopback test
services are configured. `DATAM8_BACKEND_TEST_PORT` isolates backend listeners.
Acceptance tests route explicit checks to local feeds and assert that startup
does not request releases. They do not download public updates.

The quality job also opens the development simulation through **Developer →
Developer Tools… → Open Update Simulation** under Xvfb with a real Generator
environment. It verifies process/profile/port isolation, repeated open, fresh
profiles on reopen and cleanup when either app closes. It covers native dialog
options, exact-version notes,
progress, errors, focused inputs, in-flight/queued saves and failed saves. Fresh
packaged macOS/Linux tests cover manual-update IPC/HTTP for both distribution
formats and assert that developer functions are absent even with simulation
flags set. Platform-native dialog appearance is additionally checked manually
through the development panel described in [desktop development](dev-desktop.md).

macOS/Linux tests replace a previous private fixture version with the installed
current version and verify retained profile storage and saved model content.
macOS signatures must remain valid after repeated use. GPG tests reject modified
packages and an unrelated signing key. Missing/ambiguous platform outputs prevent
final delivery. `BUILD-MANIFEST.json` records the commit, workflow URL, public
Windows identity, GPG fingerprint and file sizes.

A successful final run at one commit must cover all four platforms. Failed runs
retain JUnit, screenshots, traces and redacted logs for 30 days; large intermediate
packages are kept for 2 days and the verified final download for 14 days.
GitHub-hosted runners contain development tools, so static native-dependency
checks complement runtime tests. Windows Server runners do not fully represent
Windows 11 or SmartScreen reputation. Ad-hoc Mac signatures do not satisfy
Gatekeeper's Developer ID/notarization checks.

## Shared quality checks and local commands

`ci.yml` owns the quality checks and is reused by the desktop workflow. Pull
requests enter through `desktop-pr.yml` and run those checks once before the
four native builds. Pushes to `main` and explicit quality dispatches run quality
only. Manual desktop builds and protected release tags use the same checks.
Generated schema types are checked for consistency; the backend wheel is built
once as a quality gate. Native runtime builds install the pinned Generator source
and do not build an additional unused wheel.

Use `npm run build:desktop` on the native host. CI uses the single workspace
`package` command with `--win`, `--mac` or `--linux`. Packaging uses the dependencies
installed by `npm ci`; it does not reinstall or prune the shared workspace. Installed-package tests also
smoke-test each bundled interpreter, so a separate installed-runtime loop is not
needed. The standalone `test:runtime:packaged` command remains useful for diagnosis.

`npm run test:e2e:sample -- [Playwright options or a test filename]` is optional
acceptance against a disposable copy of a supplied sample solution. Set
`DATAM8_SAMPLE_SOLUTION_PATH`; it is not a desktop release gate or a CI dependency.
Only run source refresh exercises with the sample's external access deliberately
prepared. The simulation, packaged acceptance and backend gates use local,
self-contained fixtures.

Development simulation helpers and their type declarations are excluded from
packaged application files. The main process loads them only in development;
setting simulation environment variables in an installed app cannot load them.
Keep the root file filters together before the web asset mapping: Electron
Builder merges separated filter groups and can re-include excluded files. The
installed-package test checks the actual ASAR contents.
