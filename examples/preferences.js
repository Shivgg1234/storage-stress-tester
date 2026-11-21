export function loadPreferences(storage) {
  const defaults = { version: 2, theme: 'light' };
  try {
    const raw = storage.getItem('preferences');
    if (raw === null) return defaults;
    const saved = JSON.parse(raw);
    const theme = saved?.version === 1 ? (saved.dark ? 'dark' : 'light') : saved?.theme;
    if (!['light', 'dark'].includes(theme)) return defaults;
    const result = { version: 2, theme };
    try { storage.setItem('preferences', JSON.stringify(result)); } catch { /* Keep usable in-memory settings. */ }
    return result;
  } catch { return defaults; }
}
