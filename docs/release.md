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
The vault uses legacy access policies, so the new principal's get/sign and secret
get permissions apply at vault scope. Resource-scoped permissions require a future
separate vault or coordinated RBAC migration; this setup preserves the v1 policies.
Revocation information is retained in `datam8-v2-gpg-revocation` in the vault.

### Provisioned v2 infrastructure

The initial setup was performed through the authenticated Azure CLI and GitHub
CLI/REST API on 9 October 2026. The application, federated credential, vault
policy and GitHub environment configuration below were checked again through
those APIs on 10 October 2026. This is a record of the provisioned infrastructure;
the workflows consume it but do not create it. There is currently no Terraform,
Bicep or idempotent provisioning script in this repository.

| Resource | Provisioned value |
| --- | --- |
| Azure subscription | `04154975-918c-4f54-b216-f8ca3cdee657` |
| Resource group | `automation-platform-dev` |
| Key Vault | `aut0kvt0dev0standard` |
| Vault endpoint | `https://aut0kvt0dev0standard.vault.azure.net` |
| Existing Windows certificate | `DataM8CodeCert1` |
| Entra application | `datam8-desktop-v2-github-signing` |
| Application/client ID | `2ce264e6-f9b5-4b36-b994-7f44eb20dfb5` |
| Application object ID | `dfbd21bd-fe6c-4332-8563-4f998e27d67c` |
| Service principal object ID | `e17a9f1e-dd75-419e-853e-7ebf7f53a1ba` |
| Federated credential name | `github-desktop-signing-v2` |
| GitHub repository | `oraylis/datam8-frontend` |
| GitHub environment | `desktop-signing-v2` |

These identifiers are configuration metadata, not credentials. The Azure tenant
ID is held in the environment secret `AZURE_KEY_VAULT_TENANT`; private keys,
passphrases and access tokens are not stored in the repository.

The setup consisted of these steps:

1. Sign in to Azure using the authorized administrator's interactive MFA/device
   login. Create the separate Entra application and its service principal. No
   application client secret was created for v2.
2. Add the federated credential using the issuer, audience and environment subject
   specified above. GitHub jobs in that environment can exchange an OIDC token
   for a short-lived Azure token; ordinary PR jobs cannot use this identity.
3. Add a policy for the new service principal on the existing vault: certificates
   `get`, keys `get`/`sign`, secrets `get`. The vault remains in legacy access-policy
   mode (`enableRbacAuthorization: false`); these permissions are vault-wide.
   Existing v1 policies, certificate material, firewall and permission model were
   not changed. The supplied PFX was not imported because the existing certificate
   was suitable.
4. Create the GitHub environment with custom deployment policies for branch
   `feature/external_refresh` and tags `v*`. Set environment variables
   `AZURE_V2_CLIENT_ID` and `DATAM8_GPG_FINGERPRINT`, and environment secrets
   `AZURE_KEY_VAULT_TENANT`, `AZURE_KEY_VAULT_URL` and `AZURE_KEY_VAULT_NAME`.
   Here `AZURE_KEY_VAULT_NAME` is `DataM8CodeCert1`, not the vault resource name.
5. Generate an Ed25519 GPG signing key with a three-year expiry and a random
   passphrase in a temporary private directory. Store the armored private key,
   passphrase and generated revocation certificate in the three v2 vault secrets
   named above. Export only the public key and fingerprint into `docs/signing`;
   terminate the temporary GPG agent and remove the local private-key directory.

The environment currently has no required reviewers or wait timer, and its API
configuration permits administrator bypass. Its tag deployment policy is an
allowlist, not tag protection. The repository's release-tag ruleset was disabled
when checked; no active tag ruleset was present. Before a future tagged release,
configure tag protection. The signing workflow additionally requires
`github.ref_protected == true` for tags and refuses unprotected tags. Manual
feature-branch runs do not publish releases.

### Inspect and recover the configuration

With authorized Azure/GitHub CLI sessions, these read-only commands inspect the
configuration without retrieving private keys or secret values. Specify the
subscription explicitly: a user's current default subscription may be different.

```sh
az ad app show --id 2ce264e6-f9b5-4b36-b994-7f44eb20dfb5 \
  --query '{name:displayName,clientId:appId,objectId:id}'
az ad app federated-credential list \
  --id dfbd21bd-fe6c-4332-8563-4f998e27d67c
az keyvault show --name aut0kvt0dev0standard \
  --subscription 04154975-918c-4f54-b216-f8ca3cdee657 \
  --query "{rbac:properties.enableRbacAuthorization,policy:properties.accessPolicies[?objectId=='e17a9f1e-dd75-419e-853e-7ebf7f53a1ba']}"
gh api repos/oraylis/datam8-frontend/environments/desktop-signing-v2
gh api repos/oraylis/datam8-frontend/environments/desktop-signing-v2/deployment-branch-policies
gh variable list --repo oraylis/datam8-frontend --env desktop-signing-v2
gh secret list --repo oraylis/datam8-frontend --env desktop-signing-v2
```

To repair a missing setting, restore the recorded policy or environment value
using an authorized administrator account. Recreating the Entra application
produces new IDs: update the vault policy, federated credential and GitHub client
ID together. Restore GPG signing from the existing protected key material; simply
generating a replacement changes its fingerprint and the download trust anchor.
Use the retained revocation certificate if that key must be revoked, and publish
an explicit key-rotation notice. Do not overwrite the existing Windows certificate
or v1 settings while repairing v2. The current vault is the stored source of the
GPG private material; an independent disaster-recovery backup has not been set up
by this implementation.

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
