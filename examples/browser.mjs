// npm install --save-dev playwright; npx playwright install chromium
// Start your app, then set APP_ORIGIN to its exact origin.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installStorageFaults } from '../src/browser.js';
const origin=process.env.APP_ORIGIN;
if(!origin) throw new Error('Set APP_ORIGIN, e.g. http://localhost:3000');
const browser=await chromium.launch();
try {
  const context=await browser.newContext();
  await installStorageFaults(context,{origin,initial:{preferences:'{broken'},faults:[{operation:'setItem',error:'QuotaExceededError'}]});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  // Replace this with a meaningful assertion about your application's recovery UI.
  await page.locator('body').waitFor();
  assert.deepEqual(errors,[]);
  await context.close();
} finally { await browser.close(); }
