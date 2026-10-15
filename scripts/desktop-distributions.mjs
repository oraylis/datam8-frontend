import fs from 'node:fs';
import path from 'node:path';
import { checked, files } from './mac-runtime.mjs';
const [operation, input = 'apps/desktop/release', output = 'artifacts/distributions'] = process.argv.slice(2);
const root = path.resolve(input);
const dest = path.resolve(output);
fs.mkdirSync(dest, { recursive: true });
if (operation === 'collect') {
  const names = fs.readdirSync(root).filter(name => /\.(exe|dmg|zip|AppImage|deb)$/.test(name) || (process.platform === 'win32' && (/\.blockmap$/.test(name) || /^(latest|beta|alpha)\.yml$/.test(name))));
  if (!names.some(name => /\.(exe|dmg|zip|AppImage|deb)$/.test(name))) throw new Error(`No distributions in ${root}`);
  for (const name of names) fs.copyFileSync(path.join(root, name), path.join(dest, name));
} else if (operation === 'install') {
  const results = [];
  const all = files(root);
  if (process.platform === 'darwin') {
    for (const archive of all.filter(name => /\.(zip|dmg)$/.test(name))) {
      const target = path.join(dest, path.basename(archive)); fs.mkdirSync(target, { recursive: true });
      if (archive.endsWith('.zip')) checked('ditto', ['-x', '-k', archive, target]);
      else {
        const mount = path.join(dest, 'mounted-dmg'); fs.mkdirSync(mount, { recursive: true });
        checked('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, archive]);
        try {
          const app = fs.readdirSync(mount).find(name => name.endsWith('.app'));
          if (!app) throw new Error('DMG contains no application');
          checked('ditto', [path.join(mount, app), path.join(target, app)]);
        } finally { checked('hdiutil', ['detach', mount]); }
      }
      const app = fs.readdirSync(target).find(name => name.endsWith('.app'));
      if (!app) throw new Error('Archive contains no application');
      const appRoot = path.join(target, app);
      const executable = files(path.join(appRoot, 'Contents', 'MacOS')).find(name => path.basename(name) === 'datam8');
      if (!executable) throw new Error('macOS launcher missing');
      results.push({ format: path.extname(archive), executable, appRoot, runtimeRoot: path.join(appRoot, 'Contents', 'Resources', 'python-runtime') });
    }
    if (results.length !== 2) throw new Error('Both DMG and ZIP must be tested');
  } else if (process.platform === 'win32') {
    const installers = all.filter(name => name.endsWith('.exe'));
    if (installers.length !== 1) throw new Error('Expected exactly one NSIS installer');
    const installed = path.join(dest, 'DataM8 Installed');
    const script = `$p=Start-Process -FilePath $env:DATAM8_INSTALLER -ArgumentList @('/S',('/D='+$env:DATAM8_INSTALL_DIR)) -Wait -PassThru; if ($p.ExitCode -ne 0) { throw ('NSIS failed '+$p.ExitCode) }`;
    checked('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { env: { ...process.env, DATAM8_INSTALLER: installers[0], DATAM8_INSTALL_DIR: installed } });
    const executable = path.join(installed, 'datam8.exe');
    if (!fs.existsSync(executable)) throw new Error('Installed Windows launcher missing');
    results.push({ format: 'nsis', executable, appRoot: installed, runtimeRoot: path.join(installed, 'resources', 'python-runtime') });
  } else {
    const deb = all.filter(name => name.endsWith('.deb')); const images = all.filter(name => name.endsWith('.AppImage'));
    if (deb.length !== 1 || images.length !== 1) throw new Error('Both DEB and AppImage must be tested');
    checked('sudo', ['apt-get', 'install', '-y', deb[0]], { stdio: 'inherit' });
    const installed = '/opt/DataM8';
    results.push({ format: 'deb', executable: path.join(installed, 'datam8'), appRoot: installed, runtimeRoot: path.join(installed, 'resources', 'python-runtime') });
    fs.chmodSync(images[0], 0o755);
    checked(images[0], ['--appimage-extract'], { cwd: dest, stdio: ['ignore', 'ignore', 'pipe'] });
    const imageRoot = path.join(dest, 'squashfs-root');
    results.push({ format: 'AppImage', executable: images[0], appRoot: imageRoot, runtimeRoot: path.join(imageRoot, 'resources', 'python-runtime') });
  }
  fs.writeFileSync(path.join(dest, 'installed.json'), JSON.stringify(results, null, 2));
} else if (operation === 'uninstall') {
  const installed = JSON.parse(fs.readFileSync(path.join(dest, 'installed.json'), 'utf8'));
  if (process.platform === 'win32') {
    const uninstaller = files(installed[0].appRoot).find(name => /uninstall.*\.exe$/i.test(path.basename(name)));
    if (!uninstaller) throw new Error('NSIS uninstaller missing');
    checked(uninstaller, ['/S'], { stdio: 'inherit' });
    for (let attempt = 0; attempt < 60 && fs.existsSync(installed[0].executable); attempt++) await new Promise(resolve => setTimeout(resolve, 500));
    if (fs.existsSync(installed[0].executable)) throw new Error('NSIS uninstall did not remove the installed application');
  } else if (process.platform === 'linux') {
    checked('sudo', ['apt-get', 'remove', '-y', 'datam8'], { stdio: 'inherit' });
    const deb = installed.find(item => item.format === 'deb');
    if (fs.existsSync(deb.executable)) throw new Error('DEB uninstall did not remove the installed application');
  }
} else throw new Error('Expected collect/install/uninstall');
