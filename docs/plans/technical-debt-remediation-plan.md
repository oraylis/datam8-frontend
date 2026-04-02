# Technical Debt Remediation Plan (Neon)

Status: proposal  
Owner: Neon maintainers  
Created: 2026-02-12

## Progress

2026-02-12:
1. Completed: Phase A (partial) - `packages/datam8_cli` from active npm workspaces removed.
2. Completed: Stream 1 baseline - ESLint introduced for active workspaces, lint wired into CI workflows.
3. Completed: Phase A follow-up - stale `datam8_cli` lockfile artifacts removed.
4. Completed: Phase B/C - legacy `packages/datam8_cli` code removed from repository.
5. Completed: Stream 4 baseline - CI now runs mandatory Playwright E2E tests.
6. Completed: Stream 4 flow coverage - added stable E2E tests for Save All and Property Refactor, aligned existing connector/move specs with current UI behavior.
7. Completed: Stream 2 initial shared domain types added in `packages/types` (JSON value, connector binding, connection properties, property assignment).
8. Completed: Stream 2 connector slice - `apps/web/src/shared/connectors/connectorBinding.ts` migrated from `any` inputs to shared typed contracts.
9. Completed: Stream 2 type expansion - added shared property-refactor payload types in `packages/types`.
10. Completed: Stream 3 modularization slice - extracted deep-equal, property-refactor diff logic and base-save rename effects from `AppShell.tsx` into focused utility modules.
11. Completed: Stream 4 unit-test slice - added unit tests for extracted utility modules (deep-equal, property-refactor, base-save effects).
12. Completed: Stream 2 core utility typing slice - `model-utils.ts` converted to typed helpers (`PropertyAssignment`, typed base detection, typed sanitize/mapping helpers), reducing lint debt.
13. Completed: Stream 2 model-contract slice - `model-types.ts` now provides typed content contracts (`ModelEntityContent`, `BaseEntityContent`, `FolderContent`) and migrated `AppShell`/`Workspace` consumers away from `any` signatures.
14. Completed: Stream 3 save-orchestration slice - extracted save coordination (`waitFor*`, bulk save counting, Save/Save All flow) from `AppShell.tsx` into `useSaveCoordinator` hook.
15. Completed: Stream 3 utility deduplication slice - removed duplicate `deepEqual` implementations in editor hooks/components and switched to shared utility.
16. Completed: Stream 4 unit-test slice - added tests for save coordinator base-save counting (`useSaveCoordinator.test.ts`).
17. Completed: Stream 2 validation/normalization slice - migrated `workspace/lib/validation.ts` and `workspace/utils/sourceNormalization.ts` from `any` to `unknown` + typed record helpers.
18. Completed: Stream 3 wizard modularization slice - extracted `FolderHierarchyPicker`, `PropertyEditor`, and base-data derivations (`useWizardBaseData`) from `CreateModelEntityWizard.tsx`.
19. Completed: Stream 4 wizard-data test slice - added unit tests for extracted wizard base-data functions (`useWizardBaseData.test.ts`).
20. In progress: Stream 2 high-churn editor typing slice - wizard rows/submit (`PropertyRow`, `RelationshipRow`, `SourceRow`, `useWizardSubmit`) migrated from `any` to typed contracts; `EntityEditor` typing tightened with extracted shared entity types.
21. Completed: Stream 3 next slice - `EntityEditor.tsx` split via extracted `EntityAttributeRow` and shared `entity-editor/types.ts`, reducing `EntityEditor.tsx` to 704 lines.
22. Completed: Stream 1 critical lint slice - eliminated all `react-hooks/rules-of-hooks` findings repo-wide (0 remaining) and reduced `react-hooks/exhaustive-deps` findings from 14 to 8.

## 1. Ziel

1. Legacy-Bestandteile aus dem aktiven Neon-Laufweg entfernen.
2. Qualitäts-Gates (Lint, Tests, Typen) verbindlich machen.
3. Wartbarkeit im Web-Editor deutlich verbessern (kleinere Module, weniger `any`, weniger Duplikate).

## 2. Bereinigungsvorschlag fuer `packages/datam8_cli` (umgesetzt)

Umsetzung: `packages/datam8_cli` wurde aus dem aktiven Neon-Monorepo-Laufweg entfernt und final geloescht.

Begruendung:
1. Neon startet Backend ueber `python -m datam8 serve` aus `submodules/datam8-generator`.
2. CI-Gates verbieten `datam8_cli`/`datam8d` im Runtime-Code.
3. `packages/datam8_cli` war nur noch als Workspace-Artefakt relevant und war nicht Teil des aktiven Runtime-Pfads.

## 3. Migrationsstrategie (sicher)

### Phase A: Soft-Entkopplung (ohne Loeschung) - Status: Completed

1. Root-Workspaces explizit auf aktiv genutzte Packages begrenzen:
   - von `packages/*`
   - auf `packages/ui` und `packages/types` (optional zusaetzlich `packages/connectors`, `packages/connector-core`, falls wieder genutzt).
2. Root-Skripte (`lint`, `typecheck`, `test`) auf aktive Workspaces ausrichten.
3. `packages/datam8_cli` mit deutlichem `LEGACY`-Hinweis versehen (README + Header).
4. CI prueft weiterhin, dass Runtime-Code keine Legacy-Pfade verwendet.

Definition of Done A:
1. `npm run typecheck`/`lint`/`test` laufen ohne implizite Ausfuehrung von `packages/datam8_cli`.
2. Kein Runtime-Code referenziert `datam8_cli` oder `datam8d`.
3. Build/Dev/Desktop funktionieren unveraendert.

### Phase B: Archivierung - Status: Skipped (direkter Uebergang zu Phase C)

1. `packages/datam8_cli` nach `legacy/datam8_cli` verschieben oder in separates Archiv-Repo auslagern.
2. `.gitignore`-Eintraege und Dokumentation entsprechend anpassen.
3. `package-lock.json` aktualisieren (`npm install`) und Legacy-Workspace-Eintraege entfernen.

Definition of Done B:
1. Kein Eintrag `@datam8/datam8-cli-python` mehr im lockfile.
2. Repo-Struktur trennt aktive und historische Artefakte klar.

### Phase C: Endgueltige Entfernung (optional) - Status: Completed

1. Legacy-Ordner loeschen, falls keine regulatorischen/forensischen Gruende fuer Aufbewahrung bestehen.
2. Historische Referenz nur noch in `docs/plans/` und Changelog behalten.

Definition of Done C:
1. Kein `datam8_cli`-Code mehr im Neon-Repo.

## 4. Plan fuer Abbau weiterer technischer Schulden

### Stream 1: Quality Gates (Prioritaet hoch)

1. ESLint fuer `apps/web`, `apps/desktop`, `packages/ui`, `packages/types` einfuehren.
2. Regeln mindestens:
   - `react-hooks/exhaustive-deps`
   - `@typescript-eslint/no-explicit-any` (zunaechst als Warnung, spaeter Error)
   - `no-restricted-syntax` fuer ungewollte globale Patterns (z. B. unkontrolliertes `window.confirm`).
3. CI: `lint` als Pflichtschritt vor Build.

Definition of Done:
1. Kein Platzhalter-`lint` mehr.
2. CI scheitert bei echten Lint-Verstoessen.

### Stream 2: Typisierung (Prioritaet hoch)

1. `packages/types` von Placeholder auf echte Domain-Typen umstellen.
2. Start mit Kernmodellen:
   - `ModelEntity.content`
   - `BaseEntity.content`
   - Connector/Source/Property-Strukturen.
3. `any`-Abbau iterativ:
   - zuerst `apps/web/src/app/AppShell.tsx`
   - dann `useEntityState` und `useBaseEditorState`
   - danach Wizard/Editor-Komponenten.

Definition of Done:
1. Deutlich reduzierte `any`-Nutzung in Kernflows.
2. Keine neuen `any` ohne begruendete Ausnahme.

### Stream 3: Modularisierung (Prioritaet hoch)

1. Grosse Dateien in Feature-spezifische Hooks/Services aufteilen:
   - `AppShell.tsx`
   - `EntityEditor.tsx`
   - `CreateModelEntityWizard.tsx`
2. Zustandslogik von UI trennen:
   - Orchestrierung in Hooks
   - Darstellung in Komponenten.

Definition of Done:
1. Keine Datei > ~800 Zeilen im Kernbereich.
2. Klarere Verantwortlichkeiten pro Modul.

### Stream 4: Testabdeckung (Prioritaet hoch)

1. Kritische User-Flows als Playwright-Pflichttests:
   - Save All
   - Move Entity
   - Property Refactor
   - Connector Link/Validation/Secrets.
2. Mindestens ein E2E-Job in CI verpflichtend.
3. Unit-Tests fuer extrahierte Utility-Module (`deepEqual`-Ersatz, Diff/Normalize).

Definition of Done:
1. Kernflows sind in CI abgedeckt.
2. Regressionen in Save/Refactor/Connector werden frueh erkannt.

### Stream 5: Duplikate und Utilities (Prioritaet mittel)

1. `deepEqual` und `cloneDeep` zentralisieren (eine getestete Implementierung).
2. Wiederverwendbare Diff-/Normalization-Logik extrahieren.
3. Direkte `window.alert/confirm` durch UI-Dialog-Mechanismus ersetzen.

Definition of Done:
1. Keine mehrfachen lokalen `deepEqual`-Implementierungen.
2. Einheitliches Confirm/Error-Handling.

### Stream 6: Netzwerk-/Runtime-Haertung (Prioritaet mittel)

1. Globalen `fetch`-Shim kapseln und enger begrenzen (nur API-Client statt global patch).
2. Auth-Injektion in dediziertem HTTP-Layer abbilden.

Definition of Done:
1. Keine globale Nebenwirkung auf fremde Fetch-Calls.
2. API-Authentifizierung zentral und testbar.

## 5. Umsetzungsreihenfolge (empfohlen)

1. Phase A (Soft-Entkopplung `datam8_cli`)
2. Stream 1 (Lint + CI-Gates)
3. Stream 4 (minimale E2E-Pflichtabdeckung)
4. Stream 2 (Typisierung Kernpfade)
5. Stream 3 (Modularisierung Top-Dateien)
6. Stream 5 + 6 (Duplikate/Haertung)
7. Phase B/C (Archivierung/Entfernung `datam8_cli`)

## 6. Risiken und Gegenmassnahmen

1. Risiko: Groesserer Refactor blockiert Feature-Delivery.
   - Gegenmassnahme: kleine PR-Slices pro Stream, max. 1-2 Schwerpunkte je PR.
2. Risiko: Lockfile/Workspace-Aenderungen brechen lokale Setups.
   - Gegenmassnahme: zuerst Phase A ohne Loeschung, mit klaren Migrationshinweisen.
3. Risiko: E2E-Tests werden flaky.
   - Gegenmassnahme: stabile Test-Fixtures, retries nur gezielt, keine sleeps ohne Polling.

## 7. PR-Checkliste pro Schritt

1. Scope klar (nur Debt, keine fachliche Feature-Erweiterung).
2. CI lokal reproduzierbar (`typecheck`, `lint`, relevante Tests).
3. Docs aktualisiert (README/Plan/ggf. Troubleshooting).
4. Keine neuen Legacy-Referenzen (`datam8_cli`, `datam8d`, alte Transportpfade).
