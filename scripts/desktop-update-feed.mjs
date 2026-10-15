import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
export function createUpdateFeed(root, getRelease) {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (getRelease && url.pathname.startsWith('/releases')) {
      const release = getRelease();
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(url.pathname.includes('/tags/') ? release : release ? [release] : []));
      return;
    }
    let name;
    try { name = path.basename(decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)); }
    catch { response.writeHead(400); response.end(); return; }
    const file = path.join(root, name);
    if (!name || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Length', fs.statSync(file).size);
    fs.createReadStream(file).on('error', error => response.destroy(error)).pipe(response);
  });
}
