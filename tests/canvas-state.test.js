import test from 'node:test';
import assert from 'node:assert/strict';
import { sentenceScope, wordDiff, applyRevision } from '../canvas-state.js';

test('scope preserves sentence separators and accommodates a crossing selection', () => {
  const text = "I'll send the draft. Next sentence.";
  assert.deepEqual(sentenceScope(text, 5, 9), { start: 0, end: 20, text: "I'll send the draft." });
  assert.equal(sentenceScope(text, 5, 25).text, text);
  assert.equal(sentenceScope('我会发给你。下周再说。', 2, 4).text, '我会发给你。');
});
test('diff distinguishes supporting edits and reconstructs both versions', () => {
  const before = "I'll send the draft.", after = "I'll try to send a draft.";
  const diff = wordDiff(before, after, { start: 5, end: 9 });
  assert.equal(diff.filter(x => x.kind !== 'add').map(x => x.text).join(''), before);
  assert.equal(diff.filter(x => x.kind !== 'del').map(x => x.text).join(''), after);
  assert(diff.some(x => x.outside && x.kind === 'add' && x.text.includes('try')));
  assert(wordDiff('send', 'share', { start: 0, end: 4 }).every(x => !x.outside));
});
test('adoption preserves the rest of the document and rejects stale/oversized output', () => {
  const text = "I'll send the draft. Next sentence.", scope = sentenceScope(text, 5, 9);
  assert.equal(applyRevision(text, scope, "I'll try to send the draft."), "I'll try to send the draft. Next sentence.");
  assert.throws(() => applyRevision('Changed.', scope, 'Something else.'));
  assert.throws(() => applyRevision(text, scope, 'x'.repeat(6001)));
  assert.throws(() => applyRevision(text, scope, ''));
});
