import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { verifyBackendGate } from './ci-gates.mjs';

test('backend gate rejects failed generation and missing or incorrect output', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 gate regression '));
  let status = 500;
  const server = http.createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Origin': 'http://localhost:4320' }); response.end();
    } else if (request.url === '/health') { response.writeHead(204); response.end(); }
    else if (request.url === '/config') { response.writeHead(401); response.end(); }
    else { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ target: 'test' })); }
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const verify = () => verifyBackendGate(`http://127.0.0.1:${server.address().port}`, path.join(temp, 'Test.dm8s'), 'test-token');
    for (status of [400, 404, 500]) await assert.rejects(verify(), /Generation failed/);
    status = 200;
    await assert.rejects(verify(), /expected hello.txt content/);
    const output = path.join(temp, 'Output/generated/hello.txt'); fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, 'incorrect'); await assert.rejects(verify(), /expected hello.txt content/);
    fs.writeFileSync(output, 'Hello world\n'); await verify();
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
