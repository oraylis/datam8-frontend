import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('the builder downloader supports the updated proxy agent and NO_PROXY', async t => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'datam8-proxy-'));
  let proxied = 0, received = 0;
  const target = http.createServer((_request, response) => { received++; response.end('local artifact'); });
  const proxy = http.createServer((request, response) => {
    const targetUrl = `http://127.0.0.1:${target.address().port}/probe.zip`;
    if (request.url !== targetUrl) { response.writeHead(400).end(); return; }
    proxied++;
    const upstream = http.get(targetUrl, result => result.pipe(response));
    upstream.on('error', error => { response.statusCode = 502; response.end(error.message); });
  });
  t.after(() => {
    proxy.closeAllConnections(); target.closeAllConnections(); proxy.close(); target.close();
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('datam8-proxy-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  target.listen(0, '127.0.0.1'); await once(target, 'listening');
  proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening');
  const script = `
    const {createRequire}=require('node:module');
    const fs=require('node:fs');const path=require('node:path');
    const builderRequire=createRequire(require.resolve('app-builder-lib/package.json'));
    const get=builderRequire('@electron/get');
    const agentRequire=createRequire(builderRequire.resolve('@electron/get'));
    if(agentRequire('global-agent/package.json').version!=='4.1.3')throw Error('Wrong proxy agent');
    (async()=>{
      for(const bypass of [false,true]){
        if(bypass)global.GLOBAL_AGENT.NO_PROXY='127.0.0.1';
        const file=await get.downloadArtifact({version:'1.0.0',artifactName:'probe.zip',isGeneric:true,
          force:true,cacheRoot:path.join(process.env.TEST_ROOT,'cache'),tempDirectory:process.env.TEST_ROOT,
          unsafelyDisableChecksums:true,mirrorOptions:{resolveAssetURL:()=>process.env.TEST_URL}});
        if(fs.readFileSync(file,'utf8')!=='local artifact')throw Error('Wrong artifact');
      }
    })().catch(error=>{console.error(error);process.exitCode=1;});`;
  const child = spawn(process.execPath, ['-e', script], { cwd: path.resolve(import.meta.dirname, '..'), windowsHide: true,
    env: { ...process.env, TEST_ROOT: root, TEST_URL: `http://127.0.0.1:${target.address().port}/probe.zip`,
      ELECTRON_GET_USE_PROXY: '1', GLOBAL_AGENT_HTTP_PROXY: `http://127.0.0.1:${proxy.address().port}`,
      GLOBAL_AGENT_HTTPS_PROXY: '', GLOBAL_AGENT_NO_PROXY: '', GLOBAL_AGENT_FORCE_GLOBAL_AGENT: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const timer = setTimeout(() => child.kill(), 15_000);
  try { const [code] = await once(child, 'close'); assert.equal(code, 0, output); }
  finally { clearTimeout(timer); }
  assert.equal(proxied, 1, 'the second download must bypass the proxy');
  assert.equal(received, 2);
});
