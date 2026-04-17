# Windows Defender / SmartScreen Release Checklist

Use this checklist for every Windows desktop release to reduce install/startup friction with Microsoft Defender and SmartScreen.

## 1) Build + sign in CI

- Run the tag-based `Release` workflow.
- Ensure Windows signing step succeeds for all release binaries:
  - `*.exe`
  - `*.dll`
  - `*.node`
- Ensure signature verification step reports `Valid` for all signed files.

## 2) Prepare evidence package

Collect and store for the release:

- Release version/tag
- SHA256 checksums of published artifacts
- File list of signed binaries in `apps/desktop/release`
- CI run URL and commit SHA

## 3) Defender pre-submission

Before broad rollout, submit high-risk files to Microsoft Security Intelligence:

- Windows installer (`.exe`)
- Main application executable
- Bundled runtime executables (for example `python.exe`)
- Any binary that previously triggered detections

Submission portal:

- https://www.microsoft.com/en-us/wdsi/filesubmission

Include:

- Product name/version
- Publisher/certificate info
- False-positive context and intended behavior

## 4) Clean-VM validation

Run install/start tests on a fresh Windows 11 VM with default Defender settings:

- Download installer from release page
- Install application
- Start app and execute the backend start path once
- Confirm no quarantine/block events for installer, app executable, or runtime binaries

## 5) Incident response (if flagged after release)

- Capture detection name, SHA256, file path, and Defender event/log data.
- Re-submit flagged files with the detection details.
- Track submission case IDs and response status.
- Publish temporary mitigation guidance for users if needed.

