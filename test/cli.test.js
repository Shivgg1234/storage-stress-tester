import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const exec=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
test('CLI help, usage errors, JSON and passing suite',()=>{
 assert.equal(exec('--help').status,0); assert.equal(exec().status,2);
 assert.equal(exec('--bad').status,2); assert.equal(exec('missing.mjs').status,2);
 const r = exec(
  fileURLToPath(new URL('../examples/scenarios.mjs', import.meta.url)),
  '--json'
);
});
test('CLI returns exit 1 for assertion failure and 2 for malformed configuration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'storage-crash-'));
 try {
 const file=join(dir,'suite.mjs');
 writeFileSync(file,"export const scenarios=[{name:'broken'}]; export function run(){throw new Error('boom')}");
 const result=exec(file); assert.equal(result.status,1); assert.match(result.stdout,/boom/);
 writeFileSync(file,'export const scenarios = null;'); assert.equal(exec(file).status,2);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
