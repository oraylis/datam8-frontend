import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// Independent v1 input; absolute index paths are filled in only in a disposable copy.
export function legacyRuntimeFixture(root) {
  const dir = path.join(root, 'Legacy solution');
  const solution = path.join(dir, 'Legacy.dm8s');
  const entity = path.join(dir, 'Core', 'Sales', 'Customers', 'Customer.json');
  writeJson(solution, {
    basePath: 'Base', rawPath: 'Raw', stagingPath: 'Stage', corePath: 'Core', curatedPath: 'Curated',
    generatePath: 'Generate', diagramPath: 'Diagram', outputPath: 'Output',
    AreaTypes: { Raw: 'Raw', Stage: 'Stage', Core: 'Core', Curated: 'Curated', Diagram: 'Diagram' },
  });
  writeJson(entity, {
    type: 'core', entity: { dataProduct: 'Sales', dataModule: 'Customers', name: 'Customer',
      displayName: 'Kunden', explanation: 'Migrated runtime fixture',
      attribute: [{ name: 'CustomerId', attributeType: 'ID', dataType: 'int', history: 'SCD0' }] },
    function: { source: [] },
  });
  writeJson(path.join(dir, 'index.json'), { coreIndex: { entry: [
    { locator: '/Core/Sales/Customers/Customer', name: 'Customer', absPath: entity },
  ] } });
  writeJson(path.join(dir, 'Base', 'DataTypes.json'), { items: [{ name: 'int', displayName: 'Integer', sqlType: 'int', parquetType: 'int32' }] });
  writeJson(path.join(dir, 'Base', 'AttributeTypes.json'), { items: [{ name: 'ID', displayName: 'Identifier', defaultType: 'int' }] });
  writeJson(path.join(dir, 'Base', 'DataProducts.json'), { items: [{ name: 'Sales', displayName: 'Sales', module: [{ name: 'Customers', displayName: 'Customers' }] }] });
  writeJson(path.join(dir, 'Base', 'DataSources.json'), { items: [] });
  fs.writeFileSync(entity.replace(/\.json$/, '.py'), '# Retained migration payload\n');
  return solution;
}

export const runtimePluginManifest = {
  id: 'runtime_fixture', displayName: 'Runtime fixture', version: '1.0.0',
  entryPoint: 'runtime_fixture:RuntimeCsv', capabilities: ['metadata', 'validationConnection'],
};

export function runtimePluginFiles(marker = 'first') {
  return {
    'plugin.json': `${JSON.stringify(runtimePluginManifest)}\n`,
    '__init__.py': [
      'import json', 'from pathlib import Path',
      'from datam8.plugins.builtins.file import CsvFile',
      'from datam8_model.data_source import ConnectionProperty',
      'class RuntimeCsv(CsvFile):',
      '    @classmethod',
      '    def get_connection_properties(cls):',
      '        marker = json.loads(Path(__file__).with_name("resource.txt").read_text(encoding="utf-8"))["marker"]',
      '        return [*CsvFile.get_connection_properties(), ConnectionProperty(name="runtime_marker", type="string", required=False, default=marker)]',
      '',
    ].join('\n'),
    'resource.txt': JSON.stringify({ marker }),
  };
}

export function installRuntimePlugin(solutionDir, marker = 'first') {
  const solution = JSON.parse(fs.readFileSync(path.join(solutionDir, 'TestSolution.dm8s'), 'utf8'));
  const dir = path.join(solutionDir, solution.pluginsPath, 'runtime_fixture');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(runtimePluginFiles(marker))) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

export function runtimePluginArchive(root) {
  const file = path.join(root, 'runtime-plugin.zip');
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(runtimePluginFiles())) zip.addFile(name, Buffer.from(content));
  zip.writeZip(file);
  return file;
}
