import fs from 'node:fs';
import path from 'node:path';
export function desktopFixture(root, name) {
  const dir = path.join(root, name);
  fs.cpSync(path.join(import.meta.dirname, 'fixtures/job_solution'), dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'Model', 'Core'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Base', 'Zones.json'), JSON.stringify({ type: 'zones', zones: [{ name: 'Core', targetName: 'core', displayName: 'Core' }] }));
  fs.writeFileSync(path.join(dir, 'Base', 'AttributeTypes.json'), JSON.stringify({ type: 'attributeTypes', attributeTypes: [{ name: 'ID', displayName: 'Identifier', defaultType: 'int' }] }));
  fs.writeFileSync(path.join(dir, 'Base', 'DataTypes.json'), JSON.stringify({ type: 'dataTypes', dataTypes: [{ name: 'int', displayName: 'Integer', targets: {} }] }));
  fs.writeFileSync(path.join(dir, 'Model', 'Core', 'Customer.json'), JSON.stringify({ id: 1, name: 'Customer', displayName: 'Customer', description: 'Packaged fixture', attributes: [{ ordinalNumber: 1, name: 'CustomerId', attributeType: 'ID', dataType: { type: 'int', nullable: false }, history: 'SCD0', dateAdded: '2026-01-01T00:00:00Z' }], sources: [], transformations: [], relationships: [] }, null, 2));
  return path.join(dir, 'TestSolution.dm8s');
}
