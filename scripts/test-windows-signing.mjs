import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { verifyWindows } from './desktop-verification.mjs';
if (process.platform !== 'win32') throw new Error('Windows signing regression requires a native Windows runner');
const sign = createRequire(import.meta.url)('./sign-windows.cjs');
const thumbprint = process.env.DATAM8_WINDOWS_THUMBPRINT;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'DataM8 signing regression '));
const target = path.join(temp, 'catalogued-powershell.exe');
try {
  // This Windows binary can have a catalog signature. Only its disposable copy
  // is signed, so the regression also checks that catalog trust cannot mask a
  // missing/invalid embedded DataM8 signature.
  fs.copyFileSync(path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), target);
  await sign({ path: target });
  verifyWindows(temp, thumbprint);
  assert.throws(() => verifyWindows(temp, '0'.repeat(40)), /Unexpected embedded publisher/);
  const signed = fs.readFileSync(target);
  const changed = Buffer.from(signed); changed[0x40] ^= 1;
  fs.writeFileSync(target, changed);
  assert.throws(() => verifyWindows(temp, thumbprint), /failed/i);
  const stripped = Buffer.from(signed);
  const optional = stripped.readUInt32LE(0x3c) + 24;
  const table = optional + (stripped.readUInt16LE(optional) === 0x20b ? 112 : 96) + 32;
  const offset = stripped.readUInt32LE(table);
  assert.ok(offset, 'Signed fixture must have an embedded certificate table');
  stripped.fill(0, table, table + 8);
  fs.writeFileSync(target, stripped.subarray(0, offset));
  assert.throws(() => verifyWindows(temp, thumbprint), /failed/i);
  console.log('Embedded signing, expected identity, timestamp and tampered/unsigned negative cases passed');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
