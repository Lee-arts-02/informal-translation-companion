import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIntent, reviseIntent, parseIntents, confirmedIntentions } from '../intent-state.js';
import { makeMemory, loadMemories, matchMemories, importMemories, exportMemories } from '../memory-store.js';
import { addEvent, makeSnapshot, snapshotCurrent, checkReviewed } from '../workflow-state.js';

test('model intent needs real evidence and cannot confirm itself', () => {
  const input = { text: '我尽量周五给你', intent: '不要增加承诺' };
  const [item] = parseIntents([{ content: 'Keep uncertainty', evidence: '尽量', category: 'commitment', confirmed: true }], input);
  assert.equal(item.origin, 'model'); assert.equal(item.confirmed, false);
  assert.throws(() => parseIntents([{ content: 'x', evidence: 'made up' }], input), /evidence/i);
  const edited = reviseIntent(item, 'Avoid a guarantee');
  assert.equal(edited.origin, 'user'); assert.equal(edited.confirmed, true);
  assert.equal(makeIntent('Keep warmth').confirmed, true);
});
test('legacy memories preserve disabled status and do not invent provenance or scope', () => {
  const storage = { getItem: key => key.endsWith('v2') ? null : JSON.stringify({ traits: ['Keep it concise'], useProfile: false }) };
  const [item] = loadMemories(storage);
  assert.equal(item.enabled, false); assert.equal(item.source.kind, 'legacy');
  assert.equal(item.scope.recipient, ''); assert.match(item.source.label, /not set/i);
});
test('memory matches all scoped dimensions and supports per-session exclusions', () => {
  const item = makeMemory({ content: 'Keep uncertainty', scope: { recipient: 'Friend', channel: 'Email', target: 'English' }, source: { kind: 'correction', label: 'User corrected commitment', eventId: 'event-1' } });
  assert.equal(matchMemories([item], { recipient: 'friend', channel: 'Email', target: 'English' }).length, 1);
  assert.equal(matchMemories([item], { recipient: 'Professor', channel: 'Email', target: 'English' }).length, 0);
  assert.equal(matchMemories([item], { recipient: 'Friend', channel: 'Text message', target: 'English' }).length, 0);
  assert.equal(matchMemories([item], { recipient: 'Friend', channel: 'Email', target: 'English' }, [item.id]).length, 0);
});
test('memory imports are strict, atomic and retain scope/source/paused state', () => {
  const item = makeMemory({ content: 'Preserve warmth', enabled: false, scope: { channel: 'Email' } });
  assert.deepEqual(importMemories(exportMemories([item])), [item]);
  for (const bad of ['{}', JSON.stringify({ version: 2, items: [item, { content: 'x' }] }), JSON.stringify({ version: 2, items: [item, item] })]) assert.throws(() => importMemories(bad));
  assert.throws(() => makeMemory({ content: 'x'.repeat(401) }));
});
test('snapshot is stale on text, language or context changes and events preserve user transformation', () => {
  const snap = makeSnapshot({ text: 'I will try.', revision: 2, backLanguage: 'Chinese', signature: 'a' }, '我会尽量。');
  assert.equal(snapshotCurrent(snap, { text: 'I will try.', revision: 2, backLanguage: 'Chinese', signature: 'a' }), true);
  for (const change of [{ revision: 3 }, { text: 'I will.' }, { backLanguage: 'Urdu' }, { signature: 'b' }]) assert.equal(snapshotCurrent(snap, { text: 'I will try.', revision: 2, backLanguage: 'Chinese', signature: 'a', ...change }), false);
  const events = addEvent([], { kind: 'edited', before: 'I will.', proposed: 'I can try.', after: 'I will try.', revision: 2 });
  assert.equal(events[0].proposed, 'I can try.'); assert.equal(events[0].after, 'I will try.');
  assert.notEqual(addEvent(events, { kind: 'undo', revision: 3 })[1].id, events[0].id);
});
test('continuous typing coalesces with the first before and latest result', () => {
  let events = addEvent([], { kind: 'manual-edit', before: '', after: 'H', revision: 1 });
  events = addEvent(events, { kind: 'manual-edit', before: 'H', after: 'Hi', revision: 2 });
  assert.equal(events.length, 1); assert.equal(events[0].before, ''); assert.equal(events[0].after, 'Hi');
  events = addEvent(events, { kind: 'accepted', before: 'Hi', after: 'Hello', revision: 3 });
  events = addEvent(events, { kind: 'manual-edit', before: 'Hello', after: 'Hello!', revision: 4 });
  assert.equal(events.length, 3);
});
test('pending AI guesses are excluded until the writer confirms them', () => {
  const user = makeIntent('Keep uncertainty');
  const pending = makeIntent('Be formal', { origin: 'model' });
  assert.deepEqual(confirmedIntentions([user, pending]), [user]);
  assert.equal(confirmedIntentions([user, { ...pending, confirmed: true }]).length, 2);
});
test('user-reviewed status belongs only to an unchanged check snapshot', () => {
  const input = { text: 'I will try.', revision: 1, backLanguage: 'Chinese', signature: 'a' };
  const snapshot = makeSnapshot(input, '我会尽量。');
  assert.equal(checkReviewed(snapshot, input, snapshot.id), true);
  assert.equal(checkReviewed(snapshot, { ...input, revision: 2 }, snapshot.id), false);
  assert.equal(checkReviewed(snapshot, input, 'another-snapshot'), false);
});
