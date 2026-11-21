import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaultyStorage, runScenarios, storageScenarios, checkMigration, formatReport } from '../src/index.js';
import { loadPreferences } from '../examples/preferences.js';
test('Storage semantics: strings, missing keys, ordering, removal and clear', () => {
  const s = createFaultyStorage();
  assert.equal(s.getItem('absent'), null);
  s.setItem(1, 42); s.setItem('empty', ''); s.setItem('__proto__', 'safe');
  assert.equal(s.length, 3); assert.equal(s.getItem(1), '42'); assert.equal(s.getItem('empty'), '');
  assert.equal(s.key(0), '1'); assert.equal(s.key(99), null);
  s.setItem(1, 'updated'); assert.equal(s.key(0), '1');
  assert.equal(s.snapshot().__proto__, 'safe');
  s.removeItem('empty'); assert.equal(s.length, 2);
  s.clear(); assert.deepEqual(s.snapshot(), {});
});
test('faults count only matching keys, fail before mutation and recover', () => {
  const s = createFaultyStorage({initial:{a:'old'}, faults:[{operation:'setItem',key:'a',at:2,times:1,error:'QuotaExceededError'}]});
  s.setItem('b','other'); s.setItem('a','first');
  assert.throws(()=>s.setItem('a','lost'),{name:'QuotaExceededError'});
  assert.equal(s.getItem('a'),'first'); s.setItem('a','third');
  assert.equal(s.getItem('a'),'third');
  assert.equal(s.operations().filter(x=>x.outcome==='error').length,1);
  s.reset(); assert.deepEqual(s.snapshot(),{a:'old'}); assert.deepEqual(s.operations(),[]);
  s.setItem('a','first'); assert.throws(()=>s.setItem('a','lost'));
});
test('read, length, key, delete and clear can fail without mutation', () => {
  for (const operation of ['getItem','length','key','removeItem','clear']) {
    const s=createFaultyStorage({initial:{a:'1'},faults:[{operation,error:'SecurityError'}]});
    assert.throws(()=>operation==='length'?s.length:s[operation]('a'),{name:'SecurityError'});
    assert.deepEqual(s.snapshot(),{a:'1'});
  }
});
test('overlapping rule counters advance even when another rule throws',()=>{
  const s=createFaultyStorage({faults:[{operation:'getItem',times:1,error:'SecurityError'},{operation:'getItem',at:2,times:1,error:'UnknownError'}]});
  assert.throws(()=>s.getItem('x'),{name:'SecurityError'}); assert.throws(()=>s.getItem('x'),{name:'UnknownError'}); assert.equal(s.getItem('x'),null);
});
test('snapshots and operation logs do not expose mutable internal state',()=>{
  const s=createFaultyStorage({initial:{a:'1'}}); s.getItem('a');
  s.snapshot().a='bad'; s.operations()[0].operation='clear';
  assert.equal(s.getItem('a'),'1'); assert.equal(s.operations()[0].operation,'getItem');
});
test('invalid options fail early',()=>{
  for(const options of [{initial:{a:1}},{faults:[{operation:'getItem',error:'Nope'}]},{faults:[{operation:'setItem',error:'SecurityError',at:0}]},{faults:[{operation:'clear',error:'SecurityError',times:-1}]}]) assert.throws(()=>createFaultyStorage(options),TypeError);
});
test('runner isolates scenarios and captures async failures',async()=>{
  const r=await runScenarios([{name:'first'},{name:'second'}],async(s,c)=>{
    assert.equal(s.length,0); s.setItem('x','1'); if(c.name==='first')throw new Error('intentional');
  });
  assert.equal(r.failed,1); assert.equal(r.passed,false); assert.equal(r.results[1].passed,true);
  assert.match(formatReport(r),/FAIL first: intentional/);
});
test('real recovery function survives standard scenarios and preserves migrated preference',async()=>{
  const scenarios=storageScenarios('preferences',{oldValue:{version:1,dark:true}});
  const r=await runScenarios(scenarios,(s,c)=>assert.deepEqual(loadPreferences(s),{version:2,theme:['old-version','quota-exceeded'].includes(c.name)?'dark':'light'}));
  assert.equal(r.failed,0);
});
test('migration checks validity, idempotence, preservation, and fixture isolation',async()=>{
  const fixtures=[{name:'v1',value:{version:1,name:'Ada'}}];
  const good=await checkMigration({fixtures,migrate:v=>({...v,version:2}),validate:v=>v.version===2,preserve:v=>v.name});
  assert.equal(good.passed,true); assert.equal(fixtures[0].value.version,1);
  const bad=await checkMigration({fixtures,migrate:v=>({...v,version:v.version+1}),validate:()=>true});
  assert.match(bad.results[0].error.message,/idempotent/);
  const loss=await checkMigration({fixtures,migrate:v=>({...v,name:'lost',version:2}),validate:()=>true,preserve:v=>v.name});
  assert.match(loss.results[0].error.message,/preserved/);
  const invalid=await checkMigration({fixtures,migrate:v=>v,validate:()=>false});
  assert.match(invalid.results[0].error.message,/validation/);
});

test('quota scenario reaches the failed migration write while retaining old data',async()=>{
 const scenario=storageScenarios('preferences',{oldValue:{version:1,dark:true}}).find(x=>x.name==='quota-exceeded');
 const s=createFaultyStorage(scenario);
 assert.deepEqual(loadPreferences(s),{version:2,theme:'dark'});
 assert.equal(JSON.parse(s.snapshot().preferences).version,1);
 assert.equal(s.operations().some(x=>x.operation==='setItem' && x.error==='QuotaExceededError'),true);
});
test('empty suites are configuration errors, not false green reports',async()=>{
 await assert.rejects(runScenarios([],()=>{}),TypeError);
 await assert.rejects(checkMigration({fixtures:[],migrate:x=>x,validate:()=>true}),TypeError);
});
