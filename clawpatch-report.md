# clawpatch report

findings: 11

## medium: Dirty edits are never reported to the parent tab state

id: fnd_sig-feat-library-33df1f9251-e51c_0d140dea0b
category: data-loss
confidence: high
triage: confirmed-bug
status: open
feature: Node source apps/web/src/features/model/components/workspace/folder-editor (feat_library_33df1f9251)

evidence:
- apps/web/src/features/model/components/workspace/folder-editor/FolderEditor.tsx:294-318
- apps/web/src/features/model/components/workspace/folder-editor/FolderEditor.tsx:215-222

The dirty-detection effect updates only local refs/state when content differs from the baseline, but it does not call onDirtyChange(selectedFolderPath, true). The parent is told the folder is clean on initialization and successful save, and dirty only after a save failure. Normal unsaved edits therefore can leave the tab/global dirty state false, which can break Save/Save All affordances and navigation guards that rely on onDirtyChange.

recommendation:
In the dirty branch of the dirty-detection effect, call onDirtyChange?.(selectedFolderPath, true) when dirty becomes true, ideally only on transitions to avoid redundant parent updates.

test analysis:
No tests are included for this feature, and the excerpt contains no component test asserting parent dirty callbacks for ordinary field edits.

suggested regression test:
Add a FolderEditor component test that changes an input and asserts onDirtyChange is called with the selected folder path and true, then save/reset asserts false.

minimum fix scope:
Update the dirty-detection effect in FolderEditor and add focused component coverage.

repro:
Edit the folder name or description without triggering a save failure. The component sets dirtyRef.current to true, but no onDirtyChange(..., true) callback is emitted for the parent to mark the tab dirty.

## medium: Packaged builds assume a prebuilt Python runtime artifact without a build-time guard

id: fnd_sig-feat-library-16010e3057-29c0_36ff230ef8
category: build-release
confidence: high
triage: risk
status: open
feature: Node source apps/desktop/src (feat_library_16010e3057)

evidence:
- apps/desktop/package.json:41-45 (build.extraResources)
- apps/desktop/src/main.ts:243-251 (resolvePythonRuntimePath)
- apps/desktop/package.json:16-21 (scripts)

The packaged app only searches bundled python-runtime locations and returns null if none exist, while electron-builder is configured to copy ../../artifacts/python-runtime into resources. The package scripts build TypeScript and install dependencies but do not create or verify that artifact before packaging. A clean release environment can either fail packaging due to the missing extraResource or produce a package that cannot start the backend because no packaged runtime is found.

recommendation:
Add an explicit package preflight/prepack step that builds or verifies artifacts/python-runtime and fails with a clear error before electron-builder runs. Keep the runtime path expected by extraResources and resolvePackagedPythonCandidates in sync.

test analysis:
No release or packaging tests are listed, and lint/typecheck do not validate external packaging resources.

suggested regression test:
Add a release preflight test/script that asserts artifacts/python-runtime contains the platform-specific Python executable expected by resolvePackagedPythonCandidates before package:* scripts call electron-builder.

minimum fix scope:
Update apps/desktop/package.json package scripts to run a runtime preflight/build step, and optionally add a small script used by CI/release packaging.

repro:
Run a package script from a clean checkout where ../../artifacts/python-runtime has not been produced. The script has no prerequisite that builds or verifies that directory, yet packaged runtime discovery depends on it.

## medium: Release workflow uses mutable action tags while holding release write permission

id: fnd_sig-feat-config-3a72a27053-4792c_8357fce41d
category: security
confidence: high
triage: confirmed-bug
status: fixed
feature: Shell/workflow config release.yml (feat_config_3a72a27053)

evidence:
- .github/workflows/release.yml:8-9
- .github/workflows/release.yml:17-29
- .github/workflows/release.yml:240-245

The workflow grants contents: write and runs multiple actions by mutable version tags, including the third-party release publisher softprops/action-gh-release@v2. If an action tag is moved or compromised, the workflow token can be used to alter release contents or repository releases during tag builds. This is especially sensitive in a release workflow because the untrusted dependency runs in the same job context that publishes assets.

recommendation:
Pin all GitHub Actions used by this release workflow to full commit SHAs, with an update process such as Dependabot/Renovate to refresh pins. Prioritize the third-party release action and any actions in jobs that inherit contents: write, or narrow permissions per job so build jobs do not receive release-write scope.

test analysis:
No included tests or workflow checks can detect mutable upstream action tags being retargeted; this is a supply-chain control gap rather than an in-repo behavior assertion.

suggested regression test:
Add a CI policy check that rejects uses: entries in release workflows unless they are pinned to 40-character commit SHAs, with an allowlist only if explicitly justified.

minimum fix scope:
Update .github/workflows/release.yml action references to commit SHA pins and move contents: write to only the github-release job if feasible.

## medium: Windows startup can kill unrelated processes bound to the backend port

id: fnd_sig-feat-library-16010e3057-df85_b7188c6c23
category: data-loss
confidence: high
triage: confirmed-bug
status: open
feature: Node source apps/desktop/src (feat_library_16010e3057)

evidence:
- apps/desktop/src/main.ts:42-71 (cleanupStaleBackendOnPort)
- apps/desktop/src/main.ts:38-39 (BACKEND_HOST/BACKEND_PORT)

The stale-backend cleanup runs only on Windows, scans all TCP listeners for the fixed port 4318, and force-kills every matching PID with taskkill /T /F. It does not verify that the process is a datam8 backend, a child of the app, or even Python. If another local service legitimately uses port 4318, launching DataM8 can terminate it and its child process tree, risking data loss or disruption outside the app.

recommendation:
Avoid killing arbitrary listeners. Prefer using an ephemeral backend port as the project contract describes, or record the spawned backend PID and only clean up that known process. If fixed-port cleanup remains necessary, inspect process command lines/owners and require a datam8-specific marker before termination.

test analysis:
No tests are listed for this feature, and the package scripts only expose lint/typecheck. There is no Windows process-cleanup test covering an unrelated listener on the same port.

suggested regression test:
Add a unit test around the port-cleanup parser/decision logic proving non-datam8 listener entries are ignored, plus a Windows integration test that verifies only a marked stale datam8 backend can be terminated.

minimum fix scope:
Change cleanupStaleBackendOnPort and backend startup port selection/ownership tracking in apps/desktop/src/main.ts.

repro:
On Windows, start any unrelated long-running service listening on TCP port 4318, then launch the desktop app path that invokes cleanupStaleBackendOnPort(4318). The unrelated service PID will be collected from netstat output and force-killed.

## medium: Blank source-mapping input can be persisted as real data

id: fnd_sig-feat-library-23b21269bc-88ba_2780e1a6b4
category: data-loss
confidence: medium
triage: risk
status: open
feature: Node source apps/web/src/features/model/components/workspace/utils (feat_library_23b21269bc)

evidence:
- apps/web/src/features/model/components/workspace/utils/sourceNormalization.ts:18-21 (normalizeNumeric)
- apps/web/src/features/model/components/workspace/utils/sourceNormalization.ts:54-67 (normalizeMappingForSave)

The save normalizer only treats the exact empty string as an empty numeric value, so whitespace such as "   " is converted by Number(...) to 0 and then saved as charLen/precision/scale. The mapping normalizer also copies sourceName/targetName whenever they are defined, including empty strings, and then keeps the object because it has keys. A blank UI row or whitespace-only numeric edit can therefore become persisted solution data instead of being dropped, which can corrupt source mapping metadata or trigger downstream validation errors.

recommendation:
Trim string inputs before deciding whether they are empty, and only persist sourceName/targetName when their trimmed values are non-empty or otherwise intentionally valid. Apply the same empty-value policy consistently across mapping names, properties, and numeric fields.

test analysis:
No tests are included for this utility, and the package has a Vitest script but the feature metadata lists no linked tests for the normalization behavior.

suggested regression test:
Add Vitest coverage for normalizeMappingForSave that verifies blank mapping rows are removed and whitespace-only numeric fields are not normalized to 0.

minimum fix scope:
Update apps/web/src/features/model/components/workspace/utils/sourceNormalization.ts and add focused unit tests for blank, whitespace, and valid mapping inputs.

## medium: Desktop packaging does not build the bundled web app

id: fnd_sig-feat-library-2915bc999b-085e_09f78b5bd5
category: build-release
confidence: medium
triage: risk
status: open
feature: Node package @datam8/desktop (feat_library_2915bc999b)

evidence:
- apps/desktop/package.json:16-21
- apps/desktop/package.json:32-37

The desktop package scripts build only the Electron TypeScript project before invoking electron-builder, but the packaged file list pulls the renderer from ../web/dist. A clean checkout or CI job that runs an apps/desktop package script directly can therefore fail because ../web/dist is absent, or worse package stale renderer assets from an earlier build. This is a release hazard for the @datam8/desktop package entrypoint because the package manifest itself declares the web dist as part of the artifact without producing it.

recommendation:
Make the desktop packaging scripts depend on the web build explicitly, or introduce a shared prepackage script that runs the web build before electron-builder consumes ../web/dist. Also fail clearly if the renderer build output is missing.

test analysis:
No linked tests are included for this package feature, and typecheck/build of apps/desktop would not validate that ../web/dist exists or is fresh.

suggested regression test:
Add a packaging smoke test or CI step that starts from a clean workspace, removes apps/web/dist, runs the desktop package directory build command, and verifies the renderer assets are generated and included.

minimum fix scope:
apps/desktop/package.json packaging scripts or a package-level prepackage script.

## medium: Solution creation accepts path traversal in user-controlled name and subpaths

id: fnd_sig-feat-library-16010e3057-f478_a5f5b918fb
category: security
confidence: medium
triage: risk
status: open
feature: Node source apps/desktop/src (feat_library_16010e3057)

evidence:
- apps/desktop/src/main.ts:535-548 (createSolutionViaCli)
- apps/desktop/src/main.ts:554-564 (createSolutionViaCli)
- apps/desktop/src/preload.ts:41-42 (desktop.solution.createNew)

The create-new IPC payload reaches createSolutionViaCli, which only trims solutionName before using path.join(saveDir, solutionName). A name such as ../outside escapes the selected saveDir. The optional basePath and modelPath values are also written into the solution and then used with path.join(solutionDir, basePath/modelPath), allowing directory creation outside the new solution directory. Because this operation is exposed through preload IPC, malformed renderer input can cause filesystem writes in unintended locations.

recommendation:
Validate solutionName as a safe leaf name, rejecting path separators, drive-qualified paths, dot segments, and empty/whitespace-only names. Validate basePath/modelPath as relative paths confined within solutionDir by resolving and checking they remain under the solution root before writing the solution file or creating directories.

test analysis:
No tests are listed for the desktop IPC or CLI wrapper behavior, so malformed create-new payloads are not exercised.

suggested regression test:
Add tests for createSolutionViaCli or the IPC handler that reject solutionName values containing ../, absolute paths, Windows drive roots, and basePath/modelPath values resolving outside the solution directory.

minimum fix scope:
Add path confinement validation in createSolutionViaCli before fs.mkdirSync, runPythonCli, JSON writes, or optional directory creation.

repro:
Invoke desktop.solution.createNew with saveDir set to an existing directory and solutionName set to ../escaped. The computed solutionDir resolves outside saveDir, and fs.mkdirSync plus the CLI init target operate there. Similarly, pass basePath as ../outside-base to create a directory outside the solution directory.

## medium: Type-only ToastActionElement is imported as a runtime value

id: fnd_sig-feat-library-1a70e47bc6-e379_9889e20c98
category: build-release
confidence: medium
triage: risk
status: open
feature: Node source packages/ui/src/components/ui#2 (feat_library_1a70e47bc6)

evidence:
- packages/ui/src/components/ui/toaster.tsx:2-11
- packages/ui/src/components/ui/toast.tsx:112-118
- packages/ui/package.json:39-40

toast.tsx exports ToastActionElement only as a type, but toaster.tsx imports it in the value import list while only ToastProps is marked with the type modifier. In TypeScript configurations that preserve verbatim module syntax, which is common in modern TS/Vite/library packages and especially relevant with TypeScript 6, this becomes either a typecheck error or an emitted ESM import for a non-existent runtime export. That can break package builds or runtime module loading.

recommendation:
Change the import to mark ToastActionElement as type-only, for example `type ToastActionElement, type ToastProps`, or split value and type imports from `./toast`.

test analysis:
No tests are included for this source group, and the provided context only lists lint/typecheck scripts without evidence that this specific package build/import contract is covered.

suggested regression test:
Run the package typecheck/build path with verbatim module syntax enabled, or add a small compile test that imports `Toaster` from the package entrypoint.

minimum fix scope:
Update the import declaration in packages/ui/src/components/ui/toaster.tsx.

## low: Backend readiness timeout leaves process listeners attached

id: fnd_sig-feat-library-2915bc999b-59f1_2c76f42ede
category: performance
confidence: high
triage: risk
status: open
feature: Node package @datam8/desktop (feat_library_2915bc999b)

evidence:
- apps/desktop/src/main.ts:316-330
- apps/desktop/src/main.ts:394-399

waitForBackendReady installs stdout, stderr, exit, and error listeners and defines cleanup, but the timeout path resolves null without calling cleanup. The comment says this path is expected for backends that do not emit a machine-readable ready line, so the fallback health-probe path can leave listener closures and buffers attached for the lifetime of the backend process. That is avoidable retention and can also leave stale exit/error handlers observing later lifecycle events.

recommendation:
Call cleanup before resolving null in the timeout handler, matching the ready, error, and exit paths.

test analysis:
No tests are listed for backend startup behavior, and this leak only appears when readiness falls back to health probing rather than when a ready line is emitted.

suggested regression test:
Unit-test waitForBackendReady with a mock child process that never emits a ready line, advance the timeout, and assert stdout/stderr/exit/error listeners are removed after it resolves null.

minimum fix scope:
apps/desktop/src/main.ts timeout branch in waitForBackendReady.

## low: Removing a folder property does not request persistence

id: fnd_sig-feat-library-33df1f9251-257d_52ca40576d
category: data-loss
confidence: medium
triage: risk
status: open
feature: Node source apps/web/src/features/model/components/workspace/folder-editor (feat_library_33df1f9251)

evidence:
- apps/web/src/features/model/components/workspace/folder-editor/FolderEditor.tsx:424-429
- apps/web/src/features/model/components/workspace/folder-editor/FolderEditor.tsx:147-151

Adding a property explicitly calls persistAfterStateFlush after mutating state, but removing a property passes removeProperty directly and removeProperty only updates local state. Unless some external PropertyChips implementation emits one of the window events listened for by this component, removals are dirty locally but not auto-saved on the same interaction. That is inconsistent with the add flow and can lose a deletion if the parent also misses the dirty state.

recommendation:
Wrap onRemove so it calls removeProperty(removeKey) and then persistAfterStateFlush("add-item") or a clearer remove-specific persist reason.

test analysis:
No tests are included, and there is no assertion that chip removal triggers the same persistence behavior as chip addition.

suggested regression test:
Add a component test that removes a property chip and asserts the registered save path/onSave is invoked after the state flush.

minimum fix scope:
Change the onRemove handler in FolderEditor and add focused coverage for property removal persistence.

repro:
Remove a property chip. The onRemove handler only filters local state and does not call persistAfterStateFlush, so no save is requested by this component for that removal.

## low: Root package has no standard test script

id: fnd_sig-feat-config-7528cb5b98-ba386_2da7bbdc78
category: test-gap
confidence: medium
triage: test-gap
status: uncertain
feature: Project config package.json (feat_config_7528cb5b98)

evidence:
- package.json:14-33

The root scripts expose specific checks such as lint, typecheck, runtime smoke, and e2e commands, but there is no top-level `test` script. Standard npm/CI workflows that invoke `npm test` at the project root will fail with a missing-script error or skip the intended validation unless they know the project-specific command names.

recommendation:
Add a root `test` script that runs the intended validation suite, or at least a deliberate aggregate such as lint, typecheck, and the relevant test commands for this package.

test analysis:
No linked tests are included for this config feature, and the absence is in package script wiring rather than application behavior.

suggested regression test:
Add a CI/package-manager smoke check that runs `npm test` from the repository root and asserts it executes the expected validation commands.

minimum fix scope:
Update the root `package.json` scripts block to include a standard `test` script.

