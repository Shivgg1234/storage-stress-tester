#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runScenarios, formatReport } from './index.js';
const args = process.argv.slice(2);
if (args.includes('--help') || !args.length) {
  console.log('Usage: storage-stress-tester <config.mjs> [--json]\nConfig exports scenarios and run(storage, scenario).');
  process.exitCode = args.length ? 0 : 2;
} else {
  try {
    if (args.length > 2 || (args[1] && args[1] !== '--json') || args[0].startsWith('--')) throw new Error('Invalid arguments; use --help');
    const config = await import(pathToFileURL(resolve(args[0])).href);
    const report = await runScenarios(config.scenarios, config.run);
    console.log(args.includes('--json') ? JSON.stringify(report, null, 2) : formatReport(report));
    process.exitCode = report.passed ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
