# Desktop Development

Frontend starts a local FastAPI backend process via Python module execution.

## Backend start contract

```bash
python -m datam8 serve --host 127.0.0.1 --port 4318 --token <random>
```

Readiness line:

```json
{"type":"ready","baseUrl":"http://127.0.0.1:<PORT>","version":"<cliVersion>"}
```

Renderer uses root endpoints (`/config`, `/solution/*`, `/model/*`, `/model/generate`, ...), no `/api/*` and no `/jobs`.

## Runtime configuration

- Opening solutions in development requires the interpreter from
  `submodules/datam8-generator/.venv`; the frontend and update simulation can
  start without it.
- Prepare local backend dependencies with:
  - `cd submodules/datam8-generator`
  - `uv sync --all-extras`
- `DATAM8_PYTHON_PATH`: optional override, but must still point to that `.venv` interpreter
- `DATAM8_BACKEND_MODULE`: optional module name (default `datam8`)
- Connector discovery uses the loaded solution's `pluginsPath`; see
  [connectors](connectors.md). The former `DATAM8_PLUGIN_DIR` discovery guidance is historical.

Windows interpreter override (from repo root):

```powershell
$env:DATAM8_PYTHON_PATH = (Resolve-Path .\submodules\datam8-generator\.venv\Scripts\python.exe).Path
npm run dev:desktop
```

macOS/Linux:

```sh
DATAM8_PYTHON_PATH="$PWD/submodules/datam8-generator/.venv/bin/python" npm run dev:desktop
```

The development launcher uses that submodule virtual environment when prepared.
Packaged runtime resolution is a separate concern. See [browser setup](../README.md#local-development)
for the startup-bound web workflow and [user guide](user-guide/README.md) for usage.

The desktop development watcher completes its first TypeScript compilation before
starting Electron. Later successful builds and desktop resource changes trigger
one orderly restart after the previous instance has cleaned up its backend and
update simulation and exited. Identical output
rewrites do not restart the app; compilation errors leave the existing instance
running until a successful changed build. Vite continues to handle web UI changes
without restarting Electron.

The Manrope UI font is bundled with the web assets. Desktop startup does not
depend on Google Fonts or an internet connection. Its OFL license is shipped
in `web/licenses/Manrope-OFL.txt` inside the packaged app.

## Developer tools and update simulation

With Node 24 and installed npm dependencies, use the normal desktop start:

```sh
npm run dev:desktop
```

Choose **Developer → Developer Tools…**, then **Open Update Simulation** in the
frontend panel. The panel is non-modal and does not block editing or save checks.
A separate Electron instance opens with an **Update Simulation** title, temporary
profile, example solution, local release server and its own backend port. Repeated
opening focuses the existing simulation; after closing it, the next start creates
a fresh profile. Your original window and its work remain separate.

Select **This system** or **Windows preview**, choose a **Scenario**, and click
**Run Scenario**. Available cases cover newer/current versions, incompatible
packages, long/missing/unavailable notes, network errors, slow downloads and
interrupted downloads. The last two always use the Windows preview. During a
running operation, scenario selection is disabled.

Native dialogs, preload/IPC, release HTTP and save checks use the regular paths.
Downloads and installation are simulated; no installed app is replaced.
On macOS/Linux, **Open Release & Downloads** opens the official release URL;
the simulated version is fictional and its GitHub page may not exist. Windows
preview progress appears in the taskbar on Windows or the Dock on macOS; Linux
has no native progress indicator. **Help → Check for Updates…** reopens a
postponed installation. There are no automatic background update checks.

**Open Example Solution** opens disposable local data for real save checks.
Without a prepared Generator environment, the development frontend still starts.
If the Generator `.venv` is missing or cannot load DataM8, update simulation
works and this action
shows the setup instruction: `uv sync --frozen --all-extras` in
`submodules/datam8-generator`. Opening other solutions uses real persistence;
use copies when experimenting.

Closing the simulation stops its backend and local server and removes its
profile/example. Quitting or restarting the parent development app also closes
its simulation. Vite remains the parent's shared server on port 4320.
Packaged apps and browser mode expose no developer panel or simulation actions.
Environment flags cannot enable these actions in packaged apps. The previous
`dev:desktop:updates` launcher has been replaced by this in-app entry point.

For automated developer-panel, isolation and save-barrier checks:

```sh
npm run test:desktop:updates:ui
```

This test starts a normal development app and opens the simulation through its
menu and frontend button. It requires the prepared Generator environment for
real save checks and records diagnostics under `artifacts/desktop-update-ui-results`.
Linux needs Xvfb and Electron libraries; use
`xvfb-run -a npm run test:desktop:updates:ui`. Existing Vite on port 4320 is reused;
the test only stops a server it started itself. The internal
`DATAM8_DEVELOPER_TEST_DEBUG=1` enables loopback debugger connections for this test
in development; it grants no simulation access in packaged apps.

## Local package review

A local macOS review package uses the bundled Python runtime and ad-hoc app
signatures. Open the DMG, copy the app into a separate review directory and open
it. An additional running app may share the normal desktop profile/instance;
close that app first or launch the review copy with a disposable
`--user-data-dir` argument. No Node or host Python installation is needed.
**Help → Check for Updates…** checks actual published GitHub releases. Use the
development demo above to exercise all states before publishing a release.

Local DMGs are not GPG-verified workflow distributions. Verify local bundle
integrity with `codesign --verify --deep --strict /path/to/datam8.app`. Follow the
[installation guide](desktop-installation.md) if Gatekeeper requires approval.

## Native packaging and CI

Use `npm run build:desktop` on a suitable native host for local packaging.
The launcher directly starts Vite and the compilation-aware Electron watcher;
there is no second npm launcher or dependency repair step.
The [release process](release.md#build-and-release-process) defines the four-target
GitHub build, signing, installed-package checks and artifact delivery. Local
packages do not count as verified signed releases. The one-time
[rollout checklist](desktop-rollout.md) covers adoption of that process on the
default branch and replacement of previous installations.
