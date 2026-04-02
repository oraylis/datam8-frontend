# DataM8 v2 Cutover Plan (Generator + Neon)

Status: historical implementation plan (reference)
Owner: cross-repo (generator + neon)
Last updated: 2026-02-10

> Note
> This document is kept as a historical cross-repo execution plan.
> The canonical current backend contract is `submodules/datam8-generator/docs/backend-contract.md`.
> Where this plan and current implementation differ, treat the backend contract + current code as source of truth.

## Referenzbranch-Kontext (verbindlich)

1. Dieser Plan ist aus dem Review-Kontext `datam8-generator: feature/v2` (Referenzbasis) gegen `feature/v2-cli` (Änderungsbranch) entstanden.
2. Für Umsetzung und Review gilt im Generator standardmäßig:
   - Soll-/Baseline: `feature/v2`
   - Ist/Umsetzung: der jeweilige Arbeitsbranch mit Cutover-Änderungen
3. Wenn kein anderer Branch explizit genannt ist, sind alle Aussagen im Plan gegen die Baseline `feature/v2` zu prüfen.
4. Für `datam8-neon` ist die zugehörige Generator-Baseline derselbe Contract-Stand (aus `feature/v2`-Sicht); Abweichungen davon müssen im PR explizit dokumentiert werden.

## 1. Zielbild

1. Es gibt genau **eine** CLI-Basis im Generator (`src/datam8/app.py` + `src/datam8/cmd/*`).
2. Jobs/SSE werden vollständig entfernt, alle Backend-Operationen laufen synchron/blockierend.
3. Die Legacy-API (`/api/*`) wird vollständig entfernt.
4. Neue HTTP-Schnittstellen laufen unter Root-Pfaden (ohne `/api`-Prefix).
5. Token-Auth bleibt erhalten (außer `GET /health`, `GET /version`).
6. EXE/PyInstaller ist nicht mehr der Standard-Distributionsweg; Standard ist Wheel + embedded Python Runtime.
7. Codequalität wird auf Must-have-Niveau gebracht (Strukturen wiederverwenden, Duplikate raus, Typed Responses, Docstrings, Header, Dead Code raus).

## 2. Scope

In Scope:
1. `datam8-generator`: Contract, CLI, API, Services, Tests, Docs, Packaging-Strategie.
2. `datam8-neon`: API-Client-Migration, Job/SSE-Entfernung, Desktop-Backend-Start auf embedded Python + wheel, Tests/Docs.

Out of Scope:
1. Neue Fachfeatures über den bestehenden Editor-/Generator-Umfang hinaus.
2. Parallelbetrieb alter und neuer API für längere Zeit.

## 3. Harte Entscheidungen (bereits festgelegt)

1. Root-Pfade statt `/api/*`.
2. Keine Jobs/SSE mehr.
3. Token bleibt.
4. Echte CLI-Erweiterung auf alter Basis, keine zweite CLI-Architektur.
5. EXE nicht Standard, Wheel + embedded Python ist Standard.

## 4. Contract-Änderungen (Breaking)

## 4.1 Entfernt

1. `POST /jobs`
2. `GET /jobs/{id}`
3. `POST /jobs/{id}/cancel`
4. `GET /jobs/{id}/events`
5. Gesamter `/api/*`-Pfadraum

## 4.2 Neu / umgezogen (Root)

1. `GET /health`
2. `GET /version`
3. `GET /config`
4. `GET /solution/inspect`
5. `GET /solution`
6. `GET /solution/full`
7. `POST /solution/new-project`
8. `POST /migration/v1-to-v2`
9. `GET|POST|DELETE /model/entities`
10. `POST /model/entities/move`
11. `POST /model/folder/rename`
12. `GET|POST /model/function/source`
13. `POST /model/function/rename`
14. `GET|POST|DELETE /base/entities`
15. `GET /fs/list`
16. `POST /index/regenerate`
17. `GET /index/show`
18. `GET /index/validate`
19. `POST /refactor/properties`
20. `POST /refactor/keys`
21. `POST /refactor/values`
22. `POST /refactor/entity-id`
23. `GET /search/entities`
24. `GET /search/text`
25. `GET /connectors`
26. `GET /connectors/{connectorId}/ui-schema`
27. `POST /connectors/{connectorId}/validate-connection`
28. `GET /plugins`
29. `POST /plugins/reload`
30. `POST /plugins/install`
31. `POST /plugins/enable`
32. `POST /plugins/disable`
33. `POST /plugins/uninstall`
34. `POST /datasources/{dataSourceId}/list-tables`
35. `POST /sources/{name}/tables`
36. `POST /datasources/{dataSourceId}/table-metadata`
37. `POST /http/datasources/{dataSourceId}/virtual-table-metadata`
38. `GET /datasources/{dataSourceId}/usages`
39. `POST /datasources/{dataSourceId}/refresh-external-schemas/preview`
40. `POST /datasources/{dataSourceId}/refresh-external-schemas/apply`
41. `GET /secrets/available`
42. `GET /secrets/runtime`
43. `PUT /secrets/runtime`
44. `DELETE /secrets/runtime`
45. `DELETE /secrets/runtime/key`
46. `POST /generate` (synchron/blockierend als Ersatz für generate-job flow)

Hinweis: Falls einzelne Endpunkte inhaltlich reduziert werden, muss das explizit im Contract dokumentiert werden.

## 5. Umsetzungsplan datam8-generator

## Phase G0: Vorbereitende Dokumentation

1. `docs/backend-contract.md` zuerst auf den finalen Stand bringen.
2. `docs/jobs.md` entfernen oder als „removed in v2 cutover" markieren.
3. `docs/server.md`, `README.md`, `AGENTS.md` auf neues Modell synchronisieren.

Definition of Done G0:
1. Alle entfernten/neu gemappten Endpunkte dokumentiert.
2. Auth-Regel klar dokumentiert.
3. Keine SSE-/Jobs-Referenzen mehr als aktive Funktionalität.

## Phase G1: CLI-Konsolidierung (echte Erweiterung)

1. `src/datam8/app.py` wieder als zentrale Root-CLI herstellen.
2. `@app.callback()` in `app.py` mit globalen Optionen (solution/json/quiet/verbose/log-file/lock-timeout/no-lock/version).
3. Neue Command-Gruppen aus `src/datam8/cli/main.py` in modulare `src/datam8/cmd/*.py` aufteilen.
4. `app.py` registriert alle Gruppen via `app.add_typer(...)`.
5. `src/datam8/cli/main.py` löschen oder auf minimalen Kompatibilitätsstub ohne Business-Commands reduzieren.
6. `src/datam8/__main__.py` auf `datam8.app:main` ausrichten.
7. `pyinstaller/datam8_entrypoint.py` später nur optional behalten oder entfernen (siehe EXE-Phase).

Definition of Done G1:
1. Es existiert keine zweite CLI-Logikebene.
2. `datam8 --help` zeigt alte + neue Befehle unter einem Root.

## Phase G2: Jobs/SSE entfernen

1. Entfernen:
   - `src/datam8/core/jobs/manager.py`
   - `src/datam8/core/jobs/models.py`
   - `src/datam8/api/routes/jobs.py`
2. `src/datam8/api/app.py` von jobs-router bereinigen.
3. `src/datam8/cmd/serve.py` vereinfachen:
   - kein JobManager-Start/Stop
   - Readiness-JSON unverändert beibehalten

Definition of Done G2:
1. Kein `/jobs*` Endpoint mehr vorhanden.
2. Kein SSE-Output mehr im Backend.

## Phase G3: Legacy-API entfernen + Root-API aufbauen

1. `src/datam8/api/routes/legacy_api.py` entfernen.
2. Neue Router-Dateien nach Domäne anlegen (`config`, `solution`, `model`, `base`, `script`, `index`, `refactor`, `search`, `connectors`, `plugins`, `datasources`, `secrets`, `generate`).
3. `src/datam8/api/app.py` nur mit neuen Routern verdrahten.
4. Einheitliche Fehlerhülle und Statuscodes beibehalten.

Definition of Done G3:
1. Kein `/api/*` Endpoint mehr im Server.
2. Alle benötigten Flows über Root-Endpunkte erreichbar.

## Phase G4: Vorhandene Strukturen wiederverwenden, Qualität herstellen

1. Gemeinsame Service-Schicht einführen (`src/datam8/core/services/*`), die von CLI und API gemeinsam genutzt wird.
2. Keine duplizierte Business-Logik zwischen CLI und API.
3. Dict-lastige Rückgaben bei öffentlichen API-Flows auf typed Pydantic-Response-Modelle umstellen.
4. Inline-Imports entfernen (außer technisch zwingend).
5. Duplikate konsolidieren:
   - `src/datam8/core/plugins/manager.py` vs `src/datam8/core/connectors/plugin_manager.py` auf eine Implementierung reduzieren.
6. Dead Code entfernen (inkl. ungenutzter Routen-/Manager-Reste).
7. Leere `__init__.py` entfernen, sofern nicht zwingend notwendig.
8. Public Functions/Classes mit Docstrings ausstatten.

## Zusatzregeln G4 (verbindlich)

1. Import-Hygiene:
   - Keine "God files" mit sehr langen Importblöcken.
   - Bei vielen Abhängigkeiten: in kleinere Module schneiden statt Importlisten aufzublähen.
   - Bevorzugt Modul-Imports statt dutzende funktionsweise Einzel-Imports.
2. Wiederverwendung vorhandener Basis:
   - Bestehende Basisstrukturen (`model`, `datam8_model`, `opts`, `config`, `errors`) werden bevorzugt erweitert statt neu nachgebaut.
   - Neue Klassen/Typen nur wenn bestehende Typen fachlich nachweisbar nicht passen.
3. Teststruktur:
   - API-Tests bevorzugt in-process (`create_app(...)` + TestClient/AsyncClient), nicht über externe Binärabhängigkeit.
   - Server-Readiness-Integration darf Prozessstart testen, aber über Python-Modulweg (`python -m datam8`), nicht über `datam8.exe`.
   - Keine Testvoraussetzung auf PyInstaller/EXE.
4. Testfixtures statt Inline-Strings:
   - Python-Testcode, der aktuell als String in Tests eingebettet ist, wird in echte Fixture-Dateien ausgelagert.
5. Verbot von Redefinitionen schema-generierter Typen:
   - Klassen/Modelle aus `datam8_model` (JSON-Schema-generiert) dürfen nicht in `datam8` neu definiert oder "lightweight" nachgebaut werden.
   - Wenn Erweiterung nötig ist: Composition/Wrapper/Adapter auf Basis des bestehenden Typs, keine parallele Ersatzklasse mit gleicher fachlicher Bedeutung.
   - Jede neue Typdefinition im gleichen fachlichen Bereich braucht eine kurze Begründung im PR, warum kein bestehender `datam8_model`-Typ verwendbar war.
6. File-Scan-Policy (harte Regel):
   - Keine rekursiven Vollscans (`rglob`, `glob("**/*")`) in API-Handlern oder anderen Hotpaths pro Request.
   - Dateiscans sind auf den kleinstmöglichen Teilbaum zu begrenzen (z. B. gezieltes Verzeichnis statt Solution-Root).
   - Derselbe Scan darf innerhalb eines Requests nicht mehrfach ausgeführt werden; stattdessen Ergebnis pro Request wiederverwenden.
   - Für wiederkehrende Metadaten (z. B. Index/Entity-Listen) vorhandene Service-/Index-Strukturen wiederverwenden statt neu zu scannen.
Definition of Done G4:
1. Kein bekannter doppelter Manager/Codepfad mehr.
2. API-Responses sind typed.
3. Public-API/CLI-Schicht dokumentiert.
4. Kein Nachbau schema-generierter Klassen aus `datam8_model` im Produktivcode.
5. Keine rekursiven Vollscans in Request-Hotpaths; Scananzahl ist in Integrationstests explizit gegen Regression abgesichert.

## Phase G5: Lizenzheader automatisieren

1. Skript `scripts/add_license_headers.py` anlegen.
2. Quelle: `license_file_header.txt`.
3. Idempotent für:
   - `src/datam8/**/*.py`
   - `tests/**/*.py`
   - optional `scripts/**/*.py`
4. CI-Check ergänzen, der fehlende Header blockiert.

Definition of Done G5:
1. Alle relevanten Python-Dateien besitzen Lizenzheader.
2. Wiederholte Ausführung erzeugt keine Diff-Änderungen.

## Phase G6: EXE/PyInstaller zurückstufen

1. EXE-Build aus Standardpfad entfernen (kein Pflichtartefakt).
2. `scripts/build_binaries.py`, `pyinstaller/*`, optionale build-deps nur noch optional/experimentell oder entfernen.
3. Standardpaket: wheel (`uv build`).
4. Doku explizit: primärer Laufweg = embedded Python + wheel.

Definition of Done G6:
1. CI/Release ist wheel-first.
2. Kein impliziter Zwang zu `datam8(.exe)`.

## 6. Umsetzungsplan datam8-neon

## Phase N0: Contract/Mirror aktualisieren

1. `docs/backend-contract.md` im Neon-Repo auf neuen Generator-Contract spiegeln/verweisen.
2. Dokumente mit `/api`/jobs/SSE aktualisieren:
   - `README.md`
   - `AGENTS.md`
   - `docs/dev-desktop.md`
   - `docs/release.md`
   - `apps/desktop/src/README.md`

Definition of Done N0:
1. Keine aktive Dokumentation zeigt `/api/*` oder `/jobs*` als gültig.

## Phase N1: API-Pfade im Frontend migrieren

1. Alle Fetch-Calls von `/api/*` auf Root-Pfade umstellen.
2. `apps/web/src/main.tsx` Auth-Fetch-Shim: Backend-Pfaderkennung aktualisieren (ohne `/api`, ohne `/jobs`).
3. `apps/web/vite.config.ts` Proxyregeln auf neue Root-Endpunkte anpassen.
4. E2E-Mocks (`apps/web/e2e/*.spec.ts`) ebenfalls migrieren.

Definition of Done N1:
1. Keine `/api/`-Strings mehr in aktivem API-Call-Code (außer historische Notes).
2. E2E-Mocks folgen neuem Pfadraum.

## Phase N2: Jobs/SSE-Logik im UI entfernen

1. `apps/web/src/features/generator/GeneratorContext.tsx`:
   - Job-Erstellung entfernen
   - SSE-Stream-Reader entfernen
   - Cancel-Job entfernen
   - synchronen `POST /generate`-Flow einbauen
2. Weitere Stellen mit `POST /jobs` entfernen (z. B. model hooks, wizard submit flows).
3. UI-States anpassen (kein jobId/stream state mehr).

Definition of Done N2:
1. Kein UI-Code nutzt `/jobs` oder SSE.
2. Generate-Flow funktioniert synchron mit klaren Fehlerzuständen.

## Phase N3: Desktop Runtime von EXE auf embedded Python + wheel

1. `apps/desktop/src/main.ts` Backend-Resolver umbauen:
   - nicht mehr primär `datam8(.exe)`
   - stattdessen embedded Python Pfad + `-m datam8 serve`
2. Packaging-Artefakte auf Python-runtime + wheel ausrichten.
3. Env-Variablen und Fehlermeldungen anpassen (z. B. statt `DATAM8_CLI_PATH` ein runtime-orientiertes Setting).
4. Dev-Flow klar definieren (lokaler wheel install in embedded runtime oder dev runtime shim).

Definition of Done N3:
1. Desktop startet Backend ohne EXE-Pflicht.
2. Release-Pipeline baut/publisht Python-runtime + wheel-Paketweg.

## 7. Qualitätsthemen aus Feedback (Mapping)

1. „Tool im Tool“
   - Gelöst durch G1 (eine CLI-Basis).
2. „Vorhandene Basis ignoriert“
   - Gelöst durch G4 (Service-Schicht + Wiederverwendung bestehender Model/Config/Error/Options Strukturen).
3. „Duplizierter Code / Klassen doppelt“
   - Gelöst durch G4 (Dedupe, Manager-Konsolidierung).
4. „Dict statt typisierte Objekte“
   - Gelöst durch G4 (typed Response-Modelle).
5. „Subprocess im selben Package“
   - Gelöst durch G2/G4 (sync service calls, keine Jobs-Subprocess-Orchestrierung).
6. „Toter Code“
   - Gelöst durch G2/G3/G4 (jobs/legacy/remove dead modules).
7. „Scope zu groß / unnötige Komplexität“
   - Gelöst durch G2 + klare Root-API + sync flow.
8. „Lizenzheader fehlt“
   - Gelöst durch G5.
9. „Leere __init__.py“
   - Gelöst durch G4.
10. „Keine Docstrings“
   - Gelöst durch G4.
11. „Zu viele File-Scans“
   - in G4 reviewen und auf targeted lookups/caching reduzieren.
12. „Python-Code als String in Tests“
   - in G4 Tests auf Fixture-Dateien umstellen.
13. „Inline imports“
   - in G4 entfernen.
14. „Legacy vermischt mit non-legacy“
   - durch G3/G4 aufgehoben.
15. „EXE-Problematik Defender“
   - durch G6 + N3 (wheel/embedded Python default).

## 8. Test- und Abnahmeplan

## 8.1 Generator

1. Unit/Integration für neue Router und Service-Schicht.
2. Server Integration:
   - Start → Readiness JSON
   - `/health` und `/version`
   - Auth 401/200
3. Synchronous generate endpoint:
   - Output erzeugt
   - Fehlerfall liefert typed Fehlerhülle
4. Qualitätsgates:
   - `uv tool run pyright src`
   - `uv tool run ruff check src`
5. Header-Check muss sauber laufen.

6. Testserver-Policy:
   - Für API-Verhalten primär in-process App-Tests nutzen (`create_app(...)` + Client).
   - End-to-end Serverstart nur ergänzend; dabei `python -m datam8 serve` statt EXE-Aufruf.
7. Fixture-Policy:
   - Kein Python-Quellcode als langer String im Test, wenn die gleiche Aussage über Fixture-Dateien möglich ist.
## 8.2 Neon

1. API-Consumer-Tests (alle Kernflows auf Root-Pfade).
2. Generator-UI Flow ohne Jobs/SSE.
3. Desktop Start/Stop E2E mit embedded Python + wheel.
4. E2E-Suites auf neue Endpunkte aktualisiert.

## 9. Reihenfolge (ausführbar ohne Entscheidungs-Lücken)

1. G0 (Contract/Doku Generator)
2. G1 (CLI-Basis fix)
3. G2 (Jobs raus)
4. G3 (Legacy raus, Root-API rein)
5. G4 (Qualität/Dedupe/Typing/Docstrings)
6. G5 (Header automation)
7. G6 (EXE zurückstufen)
8. N0 (Neon Doku/Contract sync)
9. N1 (API Pfade Neon)
10. N2 (Jobs/SSE Neon raus)
11. N3 (embedded Python + wheel Runtime)
12. Cross-Repo Abnahme + Release

## 10. Explizite Risiken und Gegenmaßnahmen

1. Risiko: großer Breaking Cut auf einmal.
   - Maßnahme: Contract-first, danach strikt phasenweise Merge-Strategie.
2. Risiko: Neon regressions bei vielen API-Pfaden.
   - Maßnahme: zentraler API-client refactor + E2E-Update früh.
3. Risiko: Desktop-runtime Umstellung auf embedded Python.
   - Maßnahme: dedizierter N3-Strang mit smoke-tests auf Win/mac/Linux.
4. Risiko: Qualitätsumbau dauert länger.
   - Maßnahme: G4 als explizite Pflichtphase, nicht „nice to have".

## 11. Abschluss-Checkliste (Release Blocking)

1. Kein `/api/*` Endpoint mehr aktiv.
2. Kein `/jobs*` Endpoint mehr aktiv.
3. Keine SSE-Abhängigkeit mehr im Neon-Code.
4. Eine CLI-Basis in Generator, keine zweite Business-CLI.
5. Typed öffentliche API-Responses.
6. Dedupe/Dead code/Inline imports bereinigt.
7. Lizenzheader flächig und automatisch abgesichert.
8. Wheel + embedded Python als Standardpfad dokumentiert und im Build verankert.
9. Pyright + Ruff grün.
10. Cross-repo E2E grün.

## 12. Startsignal für Umsetzung

Umsetzung starten mit Verweis auf:
1. `datam8-generator/docs/plans/v2-cutover-plan.md` (kanonisch)
2. `datam8-neon/docs/plans/v2-cutover-plan.md` (Neon-Ausführung)


