import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorageFaults } from '../src/browser.js';
test('browser validates origin and area, serializes configuration',async()=>{
 let captured;
 const context={async addInitScript(fn,arg){captured={fn,arg}}};
 await assert.rejects(installStorageFaults(context,{origin:'https://example.com/path'}),TypeError);
 await assert.rejects(installStorageFaults(context,{origin:'https://example.com',area:'bad'}),TypeError);
 await installStorageFaults(context,{origin:'https://example.com',initial:{prefs:'old'}});
 assert.equal(typeof captured.fn,'function'); assert.equal(captured.arg.initial.prefs,'old');
});

import vm from 'node:vm';
function browserSandbox(origin='https://example.com') {
  class Storage {
    #data = new Map();
    get length(){return this.#data.size}
    getItem(k){return this.#data.get(String(k))??null}
    setItem(k,v){this.#data.set(String(k),String(v))}
    removeItem(k){this.#data.delete(String(k))}
    clear(){this.#data.clear()}
    key(i){return [...this.#data.keys()][i]??null}
  }
  const sandbox={Storage,DOMException,location:{origin},localStorage:new Storage(),sessionStorage:new Storage()};
  sandbox.window=sandbox;
  return vm.createContext(sandbox);
}
async function installIn(sandbox,options){
  await installStorageFaults({async addInitScript(fn,arg){sandbox.arg=arg;vm.runInContext(`(${fn.toString()})(arg)`,sandbox)}},options);
}
test('serialized browser script seeds before use and isolates the storage area',async()=>{
 const s=browserSandbox();
 await installIn(s,{origin:'https://example.com',initial:{prefs:'old'},faults:[{operation:'setItem',key:'prefs',error:'QuotaExceededError',times:1}]});
 assert.equal(s.localStorage.getItem('prefs'),'old');
 assert.throws(()=>s.localStorage.setItem('prefs','new'),{name:'QuotaExceededError'});
 assert.equal(s.localStorage.getItem('prefs'),'old');
 s.localStorage.setItem('prefs','new'); assert.equal(s.localStorage.getItem('prefs'),'new');
 s.sessionStorage.setItem('prefs','allowed'); assert.equal(s.sessionStorage.getItem('prefs'),'allowed');
});
test('serialized script denies getter access and ignores unrelated origins',async()=>{
 const denied=browserSandbox();await installIn(denied,{origin:'https://example.com',denyAccess:true});
 assert.throws(()=>denied.localStorage,{name:'SecurityError'});
 const other=browserSandbox('https://other.example');await installIn(other,{origin:'https://example.com',initial:{a:'1'},denyAccess:true});
 assert.equal(other.localStorage.length,0);
});
test('serialized script seeds session storage and injects length failures',async()=>{
 const s=browserSandbox();await installIn(s,{origin:'https://example.com',area:'sessionStorage',initial:{a:'1'},faults:[{operation:'length',error:'SecurityError'}]});
 assert.equal(s.sessionStorage.getItem('a'),'1');assert.throws(()=>s.sessionStorage.length,{name:'SecurityError'});
 assert.equal(s.localStorage.length,0);
});
