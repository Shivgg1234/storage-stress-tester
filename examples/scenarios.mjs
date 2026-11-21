import assert from 'node:assert/strict';
import { storageScenarios } from '../src/index.js';
import { loadPreferences } from './preferences.js';
export const scenarios = storageScenarios('preferences', { oldValue: { version: 1, dark: true } });
export function run(storage, scenario) {
  const result = loadPreferences(storage);
  assert.equal(result.version, 2);
  assert.equal(result.theme, ['old-version', 'quota-exceeded'].includes(scenario.name) ? 'dark' : 'light');
}
