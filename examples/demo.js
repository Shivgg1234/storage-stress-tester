import { runScenarios, formatReport } from '../src/index.js';
import { scenarios, run } from './scenarios.mjs';
console.log('Buggy app:');
console.log(formatReport(await runScenarios(scenarios, storage => {
  const value = JSON.parse(storage.getItem('preferences'));
  if (value.version !== 2) throw new Error('Expected current schema');
  storage.setItem('preferences', JSON.stringify(value));
})));
console.log('\nResilient app:');
const report = await runScenarios(scenarios, run);
console.log(formatReport(report));
process.exitCode = report.passed ? 0 : 1;
