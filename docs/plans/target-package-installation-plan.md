# Target Package Installation Plan (Generator + Neon)

Status: proposal  
Owner: cross-repo (generator + neon)  
Created: 2026-02-20  

## 1. Ziel

1. Generator-Targets sollen als ZIP-Pakete in eine bestehende Solution installierbar sein.
2. Die Installation soll analog zum Plugin-ZIP-Flow funktionieren, aber solution-lokal unter `Generate/<targetName>` landen.
3. Beim Erstellen einer neuen Solution sollen ZIPs direkt mitgegeben und nach der Projekterstellung automatisch installiert werden.
4. `generatorTargets` in der `.dm8s` muss dabei automatisch konsistent gehalten werden.

## 2. Festgelegte Entscheidungen

1. Paketformat: `targetName` wird aus dem ZIP-Inhalt abgeleitet, kein Manifest erforderlich.
2. Konfliktverhalten: Bei bestehendem Target wird nach Bestaetigung ueberschrieben.
3. New-Solution-Flow: ZIP-Upload direkt im Dialog `Create New Project`.
4. Scope v1: Nur Installation und Update (kein Entfernen, Umbenennen oder Default-Management als eigenes Feature).

## 3. In Scope / Out of Scope

In Scope:
1. Neuer Backend-Endpoint fuer Target-ZIP-Installation in eine Solution.
2. Solution-Datei-Update (`generatorTargets`) nach Installation.
3. UI-Flow fuer bestehende Solutions (`Install Target ZIP`).
4. UI-Flow fuer neue Solutions (ZIPs direkt im New-Project-Dialog).
5. API-, Unit- und E2E-Tests fuer den End-to-End-Fluss.

Out of Scope:
1. Target-Deinstallation.
2. Target-Umbenennung.
3. Separates UI fuer Default-Target-Umschaltung.
4. Globaler Target-Katalog ausserhalb der Solution.

## 4. Contract-Aenderung

Canonical zuerst aktualisieren: `submodules/datam8-generator/docs/backend-contract.md`  
Neon-Mirror danach: `docs/backend-contract.md`

Neuer Endpoint:
1. `POST /solution/targets/install`

Request:
1. `Content-Type: application/zip`
2. Query:
3. `solutionPath: string` (required)
4. `overwrite: boolean` (optional, default `false`)
5. Header optional: `x-file-name`

Response:
1. `solutionPath: string`
2. `target: { name: string, sourcePath: string, outputPath: string, isDefault: boolean }`
3. `overwritten: boolean`

Fehler:
1. `409` wenn Target existiert und `overwrite=false`.
2. `validation_error` bei ungueltigem ZIP-Aufbau oder unsicheren Pfaden.

## 5. ZIP-Regeln fuer Target-Pakete

1. ZIP muss genau einen Root-Ordner enthalten.
2. Root-Ordnername ist `targetName`.
3. Zulaessiger `targetName`: `^[a-zA-Z0-9._-]+$`
4. Keine absoluten Pfade, keine `..`-Traversal (Zip-Slip-Schutz).
5. Entpacken ausschliesslich nach `Generate/<targetName>`.

## 6. Backend-Umsetzung (datam8-generator)

Dateien:
1. `submodules/datam8-generator/src/datam8/core/workspace_io.py`
2. `submodules/datam8-generator/src/datam8/core/workspace_service.py`
3. `submodules/datam8-generator/src/datam8/api/routes/api_solution.py`
4. `submodules/datam8-generator/src/datam8/api/routes/response_models.py`
5. `submodules/datam8-generator/docs/backend-contract.md`

Implementierung:
1. In `workspace_io.py` Funktion `install_solution_target_zip(...)` ergaenzen.
2. ZIP in temp-Verzeichnis extrahieren mit Safe-Path-Pruefung (wie bei Plugin-ZIP, aber solution-lokal).
3. Root-Ordner bestimmen und `targetName` validieren.
4. Zielordner `Generate/<targetName>` bei `overwrite=true` ersetzen, sonst bei Existenz `409`.
5. `.dm8s` laden und `generatorTargets` upserten:
6. `name = targetName`
7. `sourcePath = Generate/<targetName>`
8. `outputPath = Output/<targetName>/generated`
9. `isDefault`:
10. bei erstem Target `true`
11. bei zusaetzlichem Target `false`
12. bei bestehendem Target vorhandenen `isDefault`-Wert erhalten
13. Solution atomar zurueckschreiben.
14. In `workspace_service.py` Lock-gesicherte Wrapper-Funktion ergaenzen.
15. In `api_solution.py` Route `POST /solution/targets/install` ergaenzen.
16. Response-Model fuer den Endpoint ergaenzen.

## 7. Frontend-Umsetzung (datam8-neon)

Dateien:
1. `apps/web/src/features/generator/GeneratorPanel.tsx`
2. `apps/web/src/features/generator/GeneratorContext.tsx` oder neues API-Helfermodul
3. `apps/web/src/app/NewProjectDialog.tsx`
4. `apps/web/src/features/solution/solutionLoader.ts` (nur falls Reload-Helfer gebraucht)
5. `docs/backend-contract.md`

Bestehende Solution:
1. Im Generator-Panel Button `Install Target ZIP` ergaenzen.
2. File-Input (`.zip`) einbauen.
3. Upload gegen `POST /solution/targets/install`.
4. Bei `409` Confirm anzeigen und mit `overwrite=true` wiederholen.
5. Nach Erfolg Solution neu laden, damit neues Target sofort im Select sichtbar ist.

Neue Solution:
1. In `NewProjectDialog` Mehrfachauswahl fuer ZIP-Dateien ergaenzen.
2. Ablauf:
3. `POST /solution/new-project`
4. Danach je ZIP `POST /solution/targets/install` auf die erzeugte Solution.
5. Danach `onCreated(solutionPath)`.
6. Fehlerdarstellung pro ZIP; bereits erfolgreich installierte Targets bleiben erhalten.

## 8. Testplan

Backend (pytest):
1. Erfolgsfall: ZIP installiert Target und erweitert `generatorTargets`.
2. Konfliktfall: `overwrite=false` liefert `409`.
3. Overwrite-Fall: vorhandener Target-Ordner wird ersetzt.
4. Ungueltiges ZIP: mehrere Root-Ordner.
5. Sicherheit: Zip-Slip-Versuch wird abgelehnt.

Frontend (Playwright):
1. Bestehende Solution: Install ZIP -> Request -> Reload -> Target erscheint im Selector.
2. Neue Solution: New Project + ZIPs -> `new-project` + Install-Requests -> Target auswaehlbar.

Frontend (Unit optional):
1. Retry-Logik bei `409` und Overwrite-Bestaetigung.

## 9. Akzeptanzkriterien

1. Ein Target-ZIP kann in eine geladene Solution installiert werden.
2. Nach Installation ist das Target ohne App-Neustart im Generator auswaehlbar.
3. Bei Namenskonflikt funktioniert der Overwrite-Flow mit expliziter Bestaetigung.
4. Beim Erstellen neuer Solutions koennen ZIPs direkt mit installiert werden.
5. `.dm8s` und Ordnerstruktur bleiben konsistent (`Generate/<target>`, `Output/<target>/generated`, `generatorTargets`).
6. API-, UI- und mindestens ein End-to-End-Flow sind testabgedeckt.

## 10. Umsetzungsreihenfolge

1. Backend-Contract in Generator-Doku ergaenzen.
2. Backend-Core + API implementieren.
3. Backend-Tests ergaenzen.
4. Neon-UI fuer bestehende Solution implementieren.
5. Neon-New-Project-Flow implementieren.
6. E2E-Tests ergaenzen.
7. Neon-Mirror-Doku aktualisieren.
