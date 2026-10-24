export const MEMORY_KEY = 'nuancebridge.memories.v2';
const LIMIT = 50;
function string(value, max, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error('Invalid habit file or field length.');
  return value.trim();
}
export function makeMemory(data) {
  const scope = data.scope || {}, source = data.source || { kind: 'manual', label: 'Explicitly saved by you' };
  return { id: data.id || crypto.randomUUID(), content: string(data.content, 400, false), enabled: data.enabled !== false,
    scope: { recipient: string(scope.recipient || '', 150), channel: string(scope.channel || '', 100), target: string(scope.target || '', 100) },
    source: { kind: string(source.kind, 40, false), label: string(source.label, 600, false), eventId: string(source.eventId || '', 100) },
    confirmed: true, createdAt: data.createdAt || new Date().toISOString(), updatedAt: data.updatedAt || new Date().toISOString() };
}
function validate(items) {
  if (!Array.isArray(items) || items.length > LIMIT) throw new Error('A habit file can contain up to 50 habits.');
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id)
      || typeof item.enabled !== 'boolean' || item.confirmed !== true || !item.scope || !item.source
      || !['recipient', 'channel', 'target'].every(key => typeof item.scope[key] === 'string')
      || typeof item.source.eventId !== 'string'
      || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))
      || typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error('Invalid habit file. Nothing was imported.');
    ids.add(item.id); return makeMemory(item);
  });
}
export function importMemories(json) {
  if (typeof json !== 'string' || json.length > 150000) throw new Error('Habit file is too large.');
  const data = JSON.parse(json);
  if (data?.version !== 2) throw new Error('Choose a NuanceBridge v2 habit file.');
  return validate(data.items);
}
export function exportMemories(items) { return JSON.stringify({ version: 2, items: validate(items) }, null, 2); }
export function loadMemories(storage) {
  const saved = storage?.getItem(MEMORY_KEY);
  if (saved !== null && saved !== undefined) return importMemories(saved);
  const legacy = JSON.parse(storage?.getItem('nuancebridge.preferences.v1') || 'null');
  return (Array.isArray(legacy?.traits) ? legacy.traits : []).filter(x => typeof x === 'string' && x.trim() && x.length <= 200).slice(0, 12)
    .map(content => makeMemory({ content, enabled: legacy.useProfile !== false, source: { kind: 'legacy', label: 'Earlier explicit style preference; scope not set' } }));
}
export function saveMemories(storage, items) { storage.setItem(MEMORY_KEY, exportMemories(items)); }
export function matchMemories(items, context, excluded = []) {
  const same = (a, b) => a.trim().toLocaleLowerCase() === (b || '').trim().toLocaleLowerCase();
  return items.filter(item => item.enabled && item.confirmed && !excluded.includes(item.id)
    && Object.entries(item.scope).every(([key, value]) => !value || same(value, context[key])));
}
