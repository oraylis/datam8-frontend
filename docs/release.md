# Desktop builds, signing and release verification

The v2 desktop workflow builds Windows x64, macOS Intel, macOS ARM64 and Linux
x64 on native GitHub-hosted runners. It tests the installed distributions before
providing the final `DataM8-verified-four-platforms` workflow artifact. No public
release is created by a manual verification run.

The existing v1 workflow and signing certificate on `main` remain unchanged.
The workflow path `ci-push-and-pull-request-merged.yml` is already registered on
`main`; select **feature/external_refresh** when running it manually. Its version
on the feature branch delegates to the reusable v2 workflow. Changes and tests
remain on that feature branch until reviewed.

## Signing configuration

Create the GitHub environment `desktop-signing-v2`. Restrict deployment refs to
`feature/external_refresh` and protected `v*` release tags. Do not permit PR refs.
Use a separate Azure application/service principal for v2 with a federated
credential whose issuer is `https://token.actions.githubusercontent.com`, audience
is `api://AzureADTokenExchange` and subject is
`repo:oraylis/datam8-frontend:environment:desktop-signing-v2`.

Reuse these existing v1 repository secrets without changing their values:

| Secret | Meaning |
| --- | --- |
| `AZURE_KEY_VAULT_TENANT` | Azure tenant ID |
| `AZURE_KEY_VAULT_URL` | Vault URL, for example `https://example.vault.azure.net` |
| `AZURE_KEY_VAULT_NAME` | Windows certificate name inside the vault; not the vault name |

Set these v2 environment variables:

| Variable | Meaning |
| --- | --- |
| `AZURE_V2_CLIENT_ID` | New v2 application client ID |
| `DATAM8_GPG_FINGERPRINT` | Expected primary release-key fingerprint, without spaces |

The identity needs public certificate read and signing-key get/sign permissions
for the existing Windows certificate. It also needs secret get permissions for
`datam8-v2-gpg-private` (ASCII-armored private signing key) and
`datam8-v2-gpg-passphrase`. Restrict permissions to these resources when the
existing vault permission model supports that. Do not change the vault permission
model, firewall or v1 access policies as part of this setup. Check that hosted
runners can reach the existing vault before running the workflow.

Provision one GPG release key, securely retain its revocation information, and
store the private key and passphrase in those vault secrets. Publish its public
key and expected fingerprint on the official project site as well as in releases.
A public key delivered only alongside a download is not an independent trust
anchor. The workflow checks the vault key against the configured fingerprint.

Windows uses AzureSignTool 6.0.0, SHA-256 and an RFC-3161 timestamp. Its private
key stays in Azure. Vault access uses short-lived GitHub OIDC credentials, not
the v1 client secret. Expired certificates, missing code-signing EKU, failed
signatures and missing permissions stop a signed build.

macOS and Linux distributions have detached GPG signatures. GPG keys exist only
in a temporary runner directory while signing. PR builds cannot access the vault
and are not suitable as signed release candidates.

The configured public GPG fingerprint is `A8987DFCDEC1DEA028294BCACFF392232DB6BB4B`.
The [public key](signing/datam8-release-public.asc) and
[fingerprint file](signing/GPG-FINGERPRINT.txt) are versioned here for verification.
The Windows publisher is `DataM8`, with certificate SHA-256 fingerprint
`32:F6:17:AD:2E:CC:45:CC:28:AB:0E:3D:E7:EF:2C:7B:C9:51:59:99:1E:C8:95:12:82:42:68:73:81:47:1B:BC`.
The existing certificate expires on 20 March 2027. Renew it before that date.
The vault uses legacy access policies, so the new principal's get/sign and secret
get permissions apply at vault scope. Resource-scoped permissions require a future
separate vault or coordinated RBAC migration; this setup preserves the v1 policies.
Revocation information is retained in `datam8-v2-gpg-revocation` in the vault.

## macOS without Apple Developer ID

There is currently no Apple Developer membership, Developer ID or notarization
requirement. Both Mac architectures use ad-hoc bundle signatures. These preserve
bundle integrity but do not establish an Apple-verified publisher or provide an
Apple malware-scan ticket. Automatic macOS updates are disabled.

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
gpg --fingerprint
# Verify the signed manifest, then verify the downloaded package bytes.
gpg --verify SHA256SUMS.asc SHA256SUMS
gpg --verify DataM8-2.0.0-beta.6-mac-arm64.dmg.asc DataM8-2.0.0-beta.6-mac-arm64.dmg
```

Use the filename for your release. On Linux use `sha256sum --check SHA256SUMS`;
on macOS use `shasum -a 256 --check SHA256SUMS` when all listed downloads are
present. Detached signatures do not automatically run when opening an AppImage
or installing a downloaded DEB. Verify before installation.

Windows installers instead have Authenticode signatures and are included in the
GPG-signed checksum manifest. Windows automatic updates retain publisher-signature
validation. macOS and Linux updates are manual: close DataM8, verify the new
package and replace/install the application while retaining solution directories.

## Required verification

The workflow performs lint, typecheck, workspace unit tests, documentation checks,
web Playwright tests and real-backend gates. Fresh verification runners install
NSIS and DEB packages, mount/copy DMGs, extract ZIPs and launch AppImages.

Packaged Playwright tests exercise real preload, IPC and backend behavior with
disposable local fixtures in paths containing spaces. They open a solution,
check health/authenticated config, edit and persist a model value, restart,
generate `Hello world`, switch solutions and verify backend shutdown. Only the
native file chooser is replaced. No sample-cloud source is contacted.

```sh
npm run test:runtime:packaged -- --runtime-root /absolute/path/to/python-runtime
npm run test:desktop:packaged -- /absolute/path/to/installed.json
npm run test:desktop:signatures -- /absolute/path/to/installed/datam8.app
npm run test:desktop:updates -- artifacts/update-fixtures
```

`installed.json` is generated by `scripts/desktop-distributions.mjs install`.
Windows update tests use two signed private fixture versions and an HTTP loopback
feed. They verify installation and restart, and reject unsigned or incorrectly
signed updates. The internal `DATAM8_UPDATE_TEST_FEED` override accepts only
HTTP on `127.0.0.1`. Regular acceptance tests set
`DATAM8_DISABLE_AUTO_UPDATES=1` and cannot download public updates.

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
