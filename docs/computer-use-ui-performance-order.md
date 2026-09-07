# Computer-Use UI-Performancepruefung: Order-Solution

Datum: 2026-09-07

## Setup

- UI: `http://localhost:4320/` via Codex In-app Browser
- Backend: lokaler `datam8 serve` auf `127.0.0.1:4318`
- Testdaten: temporaere Kopie unter `C:\Users\f.kayser\AppData\Local\Temp\datam8-ui-perf-order-20260907-164203`
- Original-Solution blieb unveraendert.
- Die Browser-Pruefung wurde ausschliesslich mit Computer Use ausgefuehrt. Es wurden keine Playwright-UI-Tests verwendet.
- Windows-Keyring war als `keyring.backends.Windows.WinVaultKeyring` aktiviert.

## Messwerte

Die Werte sind einzelne sichtbare UI-Laeufe und dienen als Baseline, nicht als harte Grenzwerte. Die Zeit beginnt jeweils direkt vor der Computer-Use-Aktion und endet beim sichtbaren Zielzustand.

| Aktion | Zeit | Ergebnis |
| --- | ---: | --- |
| Solution erfolgreich laden | 323 ms | PASS; vollstaendiger Model Tree sichtbar |
| `order` oeffnen | 1,307 ms | PASS |
| Attributes-Ansicht mit 185 Attributen | 4,724 ms | PASS; virtuelle Liste zeigt `0-500 of 1692 items` |
| Attribute scrollen | 1,540 ms | PASS; spaete Attribute sichtbar |
| Sidebar-Filter setzen/leeren | 2,279 ms | PASS; Tree filtert sichtbar |
| Alle Attribute selektieren | 2,642 ms | PASS; Bulk Edit wird sichtbar |
| Bulk-Edit-Dialog oeffnen | 1,543 ms | PASS; 185 selektierte Items sichtbar |
| Sources-Ansicht | 758 ms | PASS |
| Relationships-Ansicht | 449 ms | PASS |
| Transformations-Ansicht | 357 ms | PASS; keine Steps in dieser Solution |
| Overview-Ansicht | 344 ms | PASS |
| Base-Scope | 872 ms | PASS |
| Base-Kategorien nacheinander oeffnen | 722-1,008 ms | PASS fuer alle 8 Kategorien |
| Data-Source-Editor `edwh-drillisch-prod` | 1,596 ms | PASS; Secret sichtbar als verfuegbar |
| Refresh-Schemas-Dialog | 2,659 ms | PASS; 10 Quellen sichtbar |
| Schema-Scan | 21,352 ms bis Review | PASS; 49 Aenderungen erkannt |
| Review-Gruppen expandieren | 1,740 ms | PASS |
| Connection-Validation | 7,413 ms | PASS; `Connection settings are valid.` |
| Import-Wizard oeffnen | 1,146 ms | PASS |
| Import-Source auswaehlen | 2,142 ms | PASS |
| Source-Locations laden | 9,589 ms | PASS; Tabellenliste sichtbar |
| Import-Target-Schritt | 2,254 ms | PASS |
| Import-Review | 2,349 ms | PASS; Namenskonflikt korrekt angezeigt |
| Import als `order_perf_import` | ca. 13,3 s | PASS |
| Reload nach Import | 2,871 ms | PASS; importierte Entity im Tree vorhanden |
| `order`/`order_article` wechseln | 1,585 / 1,170 ms | PASS |
| Sidebar aus/einblenden | 613 ms | PASS |
| Theme umschalten | 639 ms | PASS |

## Gepruefte UI-Abdeckung

### Model

- Solution Picker und Solution-Laden
- Folder-Tree expandiert und sichtbare Model-Dateien geprueft
- `order` mit 185 Attributen geoeffnet
- Attributliste bis in spaete Bereiche gescrollt
- Filter, Einzel-/Alle-Selektion und Bulk-Edit-Dialog geoeffnet
- Overview, Attributes, Sources, Relationships und Transformations geoeffnet
- Mapping-Liste mit 185 Mappings geoeffnet und wieder geschlossen
- `order`, `order_article` und importierte Entity gewechselt
- Importierte Entity gespeichert und nach Reload wiedergefunden
- Sidebar, Theme und Reload geprueft

### Base

Alle sichtbaren Base-Kategorien wurden geoeffnet und mindestens ein Editorzustand dargestellt:

- Properties
- Property Values
- Zones
- Data Types
- Data Source Types
- Data Products
- Attribute Types
- Data Sources

Dabei wurden Listen mit mehreren Items, expandierte Property-Value-Gruppen, Editorfelder, Mappingbereiche sowie Tab-Wechsel sichtbar geprueft.

### Sources und Import

- `edwh-drillisch-prod` als SQLServer-Data-Source geoeffnet
- Secret-Status: `Secret available`
- Connection-Test erfolgreich
- Refresh-Schemas-Dialog geoeffnet
- 10 Source-Entities ausgewaehlt und gescannt
- 49 Schema-Aenderungen in Review dargestellt
- Review-Gruppen expandiert
- Source-Locations mit mehreren hundert Tabellen geladen
- Preview-Zustaende sichtbar deaktiviert, weil das Plugin kein `previewData` anbietet
- `order` importiert, als `order_perf_import` umbenannt und nach Reload bestaetigt

### Generator

Die Generate-Aktion wurde ueber die UI gestartet. Sichtbarer Zustand: `Error: Generation failed. Check the generator log for details.`

Backend-Log:

```text
payload 'jobs_pii_job_lookups' threw errors during payload creation
Cannot derive PII unit alias for PII job lookups.
Expected databricks.yml catalog_name values matching
'ingest_<unit>_${bundle.target}', but found: none.
```

Klassifikation: Generator-/Solution-Konfiguration, nicht Frontend-Rendering. Die UI zeigt den Fehler an und bleibt bedienbar.

## Nicht vollstaendig durchfuehrbar

- Native Electron-Computer-Use: `cua.getState()` meldete keine native App-Oberflaeche (`apps: []`). Daher konnten Electron-only Function Create/Delete, native Dateiauswahl, Neustartpersistenz und native Bridge-Messungen nicht als bestanden markiert werden.
- Function-Editor: Die Order-Solution enthaelt keine Function-Transformationen. Ohne separate Function-Fixture konnte kein bestehender Function-Step geoeffnet werden.
- Destruktive Delete-Szenarien fuer Folder, Entity, Base-Item und Property Value wurden in diesem Lauf nicht ausgefuehrt. Dafuer ist eine erneute frische Kopie und eine explizite Bestaetigung direkt vor dem jeweiligen UI-Loeschschritt erforderlich.
- Die Schema-Review wurde nicht angewendet, damit die temporaere Performancekopie fuer die nachfolgenden Vergleiche stabil blieb. Scan und Review selbst waren erfolgreich.
- Kalt-/Warm-Wiederholungen im Umfang `3 kalt / 5 warm` wurden nicht komplett automatisiert; die oben dokumentierten Werte sind einzelne Baseline-Laeufe.

## Auffaelligkeiten

1. Beim ersten tokenisierten Browserstart erschien sichtbar `Missing Authorization header`. Der Lauf wurde anschliessend mit einem lokalen Backend ohne Auth-Token wiederholt, weil die Web-UI in diesem Modus keinen Authorization-Header an den Browser-Request injiziert.
2. Der Base-Data-Source-Editor ist bei der Browserbreite horizontal breiter als der sichtbare Viewport; ein horizontaler Scrollbalken war sichtbar. Die Felder waren erreichbar, aber nicht vollstaendig ohne horizontales Scrollen sichtbar.
3. Der Generatorfehler ist fachlich reproduzierbar und wird korrekt als Fehlermeldung im Generatorpanel angezeigt.

## Prozessbeobachtung

Eine Momentaufnahme der laufenden Entwicklungsprozesse zeigte mehrere Electron-/Node-Prozesse aus der lokalen Entwicklungsumgebung. Beispielwerte lagen bei etwa 148-294 MB Working Set fuer einzelne Electron-Prozesse und etwa 186 MB fuer den Vite-Node-Prozess. Diese Werte sind wegen parallel laufender Entwicklungsprozesse keine isolierte Renderer-Baseline und sollten fuer belastbare Vergleiche in einer bereinigten Session wiederholt werden.
