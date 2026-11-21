import { createFaultyStorage, checkMigration, runScenarios, storageScenarios } from '../src/index.js';
import { installStorageFaults } from '../src/browser.js';
import type { BrowserContext } from 'playwright';
const storage = createFaultyStorage({ faults: [{ operation: 'getItem', error: 'SecurityError' }] });
const compatible: Storage = storage;
void compatible;
runScenarios(storageScenarios('key'), async (s) => { s.setItem('a', 'b'); });
checkMigration({ fixtures: [{ name: 'old', value: { version: 1 } }], migrate: v => ({ version: v.version }), validate: v => v.version === 1 });
declare const context: BrowserContext;
installStorageFaults(context, { origin: 'https://example.com' });
// @ts-expect-error invalid operation must be rejected
createFaultyStorage({ faults: [{ operation: 'missing', error: 'SecurityError' }] });
