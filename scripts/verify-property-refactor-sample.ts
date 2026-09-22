import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert';
import { detectBaseType, normalizeFolderPath } from '../apps/web/src/features/model/model-utils.ts';
import { diffPropertyChanges, diffPropertyValueChanges, createPropertyRefactorPayload } from '../apps/web/src/features/model/refactor/propertyRefactor.ts';
import { buildPropertyScopeTargetIndex, type PropertyRefactorScopeTarget } from '../apps/web/src/features/model/refactor/propertyRefactorScopes.ts';
import {
  applyPropertyRefactorToBaseEntities,
  applyPropertyRefactorToFolderEntities,
  applyPropertyRefactorToModelEntities,
} from '../apps/web/src/features/model/refactor/applyPropertyRefactor.ts';

type BaseEntity = { name: string; relPath: string; content: any; locator?: string };
type ModelEntity = { name: string; relPath: string; content: any; locator?: string };
type FolderEntity = { name: string; relPath: string; folderPath: string; content: any; locator?: string };
type State = { root: string; baseEntities: BaseEntity[]; modelEntities: ModelEntity[]; folderEntities: FolderEntity[] };

type PendingAction = { payload: any; targets: PropertyRefactorScopeTarget[] };

const SOURCE = 'C:/Users/f.kayser/Projects/ORAYLIS/Automation/Repos/datam8-sample-solution';
const TMP_ROOT = 'C:/Users/f.kayser/Projects/ORAYLIS/Automation/Repos/datam8-frontend/.tmp/refactor-sample-check';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

async function ensureCleanDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(src: string, dst: string) {
  await fs.cp(src, dst, { recursive: true, force: true });
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

function toRel(root: string, file: string) {
  return path.relative(root, file).split(path.sep).join('/');
}

async function loadState(root: string): Promise<State> {
  const files = await walk(root);
  const baseEntities: BaseEntity[] = [];
  const modelEntities: ModelEntity[] = [];
  const folderEntities: FolderEntity[] = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.json')) continue;
    const relPath = toRel(root, file);
    if (!(relPath.startsWith('Base/') || relPath.startsWith('Model/'))) continue;
    const raw = await fs.readFile(file, 'utf8');
    const content = JSON.parse(raw);

    if (relPath.startsWith('Base/')) {
      baseEntities.push({
        name: path.basename(relPath, '.json'),
        relPath,
        locator: '',
        content,
      });
      continue;
    }

    if (path.basename(relPath).toLowerCase() === '.properties.json') {
      const folderPath = normalizeFolderPath(path.dirname(relPath).replace(/^Model\/?/i, ''));
      folderEntities.push({
        name: content?.name || path.basename(path.dirname(relPath)),
        relPath,
        folderPath,
        locator: '',
        content,
      });
      continue;
    }

    modelEntities.push({
      name: content?.name || path.basename(relPath, '.json'),
      relPath,
      locator: '',
      content,
    });
  }

  return { root, baseEntities, modelEntities, folderEntities };
}

async function persistState(state: State) {
  for (const entry of state.baseEntities) {
    await fs.writeFile(path.join(state.root, entry.relPath), JSON.stringify(entry.content, null, 2) + '\n', 'utf8');
  }
  for (const entry of state.modelEntities) {
    await fs.writeFile(path.join(state.root, entry.relPath), JSON.stringify(entry.content, null, 2) + '\n', 'utf8');
  }
  for (const entry of state.folderEntities) {
    await fs.writeFile(path.join(state.root, entry.relPath), JSON.stringify(entry.content, null, 2) + '\n', 'utf8');
  }
}

function uniqueTargets(targets: PropertyRefactorScopeTarget[]): PropertyRefactorScopeTarget[] {
  return Array.from(new Set(targets));
}

function getPropertiesEntry(state: State): BaseEntity {
  const entry = state.baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === 'properties');
  if (!entry) throw new Error('Properties base entity not found');
  return entry;
}

function getPropertyValuesEntry(state: State): BaseEntity {
  const entry = state.baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === 'propertyValues');
  if (!entry) throw new Error('PropertyValues base entity not found');
  return entry;
}

function collectActionsForSave(
  detected: string,
  previousContent: any,
  updatedContent: any,
  currentPropertyScopeIndex: Map<string, PropertyRefactorScopeTarget[]>,
): PendingAction[] {
  const actions: PendingAction[] = [];

  const push = (
    payload: any,
    propertyName: string,
    opts?: { includePropertyValuesTarget?: boolean; scopeIndex?: Map<string, PropertyRefactorScopeTarget[]> },
  ) => {
    const index = opts?.scopeIndex || currentPropertyScopeIndex;
    const targets = uniqueTargets([
      ...(index.get(propertyName) || []),
      ...(opts?.includePropertyValuesTarget ? (['propertyValues'] as PropertyRefactorScopeTarget[]) : []),
    ]);
    if (targets.length === 0) return;
    actions.push({ payload, targets });
  };

  if (detected === 'properties') {
    const previousIndex = buildPropertyScopeTargetIndex(previousContent);
    const diff = diffPropertyChanges(previousContent, updatedContent);
    diff.propertyRenames.forEach((rename) =>
      push({ propertyRenames: [rename] }, rename.oldName, {
        includePropertyValuesTarget: true,
        scopeIndex: previousIndex,
      }),
    );
    diff.deletedProperties.forEach((name) =>
      push({ deletedProperties: [name] }, name, {
        includePropertyValuesTarget: true,
        scopeIndex: previousIndex,
      }),
    );
  }

  if (detected === 'propertyValues') {
    const diff = diffPropertyValueChanges(previousContent, updatedContent);
    diff.valueRenames.forEach((rename) => push({ valueRenames: [rename] }, rename.property));
    diff.deletedValues.forEach((deletedValue) => push({ deletedValues: [deletedValue] }, deletedValue.property));
    diff.valueMoves.forEach((move) => push({ valueMoves: [move] }, move.oldProperty));
  }

  const deduped: PendingAction[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    const payload = createPropertyRefactorPayload(action.payload);
    if (!payload) continue;
    const key = `${JSON.stringify(payload)}::${action.targets.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ payload, targets: action.targets });
  }
  return deduped;
}

function runRefactorAction(state: State, action: PendingAction) {
  const targetSet = new Set(action.targets);
  const baseTargets = action.targets.filter((t) => t !== 'entity' && t !== 'folder');

  if (targetSet.has('entity')) {
    const modelResult = applyPropertyRefactorToModelEntities(state.modelEntities as any, action.payload);
    const byRel = new Map(modelResult.updatedEntities.map((e: any) => [e.relPath, e]));
    state.modelEntities = state.modelEntities.map((e) => byRel.get(e.relPath) || e);
  }

  if (targetSet.has('folder')) {
    const folderResult = applyPropertyRefactorToFolderEntities(state.folderEntities as any, action.payload);
    const byFolder = new Map(folderResult.updatedEntities.map((e: any) => [normalizeFolderPath(e.folderPath || ''), e]));
    state.folderEntities = state.folderEntities.map((e) => byFolder.get(normalizeFolderPath(e.folderPath || '')) || e);
  }

  if (baseTargets.length > 0) {
    const baseResult = applyPropertyRefactorToBaseEntities(state.baseEntities as any, action.payload, baseTargets as any);
    const byRel = new Map(baseResult.updatedEntities.map((e: any) => [e.relPath, e]));
    state.baseEntities = state.baseEntities.map((e) => byRel.get(e.relPath) || e);
  }
}

function ensureCoverage(state: State) {
  const model = state.modelEntities[0];
  if (model) {
    const props = Array.isArray(model.content?.properties) ? model.content.properties : [];
    if (!props.some((p: any) => p?.property === 'jobs' && p?.value === 'daily')) {
      model.content.properties = [...props, { property: 'jobs', value: 'daily' }];
    }
  }

  const folder = state.folderEntities[0];
  if (folder) {
    if (!Array.isArray(folder.content?.properties)) folder.content.properties = [];
    const props = folder.content.properties;
    if (!props.some((p: any) => p?.property === 'jobs' && p?.value === 'daily')) {
      folder.content.properties = [...props, { property: 'jobs', value: 'daily' }];
    }
  }

  const dsBase = state.baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === 'dataSources');
  if (dsBase && Array.isArray(dsBase.content?.dataSources) && dsBase.content.dataSources.length > 0) {
    const first = dsBase.content.dataSources[0];
    const props = Array.isArray(first?.properties) ? first.properties : [];
    if (!props.some((p: any) => p?.property === 'jobs' && p?.value === 'daily')) {
      first.properties = [...props, { property: 'jobs', value: 'daily' }];
    }
  }
}

function countAssignments(state: State, property: string, value?: string) {
  let model = 0;
  let folder = 0;
  let base = 0;

  const match = (p: any) => {
    if (!p || typeof p !== 'object') return false;
    if (`${p.property ?? ''}` !== property) return false;
    if (value !== undefined) return `${p.value ?? ''}` === value;
    return true;
  };

  for (const e of state.modelEntities) {
    const c = e.content || {};
    const top = Array.isArray(c.properties) ? c.properties : [];
    model += top.filter(match).length;
    const attrs = Array.isArray(c.attributes) ? c.attributes : [];
    for (const a of attrs) model += (Array.isArray(a?.properties) ? a.properties : []).filter(match).length;
    const sources = Array.isArray(c.sources) ? c.sources : [];
    for (const s of sources) {
      model += (Array.isArray(s?.properties) ? s.properties : []).filter(match).length;
      const mappings = Array.isArray(s?.mapping) ? s.mapping : [];
      for (const m of mappings) model += (Array.isArray(m?.properties) ? m.properties : []).filter(match).length;
    }
    const transforms = Array.isArray(c.transformations) ? c.transformations : [];
    for (const t of transforms) model += (Array.isArray(t?.properties) ? t.properties : []).filter(match).length;
  }

  for (const f of state.folderEntities) {
    const c = f.content || {};
    const meta = (typeof c.name === 'string' || Array.isArray(c.properties))
      ? c
      : (Array.isArray(c.folders) && c.folders[0] ? c.folders[0] : {});
    folder += (Array.isArray(meta?.properties) ? meta.properties : []).filter(match).length;
  }

  for (const b of state.baseEntities) {
    const type = detectBaseType(b.content, b.relPath).type;
    if (type === 'propertyValues') {
      const rows = Array.isArray(b.content?.propertyValues) ? b.content.propertyValues : [];
      for (const row of rows) {
        base += (Array.isArray(row?.properties) ? row.properties : []).filter(match).length;
      }
      continue;
    }
    const list = Array.isArray((b.content as any)?.[type]) ? (b.content as any)[type] : [];
    for (const row of list) {
      base += (Array.isArray(row?.properties) ? row.properties : []).filter(match).length;
      if (Array.isArray(row?.dataModules)) {
        for (const m of row.dataModules) {
          base += (Array.isArray(m?.properties) ? m.properties : []).filter(match).length;
        }
      }
    }
  }

  return { model, folder, base, total: model + folder + base };
}

function countPropertyValueRows(state: State, property: string, name?: string) {
  const pv = getPropertyValuesEntry(state);
  const rows = Array.isArray(pv.content?.propertyValues) ? pv.content.propertyValues : [];
  return rows.filter((r: any) => `${r?.property ?? ''}` === property && (name === undefined || `${r?.name ?? ''}` === name)).length;
}

async function runScenario(name: string, mutate: (state: State) => void, verify: (state: State) => void) {
  const root = path.join(TMP_ROOT, name);
  await ensureCleanDir(root);
  await copyDir(SOURCE, root);

  const state = await loadState(root);
  ensureCoverage(state);

  const propertiesBefore = clone(getPropertiesEntry(state).content);
  const propertyValuesBefore = clone(getPropertyValuesEntry(state).content);

  mutate(state);

  const propertiesAfter = clone(getPropertiesEntry(state).content);
  const propertyValuesAfter = clone(getPropertyValuesEntry(state).content);

  const scopeIndexCurrent = buildPropertyScopeTargetIndex(propertiesAfter);
  const actions: PendingAction[] = [
    ...collectActionsForSave('properties', propertiesBefore, propertiesAfter, scopeIndexCurrent),
    ...collectActionsForSave('propertyValues', propertyValuesBefore, propertyValuesAfter, scopeIndexCurrent),
  ];

  for (const action of actions) {
    runRefactorAction(state, action);
  }

  await persistState(state);
  verify(state);
  console.log(`[ok] ${name}`);
}

async function main() {
  await ensureCleanDir(TMP_ROOT);

  await runScenario(
    '01-property-rename',
    (state) => {
      const p = getPropertiesEntry(state);
      const row = p.content.properties.find((x: any) => x?.name === 'schedules');
      if (!row) throw new Error('schedules property missing');
      row.name = 'schedules1';
    },
    (state) => {
      assert.equal(countAssignments(state, 'schedules').total, 0, 'old property assignments must be gone');
      assert.ok(countAssignments(state, 'schedules1').total > 0, 'new property assignments must exist');
      assert.equal(countPropertyValueRows(state, 'schedules'), 0, 'old propertyValues rows must be gone');
      assert.ok(countPropertyValueRows(state, 'schedules1') > 0, 'new propertyValues rows must exist');
    },
  );

  await runScenario(
    '02-property-delete',
    (state) => {
      const p = getPropertiesEntry(state);
      p.content.properties = p.content.properties.filter((x: any) => x?.name !== 'jobs');
    },
    (state) => {
      const counts = countAssignments(state, 'jobs');
      assert.equal(counts.model + counts.folder, 0, 'deleted property assignments in model/folder must be gone');
      assert.equal(countPropertyValueRows(state, 'jobs'), 0, 'deleted propertyValues rows must be gone');
    },
  );

  await runScenario(
    '03-value-rename-name',
    (state) => {
      const pv = getPropertyValuesEntry(state);
      const row = pv.content.propertyValues.find((x: any) => x?.property === 'jobs' && x?.name === 'daily');
      if (!row) throw new Error('jobs/daily missing');
      row.name = 'daily_new';
    },
    (state) => {
      const oldCounts = countAssignments(state, 'jobs', 'daily');
      const newCounts = countAssignments(state, 'jobs', 'daily_new');
      assert.equal(oldCounts.model + oldCounts.folder, 0, 'old value refs in model/folder must be gone');
      assert.ok(newCounts.model + newCounts.folder > 0, 'new value refs in model/folder must exist');
    },
  );

  await runScenario(
    '04-value-rename-property-move',
    (state) => {
      const pv = getPropertyValuesEntry(state);
      const row = pv.content.propertyValues.find((x: any) => x?.property === 'jobs' && x?.name === 'weekly');
      if (!row) throw new Error('jobs/weekly missing');
      row.property = 'schedules';
    },
    (state) => {
      const oldCounts = countAssignments(state, 'jobs', 'weekly');
      const newCounts = countAssignments(state, 'schedules', 'weekly');
      assert.equal(oldCounts.model + oldCounts.folder, 0, 'old move source refs in model/folder must be gone');
      assert.ok(newCounts.model + newCounts.folder > 0, 'move target refs in model/folder must exist');
    },
  );

  await runScenario(
    '05-value-delete',
    (state) => {
      const pv = getPropertyValuesEntry(state);
      pv.content.propertyValues = pv.content.propertyValues.filter((x: any) => !(x?.property === 'jobs' && x?.name === 'daily'));
    },
    (state) => {
      const counts = countAssignments(state, 'jobs', 'daily');
      assert.equal(counts.model + counts.folder, 0, 'deleted value refs in model/folder must be gone');
    },
  );

  console.log(`\\nAll scenarios passed. Output snapshots: ${TMP_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
