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
The current v2 configuration uses a dedicated Azure application/service principal;
v1 retains its existing signing principal and client-secret authentication.
The v2 application has a federated credential whose issuer is
`https://token.actions.githubusercontent.com`, audience is
`api://AzureADTokenExchange` and subject is
`repo:oraylis/datam8-frontend:environment:desktop-signing-v2`.

Configure these secrets on the v2 GitHub environment. The initial setup reused
the existing v1 configuration values without modifying its repository secrets:

| Secret | Meaning |
| --- | --- |
| `AZURE_KEY_VAULT_TENANT` | Azure tenant ID |
| `AZURE_KEY_VAULT_URL` | Vault URL, for example `https://example.vault.azure.net` |
| `AZURE_KEY_VAULT_NAME` | Windows certificate name inside the vault; not the vault name |

Set these v2 environment variables:

| Variable | Meaning |
| --- | --- |
| `AZURE_V2_CLIENT_ID` | Application client ID used by the v2 OIDC jobs |
| `DATAM8_GPG_FINGERPRINT` | Expected primary release-key fingerprint, without spaces |

The identity needs public certificate read and signing-key get/sign permissions
for the existing Windows certificate. It also needs secret get permissions for
`datam8-v2-gpg-private` (ASCII-armored private signing key) and
`datam8-v2-gpg-passphrase`. Restrict permissions to these resources when the
existing vault permission model supports that. Do not change the vault permission
model or firewall as part of this setup. Limit signing principals' policies to
certificate get, key get/sign and required secret get operations after reviewing
existing consumers. Keep v1's required signing access and repository credentials.
Check that hosted runners can reach the existing vault before running the workflow.

Review Azure management-role assignments as well as the vault policy. Owner,
Contributor or another role allowing vault policy changes can let the principal
restore broader access, so limiting only its data-plane policy is insufficient.
Identify other deployments that use the shared principal before removing such
roles. Record the approved remaining permissions privately. See
[Microsoft's access-policy guidance](https://learn.microsoft.com/en-us/azure/key-vault/general/assign-access-policy).

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
private operations runbook; preserve the operations required by existing v1 signing.

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

When restoring the v2 identity, coordinate its federation, vault permissions,
management roles and GitHub client-ID setting. Restore GPG signing from
the protected existing key; generating another key changes the fingerprint and
download trust anchor. Keep
revocation material and backup/recovery instructions private until a revocation
is intentionally published. Do not overwrite v1 credentials during v2 recovery.

A future migration can reuse the v1 application for v2 OIDC if its app owner or
an authorized Entra administrator can add the federation. Azure resource-group
roles alone do not grant permission to edit an Entra app registration. Keep the
current v2 identity and client-ID setting until that federation is configured.
After switching the v2 client-ID setting, complete a signed four-platform manual
run with the restricted shared identity before removing the obsolete dedicated
v2 application and its vault policy. Do not delete the shared signing certificate
or GPG secrets during identity cleanup.

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

The Windows signature gate requires Windows SDK SignTool, provided by the
`windows-2025` image. It uses `/pa /all /tw` to validate embedded signatures and
timestamps, and reads the embedded PKCS#7 record to check the expected certificate,
SHA-256 and RFC-3161 timestamp. A Windows catalog signature cannot substitute for
the DataM8 signature. See [Microsoft's SignTool reference](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool).

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

To diagnose only the Windows update test, the manual entry workflow accepts the
optional `windows_update_fixture_run` input with the ID of a previous successful
Windows fixture build (within its two-day artifact retention). This downloads the
already signed fixtures onto a fresh Windows runner and executes the current test
code without Vault access or final delivery. A diagnostic pass does not count as
four-platform acceptance. Leave the input empty for the required final full run.

`installed.json` is generated by `scripts/desktop-distributions.mjs install`.
Windows update tests use two signed private fixture versions and an HTTP loopback
feed. They verify installation and restart, and reject unsigned or incorrectly
signed updates. The internal `DATAM8_UPDATE_TEST_FEED` override accepts only
HTTP on `127.0.0.1`. Regular acceptance tests set
`DATAM8_DISABLE_AUTO_UPDATES=1` and cannot download public updates.

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
