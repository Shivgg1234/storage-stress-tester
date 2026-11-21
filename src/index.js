const methods = ['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length'];
const errors = ['QuotaExceededError', 'SecurityError', 'UnknownError'];
export function validateOptions(options = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('Options must be an object');
  const initial = options.initial ?? {};
  if (!initial || typeof initial !== 'object' || Array.isArray(initial)) throw new TypeError('initial must be a record');
  for (const value of Object.values(initial)) if (typeof value !== 'string') throw new TypeError('Initial values must be strings; serialize JSON explicitly');
  const faults = options.faults ?? [];
  if (!Array.isArray(faults)) throw new TypeError('faults must be an array');
  for (const f of faults) {
    if (!f || !methods.includes(f.operation)) throw new TypeError('Invalid fault operation');
    if (!errors.includes(f.error)) throw new TypeError('Invalid fault error');
    if (f.key !== undefined && typeof f.key !== 'string') throw new TypeError('Fault key must be a string');
    if (f.at !== undefined && (!Number.isSafeInteger(f.at) || f.at < 1)) throw new TypeError('Fault at must be a positive integer');
    if (f.times !== undefined && (!Number.isSafeInteger(f.times) || f.times < 1)) throw new TypeError('Fault times must be a positive integer');
  }
  return { initial: { ...initial }, faults: faults.map(f => ({ ...f })) };
}

/** A deterministic Storage-method implementation, not a browser quota estimator. */
export function createFaultyStorage(options = {}) {
  const config = validateOptions(options);
  let data = new Map(Object.entries(config.initial));
  let matches = config.faults.map(() => 0);
  const operations = [];
  function perform(operation, key, value, action) {
    const entry = { operation, ...(key === undefined ? {} : { key }), ...(value === undefined ? {} : { value }), outcome: 'ok' };
    // Count every matching operation for every rule, including failed attempts.
    const candidates = config.faults.map((f, i) => {
      if (f.operation !== operation || (f.key !== undefined && f.key !== key)) return false;
      const count = ++matches[i];
      return count >= (f.at ?? 1) && count - (f.at ?? 1) < (f.times ?? Infinity);
    });
    const index = candidates.indexOf(true);
    if (index !== -1) {
      entry.outcome = 'error'; entry.error = config.faults[index].error;
      operations.push(entry);
      throw new DOMException(`Injected ${entry.error} during ${operation}`, entry.error);
    }
    operations.push(entry);
    return action();
  }
  return {
    get length() { return perform('length', undefined, undefined, () => data.size); },
    key(index) { const n = Number(index) >>> 0; return perform('key', undefined, undefined, () => [...data.keys()][n] ?? null); },
    getItem(key) { key = String(key); return perform('getItem', key, undefined, () => data.get(key) ?? null); },
    setItem(key, value) { key = String(key); value = String(value); return perform('setItem', key, value, () => { data.set(key, value); }); },
    removeItem(key) { key = String(key); return perform('removeItem', key, undefined, () => { data.delete(key); }); },
    clear() { return perform('clear', undefined, undefined, () => { data.clear(); }); },
    snapshot() { return Object.fromEntries(data); },
    operations() { return operations.map(entry => ({ ...entry })); },
    reset() { data = new Map(Object.entries(config.initial)); matches = config.faults.map(() => 0); operations.length = 0; },
  };
}

export function storageScenarios(key, { oldValue = {}, wrongShape = [] } = {}) {
  key = String(key);
  return [
    { name: 'missing', initial: {} },
    { name: 'corrupt-json', initial: { [key]: '{broken-json' } },
    { name: 'wrong-shape', initial: { [key]: JSON.stringify(wrongShape) } },
    { name: 'old-version', initial: { [key]: JSON.stringify(oldValue) } },
    { name: 'quota-exceeded', initial: { [key]: JSON.stringify(oldValue) }, faults: [{ operation: 'setItem', error: 'QuotaExceededError' }] },
    { name: 'read-denied', faults: [{ operation: 'getItem', error: 'SecurityError' }] },
  ];
}

export async function runScenarios(scenarios, run) {
  if (!Array.isArray(scenarios) || scenarios.length === 0 || typeof run !== 'function') throw new TypeError('Expected scenarios and a test callback');
  const results = [];
  for (const scenario of scenarios) {
    if (typeof scenario.name !== 'string' || !scenario.name) throw new TypeError('Each scenario needs a name');
    const storage = createFaultyStorage(scenario);
    try {
      await run(storage, scenario);
      results.push({ name: scenario.name, passed: true });
    } catch (error) {
      results.push({ name: scenario.name, passed: false, error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) } });
    }
  }
  return { passed: results.every(r => r.passed), total: results.length, failed: results.filter(r => !r.passed).length, results };
}

export function formatReport(report) {
  return [...report.results.map(r => `${r.passed ? 'PASS' : 'FAIL'} ${r.name}${r.error ? `: ${r.error.message}` : ''}`), `${report.total - report.failed}/${report.total} scenarios passed`].join('\n');
}

// JSON-like fixtures are compared structurally, independent of object key order.
function equal(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && ak.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
export async function checkMigration({ fixtures, migrate, validate, preserve }) {
  if (!Array.isArray(fixtures) || fixtures.length === 0 || typeof migrate !== 'function' || typeof validate !== 'function') throw new TypeError('fixtures, migrate and validate are required');
  const results = [];
  for (const fixture of fixtures) {
    try {
      const original = structuredClone(fixture.value);
      const migrated = await migrate(structuredClone(original));
      if (await validate(migrated) !== true) throw new Error('Migrated value failed validation');
      const twice = await migrate(structuredClone(migrated));
      if (!equal(migrated, twice)) throw new Error('Migration is not idempotent');
      if (preserve && !equal(await preserve(original), await preserve(migrated))) throw new Error('Migration changed preserved data');
      results.push({ name: fixture.name, passed: true });
    } catch (error) {
      results.push({ name: fixture.name, passed: false, error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) } });
    }
  }
  return { passed: results.every(r => r.passed), total: results.length, failed: results.filter(r => !r.passed).length, results };
}
