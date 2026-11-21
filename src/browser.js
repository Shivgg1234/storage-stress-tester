import { validateOptions } from './index.js';
/** Install on a fresh BrowserContext before creating pages. Closing the context restores isolation. */
export async function installStorageFaults(context, options = {}) {
  const { origin, area = 'localStorage', denyAccess = false, ...storageOptions } = options;
  if (!origin || new URL(origin).origin !== origin) throw new TypeError('origin must be an exact URL origin, e.g. https://example.com');
  if (!['localStorage', 'sessionStorage'].includes(area)) throw new TypeError('Invalid storage area');
  const config = validateOptions(storageOptions);
  await context.addInitScript(({ origin, area, denyAccess, initial, faults }) => {
    if (location.origin !== origin) return;
    if (denyAccess) {
      Object.defineProperty(window, area, { configurable: true, get() { throw new DOMException('Injected storage access failure', 'SecurityError'); } });
      return;
    }
    const storage = window[area];
    // Once per tab and origin: reload must exercise migrated data, not re-seed it.
    const marker = `__storage_crash_test_seeded__:${area}`;
    if (!sessionStorage.getItem(marker)) {
      for (const [key, value] of Object.entries(initial)) storage.setItem(key, value);
      sessionStorage.setItem(marker, '1');
    }
    const counts = faults.map(() => 0);
    function check(operation, key) {
      const active = faults.map((f, i) => {
        if (f.operation !== operation || (f.key !== undefined && f.key !== key)) return false;
        const n = ++counts[i];
        return n >= (f.at ?? 1) && n - (f.at ?? 1) < (f.times ?? Infinity);
      });
      const i = active.indexOf(true);
      if (i >= 0) throw new DOMException(`Injected failure during ${operation}`, faults[i].error);
    }
    for (const operation of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
      const original = Storage.prototype[operation];
      Object.defineProperty(Storage.prototype, operation, { configurable: true, writable: true, value: function (...args) {
        if (this === storage) check(operation, ['getItem', 'setItem', 'removeItem'].includes(operation) ? String(args[0]) : undefined);
        return original.apply(this, args);
      } });
    }
    const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'length');
    Object.defineProperty(Storage.prototype, 'length', { ...descriptor, get() {
      if (this === storage) check('length');
      return descriptor.get.call(this);
    } });
  }, { origin, area, denyAccess, ...config });
}
