# Agent Solution Lifecycle Playbook

## Zweck
Dieses Dokument definiert einen vollstaendigen, agent-tauglichen Lifecycle fuer DataM8-Solutions:
- Aufbau einer neuen Solution
- Modellierung aus Datenquellen
- laufende Pflege/Synchronisierung
- Validierung, Governance, Generierung

Dabei werden bestehende CLI-Kommandos genutzt und um wenige Orchestrator-Kommandos ergaenzt, ohne Business-Logik zu duplizieren.

## 1. Voraussetzungen

### 1.1 Laufzeit
- Python 3.12+
- `uv`
- Zugriff auf `datam8` ueber:
  - `uv run --project <generator-repo> datam8 ...`

### 1.2 Umgebungsvariablen
```powershell
$generator = "C:\...\datam8-neon\submodules\datam8-generator"
$solution  = "C:\...\my-solution\MySolution.dm8s"
$env:DATAM8_PLUGIN_DIR = "C:\Users\<user>\AppData\Roaming\DataM8 Neon\plugins"
# alternativ fuer Dev: auf einen lokalen Plugin-Ordner setzen
```

### 1.3 JSON-Uebergabe-Regel (wichtig fuer Agenten)
- Bei komplexen Payloads immer `@file` statt Inline-JSON verwenden.
- UTF-8 ohne BOM bevorzugen.

## 2. Lifecycle Commands (Endzustand)

### 2.1 Bestehende Commands (bereits verfuegbar)

#### Solution
- `datam8 solution new-project`
- `datam8 solution inspect|info|full|validate`

#### Base und Konfiguration
- `datam8 base list|get|save|set|patch|delete`
- `datam8 secret available|list|refs|get|set|delete|clear`
- `datam8 plugin list|reload|install|enable|disable|uninstall|info|verify`
- `datam8 connector list|ui-schema|validate-connection|test|browse|fetch-metadata`

#### Model
- `datam8 model list|get|create|save|set|patch|validate|delete|move|duplicate|folder-rename|edit`
- `datam8 model folder-metadata get|save|delete`
- `datam8 script list|get|save|rename|delete`

#### Datenquellen-Sync
- `datam8 datasource list-tables|table-metadata|virtual-table-metadata`
- `datam8 datasource usages|refresh-preview|refresh-apply`

#### Qualitaet und Build
- `datam8 index regenerate|validate|show`
- `datam8 validate`
- `datam8 generate`

### 2.2 Neue Orchestrator-Commands (zu implementieren)

#### A) `datam8 model create-from-source`
Erzeugt Entity aus Source-Metadaten in einem Flow.

```bash
datam8 model create-from-source \
  --data-source AdventureWorks \
  --schema SalesLT \
  --table SalesOrderDetail \
  --zone Stage \
  --folder Sales \
  --name SalesOrder1 \
  --solution "$solution" \
  --json
```

Apply:
```bash
... --apply
```

#### B) `datam8 model sync-from-source`
Synchronisiert bestehende Entity gegen externe Metadaten.

```bash
datam8 model sync-from-source \
  --entity Model/010-Stage/Sales/SalesOrder1.json \
  --source-index 0 \
  --solution "$solution" \
  --json
```

Apply (selektiv):
```bash
... --apply --apply-changes NEW_COLUMN,TYPE_CHANGED,NULLABILITY_CHANGED
```

#### C) `datam8 model scaffold-batch`
Bulk-Scaffold mehrerer Tabellen.

```bash
datam8 model scaffold-batch \
  --data-source AdventureWorks \
  --inputs @tables.json \
  --solution "$solution" \
  --json
```

Apply:
```bash
... --apply
```

#### D) `datam8 solution doctor`
Vorabpruefung fuer agentische Ausfuehrung.

```bash
datam8 solution doctor --solution "$solution" --check all --json
```

#### E) Optional: `datam8 solution bootstrap`
Schneller Erstaufbau inkl. Base-Templates.

```bash
datam8 solution bootstrap --name Demo --root C:\work\demo --profile sqlserver --apply --json
```

## 3. Vollstaendiger Lifecycle (Runbook)

### Phase 0: Diagnose
1. `datam8 solution doctor --solution ... --check all --json`
2. `datam8 connector list --json`
3. Bei Bedarf Secrets setzen:
   - `datam8 secret set <dataSource> <key> <value> --solution ... --json`

### Phase 1: Solution initialisieren
1. `datam8 solution new-project ... --json`
2. Base-Entitaeten anpassen:
   - `datam8 base get DataSources --solution ... --json`
   - `datam8 base save DataSources @DataSources.json --solution ... --json`
3. `datam8 index regenerate --solution ... --json`

### Phase 2: Modell aufbauen
1. Einzeltabelle:
   - `datam8 model create-from-source ... --json`
   - `... --apply`
2. Batch:
   - `datam8 model scaffold-batch --inputs @tables.json --json`
   - `... --apply`
3. Optional manuelle Ergaenzungen:
   - `datam8 model patch <entity> @patch.json --solution ... --json`

### Phase 3: Laufende Pflege
1. Aenderungen erkennen:
   - `datam8 datasource usages <dataSource> --solution ... --json`
   - `datam8 datasource refresh-preview ... --json`
2. Gezielt anwenden:
   - `datam8 model sync-from-source ... --json`
   - `... --apply`
3. Umstrukturierung:
   - `datam8 model move|duplicate|folder-rename ... --json`

### Phase 4: Qualitaetssicherung
1. `datam8 solution validate --solution ... --json`
2. `datam8 validate --solution ... --json`
3. `datam8 index validate --solution ... --json`

### Phase 5: Generierung
1. `datam8 generate <target> --solution ... --json`
2. Artefakte pruefen und ggf. erneut synchronisieren.

## 4. Implementierungsplan (ohne Redundanz)

### 4.1 Architekturprinzip
- Neue Commands sind reine Orchestratoren.
- Fachlogik bleibt in/unter:
  - `core/schema_refresh.py`
  - `core/workspace_service.py`
  - `core/connectors/resolve.py`
  - `core/workspace_io.py`

### 4.2 Interne Refactors
1. Extrahiere aus `datasource refresh-apply` wiederverwendbare Funktionen:
   - Mapping/Attribute-Aktualisierung
   - Change-Typ-Filterung
2. Fuege `core/workflows/` hinzu:
   - `create_from_source_workflow(...)`
   - `sync_from_source_workflow(...)`
   - `scaffold_batch_workflow(...)`
   - `solution_doctor_workflow(...)`
3. CLI-Adapter in `cmd/model.py` und `cmd/solution.py`.

### 4.3 Defaults
- Preview-by-default
- Schreibzugriffe nur mit `--apply`
- `--if-exists` default `fail`
- Stabile Fehlercodes und JSON-Struktur

## 5. API und Interface-Definition fuer Agenten

### 5.1 Einheitliches JSON-Ergebnis
```json
{
  "status": "preview|applied|partial|error",
  "traceId": "uuid",
  "actionsPlanned": 1,
  "actionsApplied": 0,
  "artifacts": [],
  "errors": []
}
```

### 5.2 Fehlercodes (Mindestmenge)
- `connector_not_found`
- `dependency_missing`
- `table_not_found`
- `entity_exists`
- `invalid_zone`
- `invalid_input_json`
- `solution_not_found`
- `validation_failed`

## 6. Testmatrix

### 6.1 Unit
- Zone-Resolver (`Stage -> 010-Stage`)
- `if-exists` Verhalten
- JSON-Input-Validierung
- Fehlercode-Mapping

### 6.2 Integration
- `create-from-source` preview/apply happy path
- falsches Schema/Tabelle
- fehlender Connector/Dependencies
- `sync-from-source` mit selektiven Change-Typen
- `scaffold-batch` partial success

### 6.3 E2E (Pflicht)
- CLI Input -> Connector Metadata -> Entity erzeugt -> Mapping/Attributes gesetzt -> `validate` + `index validate` gruen

## 7. Definition of Done (vollumfaenglich)

Ein Lifecycle gilt als vollumfaenglich erfuellt, wenn:
1. Neue Solution ohne manuelles JSON-Handediting lauffaehig aufgebaut werden kann.
2. Neue Entities aus Quellen mit 1 Command erzeugt werden koennen.
3. Schemaaenderungen selektiv und reproduzierbar synchronisiert werden koennen.
4. Validation/Index/Generate vollstaendig ueber CLI abbildbar sind.
5. Alle neuen Orchestrator-Commands agent-stabile JSON-Ausgaben liefern.
6. Keine duplizierte Business-Logik gegenueber bestehenden Core-Funktionen eingefuehrt wurde.

## 8. Beispiel: Natural Language -> Command

Intent:
> "Lies die Tabelle SalesOrderDetail aus SalesLT in AdventureWorks und erstelle Stage/Sales/SalesOrder1."

Mapping:
```bash
datam8 model create-from-source \
  --data-source AdventureWorks \
  --schema SalesLT \
  --table SalesOrderDetail \
  --zone Stage \
  --folder Sales \
  --name SalesOrder1 \
  --solution "$solution" \
  --apply \
  --json
```
