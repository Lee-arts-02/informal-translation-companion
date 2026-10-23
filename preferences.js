const KEY = 'nuancebridge.preferences.v1';
const DEFAULTS = { model: 'openrouter/auto', traits: ['Keep it concise', 'Preserve warmth and cultural meaning'], useProfile: true };

function sanitize(value) {
  const data = value && typeof value === 'object' ? value : {};
  return {
    model: typeof data.model === 'string' && data.model.trim() && data.model.length <= 150 ? data.model.trim() : DEFAULTS.model,
    traits: Array.isArray(data.traits)
      ? data.traits.filter(x => typeof x === 'string' && x.trim() && x.length <= 200).slice(0, 12).map(x => x.trim())
      : [...DEFAULTS.traits],
    useProfile: typeof data.useProfile === 'boolean' ? data.useProfile : true,
  };
}

export function loadPreferences(storage) {
  try { return sanitize(JSON.parse(storage.getItem(KEY))); }
  catch { return sanitize(null); }
}

export function savePreferences(storage, value) {
  try { storage.setItem(KEY, JSON.stringify(sanitize(value))); return true; }
  catch { return false; }
}
