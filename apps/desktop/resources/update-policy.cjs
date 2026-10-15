const REPOSITORY = 'https://github.com/oraylis/datam8-frontend';
const API = 'https://api.github.com/repos/oraylis/datam8-frontend';

function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(value);
  if (!match || match[4]?.split('.').some(id => /^0\d+$/.test(id))) return null;
  return { numbers: match.slice(1, 4).map(BigInt), pre: match[4]?.split('.') || [] };
}
function compareVersions(a, b) {
  const left = parseVersion(a), right = parseVersion(b);
  if (!left || !right) throw new Error('Invalid release version');
  for (let i = 0; i < 3; i++) {
    if (left.numbers[i] !== right.numbers[i]) return left.numbers[i] > right.numbers[i] ? 1 : -1;
  }
  if (!left.pre.length || !right.pre.length) return left.pre.length === right.pre.length ? 0 : left.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i], y = right.pre[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) return BigInt(x) > BigInt(y) ? 1 : -1;
    if (nx !== ny) return nx ? -1 : 1;
    return x > y ? 1 : -1;
  }
  return 0;
}
function releaseUrl(tag) {
  if (!parseVersion(tag.replace(/^v/, ''))) throw new Error('Invalid release tag');
  return `${REPOSITORY}/releases/tag/${encodeURIComponent(tag)}`;
}
function hasPackages(release, version, platform, arch) {
  const names = new Set((release.assets || []).map(asset => asset.name));
  if (!names.has('SHA256SUMS') || !names.has('SHA256SUMS.asc') || !names.has('datam8-release-public.asc')) return false;
  if (platform === 'win32') return arch === 'x64' && (names.has(`DataM8 Setup ${version}.exe`) || names.has(`DataM8-Setup-${version}.exe`)) && names.has('latest.yml');
  const packages = platform === 'darwin' && ['x64', 'arm64'].includes(arch)
    ? [`DataM8-${version}-mac-${arch}.dmg`, `DataM8-${version}-mac-${arch}.zip`]
    : platform === 'linux' && arch === 'x64' ? [`DataM8-${version}.AppImage`, `datam8_${version}_amd64.deb`] : [];
  return packages.length > 0 && packages.every(name => names.has(name) && names.has(`${name}.asc`));
}
function selectRelease(releases, current, platform, arch) {
  const installed = parseVersion(current);
  if (!installed) throw new Error('Installed version is invalid');
  return releases.filter(release => {
    if (release.draft || typeof release.tag_name !== 'string') return false;
    const version = release.tag_name.replace(/^v/, '');
    const parsed = parseVersion(version);
    return parsed && (!parsed.pre.length || parsed.pre[0] === 'beta') && (installed.pre.length || (!release.prerelease && !parsed.pre.length)) &&
      compareVersions(version, current) > 0 && hasPackages(release, version, platform, arch);
  }).sort((a, b) => compareVersions(b.tag_name.replace(/^v/, ''), a.tag_name.replace(/^v/, '')))[0] || null;
}
function plainNotes(markdown) {
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>' };
  let text = String(markdown || '').replace(/&(?:amp|lt|gt);/g, entity => entities[entity]);
  // Repeat because removing a nested fragment can expose another HTML tag.
  let previous;
  do {
    previous = text;
    text = text.replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
      .replace(/<[^<>]*(?:>|$)/g, '');
  } while (text !== previous);
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*```[^\n]*\n?/gm, '')
    .replace(/[`*_]/g, '')
    .replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}
function notesExcerpt(markdown) {
  const text = plainNotes(markdown);
  const limited = text.split('\n').slice(0, 12).join('\n').slice(0, 1200);
  return limited.length < text.length ? `${limited}\n… (excerpt — full release notes on GitHub)` : limited;
}
function loopback(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.search || url.hash) throw new Error('Update test server must be an HTTP loopback URL');
  return url.toString().replace(/\/$/, '');
}
function requireWindowsPublisher(config) {
  // Accept only electron-builder's generated scalar or block-list shapes.
  // Missing publisherName makes electron-updater skip Authenticode verification.
  const match = /(?:^|\n)publisherName:[ \t]*([^\r\n]*)([\s\S]*)/.exec(config);
  const value = match?.[1].trim() || (/^\r?\n[ \t]+-[ \t]+([^\r\n]+)/.exec(match?.[2] || '')?.[1].trim() || '');
  if (!value || /^(null|true|false|~|\[\]|""|'')$/i.test(value) || !/^("[^"]+"|'[^']+'|[A-Za-z0-9][^#\r\n]*)$/.test(value)) throw new Error('This Windows build has no configured signing publisher. Update downloads are disabled.');
}
module.exports = { API, REPOSITORY, parseVersion, compareVersions, releaseUrl, hasPackages, selectRelease, plainNotes, notesExcerpt, loopback, requireWindowsPublisher };
