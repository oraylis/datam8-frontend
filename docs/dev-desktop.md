# Desktop Development

Frontend starts a local FastAPI backend process via Python module execution.

## Backend start contract

```bash
python -u -m datam8 serve --host 127.0.0.1 --port 4318 --token <random> --solution <path> --workspace-switch
```

Readiness line:

```json
{"type":"ready","baseUrl":"http://127.0.0.1:<PORT>","version":"<cliVersion>"}
```

The launcher waits for readiness from its own child process before checking HTTP
health. Python runs unbuffered so the readiness line reaches the launcher promptly.
The first solution starts the process on demand with a shared 60-second startup
budget. The loading dialog allows cancelling startup and waits for owned process
termination before another attempt. Subsequent solutions use the
[workspace switching contract](../submodules/datam8-generator/docs/backend-contract.md#desktop-workspace-switching)
in the same process. Editor saves are drained first; failed opens keep the old
workspace. Changing the Python interpreter or backend module requires a restart.
Frontend **Reload** refreshes the current model, plugins and editor data without
reopening the solution or resolving the Python runtime. Runtime selection is logged
when a process actually starts, including the interpreter path and configuration
source (`DATAM8_PYTHON_PATH`, solution settings, bundled runtime or development
environment). The window's bearer token remains stable across startup retries.
An occupied backend port reports a startup error; unrelated listeners are retained.

Renderer uses root endpoints (`/config`, `/solution/*`, `/model/*`, `/model/generate`, ...), no `/api/*` and no `/jobs`.

## Dialog keyboard actions

Enter runs the main action in confirmation, Create Folder, Move, and Load Solution
dialogs. Confirmation dialogs initially focus their main button, including Delete.
Tab to Cancel and press Enter, or use Escape, to cancel. Input dialogs retain their
input focus; text areas, selections, and the folder picker's search keep their own
Enter behavior. Shared `DialogContent` provides an optional `onEnter` callback;
callers use the same handler and enabled conditions as their main button.

## Runtime configuration

**View > Reload** (`Ctrl/Cmd+R`) runs the same solution/model and plugin refresh
as the frontend Reload button, keeping the renderer and backend running.
**View > Force Reload** (`Ctrl/Cmd+Shift+R`) restarts the backend and renderer and
reopens the active solution. Both use the frontend's existing confirmation when
there are unsaved changes; cancelling leaves the session running.

Opening malformed JSON or an unrecognized solution structure reports a load
error and retains any open solution. Only a recognized V1 structure opens the
migration wizard.

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

The launcher starts Vite through its JavaScript API in a separate process. After
`server.listen()` succeeds, that process reports readiness over Node IPC; the
launcher also checks the HTTP response before starting the desktop watcher.
Console formatting does not affect readiness. Port 4320 remains strict, and
startup failures are reported immediately. On shutdown, the launcher closes the
desktop watcher first, then asks Vite to close its server over IPC.

The Manrope UI font is bundled with the web assets. Desktop startup does not
depend on Google Fonts or an internet connection. Its OFL license is shipped
in `web/licenses/Manrope-OFL.txt` inside the packaged app.
The launcher checks the local Fontsource CSS entries before starting. If they
are missing after a branch switch, run `npm ci` in the repository root; the
launcher reports that setup step instead of opening a broken editor.

## Developer tools and update simulation

`npm run test:desktop:workspaces` exercises editor autosave, workspace switching
with the same backend PID, failure recovery, stale requests, generation and
shutdown using disposable local fixtures and the prepared Generator environment.

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

To verify the actual `npm run dev:desktop` launcher and local Manrope assets, stop
any running development launcher and run `npm run test:desktop:dev`. This check
starts Electron with a temporary profile, verifies the editor and all four font
weights, and closes its processes. Diagnostics are written to
`artifacts/desktop-dev-results`. On Linux, run it under `xvfb-run -a`.

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

The runtime build installs dependencies into clean `site-packages`, without
inheriting packages from the build interpreter. `scripts/prepare-python-runtime.py`
removes development-only components and package tests, bundles the standard
library and an explicit allowlist of pure Python dependencies into bytecode ZIPs,
and precompiles remaining external packages. Native libraries, package metadata,
licenses, certificates and required package resources are retained. All existing
connector extras remain installed. `runtime-manifest.json` records the reduction.
Windows uses a relative `._pth` file to isolate imports from registry and host
Python paths. Archives are imported directly without extraction at application
start. On macOS/Linux the preparation also removes Python headers, build config,
manuals, unused launchers and Tcl/Tk scripts/extensions. Shared native libraries
are conservatively retained.
PyCryptodome's `Crypto/SelfTest` and C/C++ development inputs are removed on all
platforms. The pure-package allowlist also bundles Polars' Python frontend,
Pydantic and resource-aware helpers; their separate native engines stay on disk.
Python sources remain inside the ZIPs for introspection.

### Verify an existing runtime

Run against the runtime attached to an installed app or a native build:

```sh
npm run test:runtime:packaged -- --runtime-root "/absolute/path/python-runtime" --report artifacts/runtime-test-results/local.json
```

This command uses only that runtime's interpreter and installed Python packages;
it does not build, install dependencies or require the Generator checkout/.venv.
Use the host matching the runtime's OS and architecture. If automatic discovery
finds multiple runtimes, select one explicitly. `--python`, if supplied, must
resolve inside the selected runtime. A ZIP layout or runtime manifest is not
required for the functional checks.

The suite runs `init`, `migrate v1-to-v2`, `generate` (including a custom Python
payload and Jinja template), and `serve` with desktop workspace authentication.
It checks loaded/persisted state, source-preserving migration, CSV/ODCS imports,
custom plugin resources/reload, native Parquet IO and builtin connector loading.
It also checks Polars execution, Pydantic/Polars source introspection, JSON Schema
resources and encrypted-keyring entry-point metadata after ZIP import.
Solutions are disposable local fixtures; no cloud connections are exercised.
Content hashes and file/link inventories verify that running the tests does not
change the runtime. Results distinguish passes, failures and skips; failures
return a nonzero exit code. Reports must be written outside the runtime.

Secret backend availability and a temporary encrypted-file secret roundtrip are
always checked on every platform, without modifying the user's keyring. This
exercises the crypto backend after removing its bundled self-tests.
Add `--secrets-roundtrip` on a
disposable test account to exercise set/read/overwrite/delete using uniquely
named test entries that are cleaned afterward. Windows uses Credential Vault;
macOS uses the configured keyring; Linux uses a temporary encrypted file backend.
The installed-package CI requires this roundtrip. Local packaged tests can opt in
with `DATAM8_RUNTIME_TEST_SECRETS=1`; otherwise this case is reported as skipped.

The `Python runtime and desktop acceptance` workflow runs on pushes to
`codex/python-runtime-slimming-all-platforms` and supports manual dispatch once
registered on the default branch. It first builds/tests only the runtime on
Windows x64, macOS ARM64/x64 and Linux x64, without an Electron build or release
credentials. After all four pass, it runs the existing unsigned desktop matrix.
Both stages upload diagnostics even on failure.

Each runtime report counts regular files, bytes and symlinks separately and
compares regular files with the published v2.0.1 runtimes (Windows x64: 8,698;
macOS ARM64: 4,945; macOS x64: 4,963; Linux x64: 11,697). Dependency and interpreter
versions can differ from that release. The preparation manifest records the
pruning/archive stages; the test report contains the final inventory including
the manifest itself. A 60% reduction is a comparison target, not a functional
gate or a reason to remove required dependencies.

The build runs the same suite after relocating the runtime and records results
under `artifacts/runtime-test-results`. Installed-package tests run it again on
each distribution, then exercise desktop persistence/generation plus the real
create/migrate/plugin-import IPC bridges and verify bundle integrity afterward.

Use `npm run build:desktop` on a suitable native host for local packaging.
The launcher directly starts Vite and the compilation-aware Electron watcher;
there is no second npm launcher or dependency repair step.
The [release process](release.md#build-and-release-process) defines the four-target
GitHub build, signing, installed-package checks and artifact delivery. Local
packages do not count as verified signed releases. The one-time
[rollout checklist](desktop-rollout.md) covers adoption of that process on the
default branch and replacement of previous installations.
