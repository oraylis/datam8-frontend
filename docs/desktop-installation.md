# Install and verify DataM8 Desktop

Use packages from a successful verified GitHub workflow or an official release.
Choose Windows x64 (NSIS), macOS ARM64 (Apple Silicon) or x64 (Intel), or Linux
x64 (AppImage/DEB). `BUILD-MANIFEST.json` records the build commit, workflow and
Windows signer. Download the package and its verification files together.

## Public signing identities

The release [public GPG key](signing/datam8-release-public.asc) has fingerprint:

```text
A8987DFCDEC1DEA028294BCACFF392232DB6BB4B
```

Compare it against a trusted project publication before importing the key.
A key supplied only with a download is not an independent trust anchor. The
[fingerprint file](signing/GPG-FINGERPRINT.txt) is also versioned in the repository.

Windows packages use publisher `DataM8`. The current signing certificate's
SHA-256 fingerprint is:

```text
32:F6:17:AD:2E:CC:45:CC:28:AB:0E:3D:E7:EF:2C:7B:C9:51:59:99:1E:C8:95:12:82:42:68:73:81:47:1B:BC
```

The Windows certificate is issued by a private ORAYLIS CA. Signature integrity
does not establish public Windows trust. Unmanaged PCs may report an unknown
publisher and reject automatic updates; any corporate CA trust must be managed
by the device administrator. DataM8 does not install a root certificate.
Windows 11/SmartScreen behavior is not fully covered by the CI runners.

## Verify the downloaded bytes

With GnuPG installed, import the independently checked public key, confirm its
fingerprint, and verify the signed checksums and your package:

```sh
gpg --import datam8-release-public.asc
gpg --fingerprint A8987DFCDEC1DEA028294BCACFF392232DB6BB4B
gpg --verify SHA256SUMS.asc SHA256SUMS
gpg --verify DataM8-2.0.0-beta.6-mac-arm64.dmg.asc DataM8-2.0.0-beta.6-mac-arm64.dmg
```

Replace the example filename with your DMG, ZIP, AppImage or DEB. All four formats
have detached `.asc` signatures. Windows EXE files use embedded Authenticode
signatures and are covered by the signed checksum list.

When all files listed in `SHA256SUMS` are present, run `shasum -a 256 --check
SHA256SUMS` on macOS or `sha256sum --check SHA256SUMS` on Linux. If downloading
only one package, compare its calculated SHA-256 with its entry in the verified
checksum list. Opening/installing a package does not perform GPG verification.

## Install on macOS

Quit the existing DataM8 app. Open the matching DMG and copy `datam8.app` into
Applications, or extract the matching ZIP and copy the app there. Python is
bundled; a separate Python or Homebrew installation is not required.

The app uses ad-hoc signatures without Apple Developer ID or notarization. If
macOS blocks opening, follow [Apple's per-app instructions](https://support.apple.com/en-us/102445):
after attempting to open, use **System Settings → Privacy & Security → Open
Anyway** and confirm that specific app. Managed devices may disallow this.

## Install on Windows or Linux

On Windows, run the verified NSIS EXE and follow the installer. Test the app by
opening a disposable copy of a solution directory, including its referenced
Base, Model, Plugins and generator templates.

On Linux, install the verified DEB with the system package manager, or make the
verified AppImage executable and start it. AppImage support depends on the host's
runtime/FUSE configuration. Both formats contain the Python runtime.

## Update and retain your data

Use **Help → Check for Updates…** to check published GitHub releases and read
their release notes. Checks run only when you choose this menu item; startup
and background activity do not contact the release server or show update notices.
Stable versions offer newer stable releases; beta versions offer newer beta or
stable releases. Downloads from workflow runs are not offered as updates.

On Windows, choose **Download Update**, then **Restart and Install** when ready.
DataM8 requires the signing CA to be trusted by the device and validates the
publisher signature before accepting a download. Downloads and installation
require your choice; ordinary quitting does not install an update. Installation
saves active drafts and waits for outstanding saves and backend shutdown.
Download progress appears in the Windows taskbar. If you choose **Later** after
downloading, **Help → Check for Updates…** offers **Restart and Install** again.
Unresolved changes, save errors, an open editor dialog, generation or solution
loading stop installation so you can finish your work first.

On macOS and Linux, **Open Release & Downloads** opens the matching GitHub release
with packages and verification instructions. Quit DataM8, verify the new package
and replace/install it. Keep solution directories and application user data. Do
not modify files inside the signed application. Native dialogs show a plaintext
excerpt of GitHub release notes; use the release page for the full notes.

Maintainers can find workflow and test details in the repository's `docs/release.md`.
Update simulations are available only through the Developer panel of the
development app; installed packages have no developer mode.
