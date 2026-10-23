import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../writing-session.js').catch(() => ({}));
const ready = () => assert.equal(typeof api.createSession, 'function');

test('accept changes only the selected occurrence after an emoji', () => {
  ready(); const state = api.createSession('🙂 hi, hi!');
  const next = api.applySuggestion(state, { revision: 0, start: 7, end: 9, original: 'hi', replacement: 'hello' });
  assert.equal(next.text, '🙂 hi, hello!'); assert.equal(state.text, '🙂 hi, hi!');
  assert.equal(next.original, '🙂 hi, hi!');
});
test('protected expressions reject AI replacement and direct manual editing', () => {
  ready(); const state = api.protectSpan(api.createSession('Thanks，辛苦了!'), 7, 10);
  assert.throws(() => api.applySuggestion(state, { revision: state.revision, start: 7, end: 10, original: '辛苦了', replacement: 'good job' }), /protect/i);
  assert.throws(() => api.editDraft(state, 'Thanks，good job!'), /protect/i);
});
test('protected ranges shift when an earlier sentence changes', () => {
  ready(); let state = api.protectSpan(api.createSession('Hi 辛苦了'), 3, 6);
  state = api.editDraft(state, 'Hello 辛苦了');
  assert.deepEqual(state.protected[0], { start: 6, end: 9, text: '辛苦了' });
});
test('stale suggestions and mismatched source spans cannot overwrite a draft', () => {
  ready(); const state = api.editDraft(api.createSession('hello'), 'hello!');
  assert.throws(() => api.applySuggestion(state, { revision: 0, start: 0, end: 5, original: 'hello', replacement: 'hi' }), /stale/i);
  assert.throws(() => api.applySuggestion(state, { revision: 1, start: 0, end: 5, original: 'other', replacement: 'hi' }), /match/i);
});
test('undo restores text and protected ranges without reusing old revision IDs', () => {
  ready(); let state = api.protectSpan(api.createSession('Hi 辛苦了'), 3, 6);
  state = api.editDraft(state, 'Hello 辛苦了');
  const undone = api.undo(state);
  assert.equal(undone.text, 'Hi 辛苦了'); assert.equal(undone.protected[0].start, 3);
  assert.ok(undone.revision > state.revision);
});
test('invalid ranges and edits splitting surrogate pairs are rejected', () => {
  ready(); const state = api.createSession('🙂 hello');
  for (const [start, end] of [[-1, 2], [0, 99], [1, 2], [0, 1], [2, 2]]) {
    assert.throws(() => api.protectSpan(state, start, end));
  }
});
test('starting draft must retain protected occurrences and is undoable', () => {
  ready(); let state = api.protectSpan(api.createSession('谢谢，辛苦了'), 3, 6);
  assert.throws(() => api.startingDraft(state, 'Thank you!'), /protect/i);
  state = api.startingDraft(state, 'Thank you—辛苦了');
  assert.equal(state.original, '谢谢，辛苦了');
  assert.equal(state.text.slice(state.protected[0].start, state.protected[0].end), '辛苦了');
  assert.equal(api.undo(state).text, '谢谢，辛苦了');
});
test('feedback is bounded and retains explicit reasons rather than inventing preferences', () => {
  ready(); const state = api.recordFeedback(api.createSession('hello'), 'rejected', 'Too formal', 'Good day');
  assert.equal(state.feedback[0].reason, 'Too formal');
  assert.equal(state.feedback[0].action, 'rejected');
  assert.equal(state.text, 'hello');
});
test('whole starting draft cannot drop an occurrence of a protected repeated phrase', () => {
  ready(); const state = api.protectSpan(api.createSession('辛苦了，真的辛苦了'), 6, 9);
  assert.throws(() => api.startingDraft(state, 'Thanks，辛苦了'), /protect/i);
});
test('remaining non-overlapping suggestions follow an accepted edit safely', () => {
  ready(); const state = api.createSession('Hi friend. Thanks!');
  const first = { revision: 0, start: 0, end: 2, original: 'Hi', replacement: 'Hello' };
  const second = { revision: 0, start: 11, end: 17, original: 'Thanks', replacement: 'Thank you' };
  const next = api.applySuggestion(state, first);
  const rebased = api.rebaseSuggestions([first, second], first, next, first.replacement);
  assert.equal(rebased.length, 1); assert.equal(rebased[0].start, 14);
  assert.equal(api.applySuggestion(next, rebased[0]).text, 'Hello friend. Thank you!');
});
test('a starting draft cannot collapse distinct protections onto overlapping text', () => {
  let state = api.protectSpan(api.createSession('Ann Anna'), 0, 3);
  state = api.protectSpan(state, 4, 8);
  assert.throws(() => api.startingDraft(state, 'Anna Ann'), /protect/i);
});
