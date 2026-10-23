import test from 'node:test';
import assert from 'node:assert/strict';
const prefs = await import('../preferences.js').catch(() => ({}));
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('preferences survive reload while keys, source text and results are excluded', () => {
  assert.equal(typeof prefs.savePreferences, 'function');
  const store = storage();
  prefs.savePreferences(store, {
    traits: ['Keep it concise'], model: 'openrouter/auto', useProfile: true,
    apiKey: 'private-key', text: 'private source', translation: 'private output',
  });
  const restored = prefs.loadPreferences(store);
  assert.deepEqual(restored.traits, ['Keep it concise']);
  assert.equal(restored.model, 'openrouter/auto');
  assert.equal(JSON.stringify(restored).includes('private'), false);
  assert.equal(store.getItem('nuancebridge.preferences.v1').includes('private'), false);
});

test('malformed or unavailable storage falls back without crashing', () => {
  assert.equal(typeof prefs.loadPreferences, 'function');
  for (const value of ['{', 'null', '[]', '{"traits":9,"model":{}}']) {
    const restored = prefs.loadPreferences({ getItem: () => value });
    assert.ok(Array.isArray(restored.traits));
    assert.equal(typeof restored.model, 'string');
  }
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.ok(prefs.loadPreferences(denied).model);
  assert.equal(prefs.savePreferences(denied, {}), false);
});

test('preference lists and model values are bounded and type checked', () => {
  assert.equal(typeof prefs.savePreferences, 'function');
  const store = storage();
  prefs.savePreferences(store, { traits: [null, '<img onerror=alert(1)>', 'a'.repeat(201)], model: {} });
  const restored = prefs.loadPreferences(store);
  assert.deepEqual(restored.traits, ['<img onerror=alert(1)>']);
  assert.equal(typeof restored.model, 'string');
});
