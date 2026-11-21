import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { installStorageFaults } from '../src/browser.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
test('real browser: pre-boot seed, reload, isolation, quota and denied access',async()=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Storage test</title><script>try {window.bootValue=localStorage.getItem("prefs")}catch(e){window.bootError=e.name}</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try {
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const context=await browser.newContext();
 await installStorageFaults(context,{origin,initial:{prefs:'old'},faults:[{operation:'setItem',key:'blocked',error:'QuotaExceededError'}]});
 const page=await context.newPage(); await page.goto(origin);
 assert.equal(await page.evaluate(()=>window.bootValue),'old');
 assert.equal(await page.evaluate(()=>{try{localStorage.setItem('blocked','bad')}catch(e){return e.name}}),'QuotaExceededError');
 assert.equal(await page.evaluate(()=>localStorage.getItem('blocked')),null);
 await page.evaluate(()=>localStorage.setItem('prefs','new')); await page.reload();
 assert.equal(await page.evaluate(()=>window.bootValue),'new');
 assert.equal(await page.evaluate(()=>{sessionStorage.setItem('blocked','ok');return sessionStorage.getItem('blocked')}),'ok');
 await context.close();
 const isolated=await browser.newContext(); const clean=await isolated.newPage(); await clean.goto(origin);
 assert.equal(await clean.evaluate(()=>window.bootValue),null); await isolated.close();
 const denied=await browser.newContext(); await installStorageFaults(denied,{origin,denyAccess:true});
 const deniedPage=await denied.newPage(); await deniedPage.goto(origin);
 assert.equal(await deniedPage.evaluate(()=>window.bootError),'SecurityError'); await denied.close();
 const session=await browser.newContext(); await installStorageFaults(session,{origin,area:'sessionStorage',initial:{prefs:'session'},faults:[{operation:'getItem',key:'prefs',error:'SecurityError'}]});
 const sessionPage=await session.newPage(); await sessionPage.goto(origin);
 assert.equal(await sessionPage.evaluate(()=>{try{sessionStorage.getItem('prefs')}catch(e){return e.name}}),'SecurityError');
 assert.equal(await sessionPage.evaluate(()=>localStorage.getItem('prefs')),null); await session.close();
 } finally {await browser?.close(); await new Promise(r=>server.close(r));}
});
