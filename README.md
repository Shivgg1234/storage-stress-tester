# storage-stress-tester

**Your app works with an empty browser. Does it work with your users' old data?**

A zero-runtime-dependency testing toolkit for corrupt storage, failed reads and writes,
and migration contracts. Includes an optional Playwright-compatible browser adapter.
ESM with TypeScript declarations. Node.js 22 or newer for the CLI and test tooling.

[GitHub repository](https://github.com/Shivgg1234/storage-stress-tester)

## Why use it?

Normal tests often start with empty storage. Returning users may have old schemas,
corrupt JSON, or a browser that rejects writes. This toolkit makes those conditions
repeatable, so you can assert that your app recovers and preserves important data.
It is a developer testing utility, not a production storage replacement.

## Installation

After the first npm release:

```sh
npm install --save-dev storage-stress-tester
```

Requires Node.js 22+. The package is ESM: use `import` or dynamic `import()`.
For browser integration, also install Playwright and its browser:

```sh
npm install --save-dev playwright
npx playwright install chromium
```

Before publication, install the tarball as shown below.

## Local setup and basic usage

```sh
git clone https://github.com/Shivgg1234/storage-stress-tester.git
cd storage-stress-tester
```


```sh
npm ci
npm test
npm run demo
npm pack
# In another project:
npm install --save-dev /absolute/path/to/storage-stress-tester-0.1.0.tgz
```

```js
import assert from 'node:assert/strict';
import { createFaultyStorage } from 'storage-stress-tester';

const storage = createFaultyStorage({
  initial: { preferences: '{broken-json' },
  faults: [{ operation: 'setItem', error: 'QuotaExceededError' }],
});

// Inject storage into your own function instead of reading a global directly.
function readTheme(storage) {
  try { return JSON.parse(storage.getItem('preferences'))?.theme ?? 'light'; }
  catch { return 'light'; }
}
assert.equal(readTheme(storage), 'light');
assert.throws(() => storage.setItem('preferences', '{}'), {
  name: 'QuotaExceededError',
});
```

## API reference

| Export / method | Parameters | Returns |
| --- | --- | --- |
| `createFaultyStorage(options?)` | `{ initial?: Record<string,string>, faults?: Fault[] }`; defaults to empty storage and no failures | A `FaultyStorage` instance |
| `storage.getItem(key)` | String key | Stored string or `null` |
| `storage.setItem(key, value)` | Key and value; values are stringified | `undefined`; may throw an injected DOMException |
| `storage.removeItem(key)` | Key to delete | `undefined` |
| `storage.clear()` | None | `undefined` |
| `storage.key(index)` | Zero-based numeric index | Key string or `null` |
| `storage.length` | Read-only property | Number of stored keys |
| `storage.snapshot()` | None | Detached `Record<string,string>` |
| `storage.operations()` | None | Detached array of `{ operation, key?, value?, outcome, error? }` |
| `storage.reset()` | None | `undefined`; restores initial data and clears logs/counters |
| `storageScenarios(key, options?)` | Key; optional `{ oldValue, wrongShape }`, defaulting to `{}` and `[]` | Six `Scenario` objects |
| `runScenarios(scenarios, run)` | Nonempty scenario array; callback `(storage, scenario)` which throws on failure | `Promise<Report>` |
| `formatReport(report)` | A report object | Human-readable string |
| `checkMigration(options)` | Nonempty `fixtures: {name,value}[]`, `migrate(value)`, `validate(value)`, optional `preserve(value)` | `Promise<Report>` |
| `validateOptions(options?)` | Storage options | Copied, normalized `{ initial, faults }`; throws `TypeError` for invalid options |
| `installStorageFaults(context, options)` | Browser context; exact `origin`, optional `initial`, `faults`, `area`, `denyAccess` | `Promise<void>` |

`installStorageFaults` is imported from `storage-stress-tester/browser`.
`Scenario` is `{ name, initial?, faults? }`. `Report` is
`{ passed: boolean, total: number, failed: number, results }`, where each result is
`{ name, passed, error?: { name, message } }`. Migration and scenario callbacks may
be async. Migration `validate` must return `true`; `preserve` selects data to compare
before and after migration. The detailed rules and examples below complete the API.

## Fault rules

`createFaultyStorage({ initial, faults })` implements the methods and `length` property
of Storage. Initial values must be strings. `setItem` coerces values to strings.
Missing keys return `null`; empty strings remain empty strings.

A fault has:

- `operation`: `getItem`, `setItem`, `removeItem`, `clear`, `key`, or `length`.
- `error`: `QuotaExceededError`, `SecurityError`, or `UnknownError`.
- `key`: optional exact key filter for keyed operations.
- `at`: first matching attempt to fail, starting at 1 (default 1).
- `times`: number of consecutive matching attempts to fail (default unlimited).

Every matching rule counts attempts, even if another rule throws. The first active
rule wins. Failed operations do not mutate storage. Counters are per instance.

```js
const storage = createFaultyStorage({
  initial: { cart: 'old' },
  faults: [{ operation: 'setItem', key: 'cart', at: 2, times: 1,
             error: 'QuotaExceededError' }],
});
```

`snapshot()` returns a detached record of stored strings. `operations()` returns a
detached log of method calls, including values and errors. `reset()` restores initial
values and clears counters and logs. Diagnostic methods bypass injected failures.
Logs can contain user data; use synthetic fixtures and do not log production secrets.

## Scenario runner

```js
import { storageScenarios, runScenarios, formatReport } from 'storage-stress-tester';
const scenarios = storageScenarios('preferences', {
  oldValue: { version: 1, dark: true },
  wrongShape: [],
});
const report = await runScenarios(scenarios, async (storage, scenario) => {
  const result = loadPreferences(storage); // your application function
  // Throw/assert if the application violated your recovery contract.
  if (!result) throw new Error('App failed to recover');
});
console.log(formatReport(report));
```

Built-in scenarios: missing, corrupt JSON, wrong shape, old version, failed writes,
and denied reads. Quota scenarios seed `oldValue` so migration writes can be exercised.
Provide your own `Scenario[]` for application-specific cases. Each scenario gets a
fresh storage instance. The callback must throw on failure; returning `false` is not
an assertion. Empty suites are rejected. No timeout is imposed: configure your test
runner's timeout for application code that might hang.

A report contains `passed`, `total`, `failed`, and individual `results`. Reports omit
storage values; detailed logs are available explicitly from the storage instance.

## Migration contracts

```js
import { checkMigration } from 'storage-stress-tester';
const report = await checkMigration({
  fixtures: [{ name: 'v1 cart', value: { version: 1, items: ['book'] } }],
  migrate: cart => ({ ...cart, version: 2 }),
  validate: cart => cart.version === 2 && Array.isArray(cart.items),
  preserve: cart => cart.items,
});
if (!report.passed) throw new Error(JSON.stringify(report));
```

Checks output validation, idempotence (applying the migration twice yields the same
value), and optional preservation of selected data. Inputs are cloned, so fixtures
remain unchanged. Use JSON-like values; cyclic objects, Maps, Sets, Dates and class
instances are outside this structural comparison contract. Validation must return
`true`. Async callbacks are supported. Application code owns migration and recovery
policies, including handling unknown future versions and rollbacks.

## Real-browser integration

```js
import { chromium } from 'playwright';
import { installStorageFaults } from 'storage-stress-tester/browser';
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await installStorageFaults(context, {
    origin: 'http://localhost:3000',
    initial: { preferences: '{broken' },
    faults: [{ operation: 'setItem', error: 'QuotaExceededError' }],
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3000');
  // Assert YOUR app's recovery UI here.
  await context.close();
} finally { await browser.close(); }
```

Install once per storage area on a **fresh context before opening pages**. Closing
that context removes patches. Only the exact configured origin is affected.
`area` defaults to `localStorage`; `sessionStorage` is also supported.
`denyAccess: true` makes accessing `window[area]` itself throw `SecurityError`.

Initial values are seeded once per tab/origin using a reserved sessionStorage marker
(`__storage_crash_test_seeded__:localStorage` or `:sessionStorage`). Reloads retain
migrated data. Clearing sessionStorage removes the marker and causes reseeding on
reload. Each new tab can reseed shared localStorage: for coordinated multi-tab tests,
use empty `initial` and seed explicitly with your test before the scenario. Fault
counters restart with each document. Seed setup happens before fault injection.
Do not use an application key matching the reserved marker.

## CLI

Create a config module exporting `scenarios` and `run(storage, scenario)`:

```sh
node src/cli.js examples/scenarios.mjs
node src/cli.js examples/scenarios.mjs --json
# After installing the package:
npx storage-stress-tester ./storage.config.mjs --json
```

Exit codes: `0` passed, `1` test failures, `2` configuration/usage errors. Config files
execute as ordinary trusted JavaScript. Config and callback console output can mix
with the JSON report; keep callbacks quiet when consuming `--json`.

## Development

```sh
npm ci
npm run check
npm test
npm run demo
npx playwright install chromium
npm run test:browser
npm pack
```

`CHROME_PATH` can select an existing Chrome executable for browser tests. CI runs
unit/CLI tests on Node 22/24/26 and a separate Chromium integration job.

## Scope and limitations

- Fault injection is deterministic simulation, not measurement of actual browser quotas.
- Core supports Storage methods, not named property access (`storage.foo`) or real events.
- Browser adapter intercepts Storage methods and length; named properties bypass it.
- No automatic proof that data was preserved: supply meaningful assertions.
- No IndexedDB emulation, browser eviction simulation, automatic migrations, or guarantee
  of catching every concurrency bug.
- Zero production dependencies; Playwright and TypeScript are development dependencies.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and [PUBLISHING.md](PUBLISHING.md)
for release instructions. MIT licensed.

## Project structure

```text
src/                    Core API, browser adapter, CLI and TypeScript declarations
test/                   Unit, CLI, type and browser integration tests
examples/               Recovery, migration and browser usage examples
.github/workflows/      Automated checks on pushes and pull requests
README.md               Installation, API and limitations
CONTRIBUTING.md         Development and contribution guide
CHANGELOG.md            Version history
LICENSE                 MIT license
```

## Versioning and maintenance

The initial version is `0.1.0`. Record changes in CHANGELOG.md and publish a new
version for each release. During 0.x, minor releases may change the API; patch
releases fix compatible bugs. After 1.0, use major versions for breaking changes,
minor versions for compatible features, and patches for fixes.

Report reproducible bugs through [GitHub Issues](https://github.com/Shivgg1234/storage-stress-tester/issues).
Contributions should include tests and updated documentation; see
[CONTRIBUTING.md](CONTRIBUTING.md).
