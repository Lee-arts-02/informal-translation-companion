import test from 'node:test';
import assert from 'node:assert/strict';
import { writingDemos, demoReview } from '../writing-demo.js';
import { createSession, protectSpan } from '../writing-session.js';
test('curated demo cannot masquerade as analysis or back-translation of arbitrary input', () => {
  const input = { ...createSession('My new unrelated story'), scope: 'light', target: 'English', backLanguage: 'Chinese (Simplified)' };
  assert.throws(() => demoReview('analyze', input, writingDemos[0]), /live|curated/i);
  assert.throws(() => demoReview('back', input, writingDemos[0]), /live|curated/i);
});
test('demo language constraints are explicit and examples preserve their protected expressions', () => {
  for (const sample of writingDemos) {
    let state = createSession(sample.text); const start = sample.text.indexOf(sample.protect);
    state = protectSpan(state, start, start + sample.protect.length);
    assert.ok(demoReview('analyze', { ...state, scope: 'light', target: 'English' }, sample).suggestions.length);
    assert.ok(sample.starting.includes(sample.protect));
    assert.throws(() => demoReview('start', { ...state, target: 'French' }, sample), /English|live/i);
    assert.throws(() => demoReview('back', { ...state, target: 'English', backLanguage: 'Urdu' }, sample), /Chinese|live/i);
    assert.throws(() => demoReview('analyze', { ...state, target: 'English' }, sample, 'French'), /explanation|live/i);
  }
});
test('the visible commitment mismatch prompt works in the authored repair example', () => {
  const sample = writingDemos.find(item => item.id === 'promise');
  const output = demoReview('repair', { ...createSession(sample.text), target: 'English', scope: 'light', correction: 'The commitment is stronger than I intended.' }, sample);
  assert.match(output.suggestions[0].replacement, /try to/);
});
