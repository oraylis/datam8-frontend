const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
function releaseFixture(version = '2.1.0-beta.99', body = '# Changes\n\n- Safer desktop updates\n- Python runtime fixes\n\n[Full details](https://github.com/oraylis/datam8-frontend)') {
  const packages = ['x64', 'arm64'].flatMap(arch => ['dmg', 'zip'].map(ext => `DataM8-${version}-mac-${arch}.${ext}`));
  packages.push(`DataM8-${version}.AppImage`, `datam8_${version}_amd64.deb`);
  return { tag_name: `v${version}`, draft: false, prerelease: version.includes('-'), body,
    assets: [...packages, ...packages.map(name => `${name}.asc`), `DataM8 Setup ${version}.exe`, 'latest.yml', 'beta.yml', 'SHA256SUMS', 'SHA256SUMS.asc', 'datam8-release-public.asc'].map(name => ({ name })) };
}
function demoReleaseServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const scenario = url.searchParams.get('scenario') || 'available';
    if (scenario === 'network-error' || (scenario === 'notes-error' && url.pathname.includes('/tags/'))) { response.writeHead(503); response.end(); return; }
    let body = scenario === 'long' ? '# Long release notes\n' + Array.from({ length: 35 }, (_, i) => `- Change ${i + 1}: **Markdown** and [a link](https://example.com)`).join('\n') : undefined;
    if (scenario === 'empty') body = '';
    const release = releaseFixture(scenario === 'current' ? '1.0.0' : undefined, body);
    if (scenario === 'incompatible') release.assets = [];
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(url.pathname.includes('/tags/') ? release : [release]));
  });
}

function desktopFixture(root, name, repoRoot) {
  const dir = path.join(root, name);
  fs.cpSync(path.join(repoRoot, 'scripts/fixtures/job_solution'), dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'Model', 'Core'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Base', 'Zones.json'), JSON.stringify({ type: 'zones', zones: [{ name: 'Core', targetName: 'core', displayName: 'Core' }] }));
  fs.writeFileSync(path.join(dir, 'Base', 'AttributeTypes.json'), JSON.stringify({ type: 'attributeTypes', attributeTypes: [{ name: 'ID', displayName: 'Identifier', defaultType: 'int' }] }));
  fs.writeFileSync(path.join(dir, 'Base', 'DataTypes.json'), JSON.stringify({ type: 'dataTypes', dataTypes: [{ name: 'int', displayName: 'Integer', targets: {} }] }));
  fs.writeFileSync(path.join(dir, 'Model', 'Core', 'Customer.json'), JSON.stringify({ id: 1, name: 'Customer', displayName: 'Customer', description: 'Packaged fixture', attributes: [{ ordinalNumber: 1, name: 'CustomerId', attributeType: 'ID', dataType: { type: 'int', nullable: false }, history: 'SCD0', dateAdded: '2026-01-01T00:00:00Z' }], sources: [], transformations: [], relationships: [] }, null, 2));
  return path.join(dir, 'TestSolution.dm8s');
}

module.exports = { releaseFixture, demoReleaseServer, desktopFixture };
