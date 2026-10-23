import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../review-api.js').catch(() => ({}));
const input = { text: 'Thanks，辛苦了', original: 'Thanks，辛苦了', revision: 2,
  protected: [{ start: 7, end: 10, text: '辛苦了' }], intent: 'Thank a classmate', avoid: 'Sounding distant',
  recipient: 'Classmate', relationship: 'We work together', channel: 'Text message', scope: 'light',
  explanationLanguage: 'Chinese (Simplified)', target: 'English', feedback: [{ action: 'rejected', reason: 'Too formal' }],
};
test('review request includes intent, boundaries, explanations language and explicit feedback', () => {
  assert.equal(typeof api.buildReviewRequest, 'function');
  const request = api.buildReviewRequest('analyze', input, 'openrouter/auto');
  const data = JSON.parse(request.messages[1].content);
  assert.equal(data.intent, 'Thank a classmate'); assert.equal(data.explanationLanguage, 'Chinese (Simplified)');
  assert.equal(data.protected[0].text, '辛苦了'); assert.equal(data.feedback[0].reason, 'Too formal');
  assert.match(request.messages[0].content, /untrusted/i);
});
test('analysis accepts no-change results and validates each proposed span', () => {
  assert.equal(typeof api.parseReview, 'function');
  assert.deepEqual(api.parseReview('analyze', JSON.stringify({ summary: 'Already clear', suggestions: [] }), input), { summary: 'Already clear', suggestions: [] });
  const valid = { start: 0, original: 'Thanks', replacement: 'Thank you', reason: 'Slightly warmer', tradeoff: 'A little more formal', reader: 'May sound more deliberate' };
  const parsed = api.parseReview('analyze', JSON.stringify({ summary: 'One option', suggestions: [valid] }), input);
  assert.equal(parsed.suggestions[0].end, 6); assert.equal(parsed.suggestions[0].revision, 2);
  for (const suggestion of [{ ...valid, start: 1 }, { ...valid, start: 7, original: '辛苦了', replacement: 'thanks' }]) {
    assert.throws(() => api.parseReview('analyze', JSON.stringify({ summary: 'x', suggestions: [suggestion] }), input));
  }
});
test('selected-only scope rejects suggestions outside the selected span', () => {
  assert.equal(typeof api.parseReview, 'function');
  const payload = JSON.stringify({ summary: 'One', suggestions: [{ start: 0, original: 'Thanks', replacement: 'Thank you', reason: 'x', tradeoff: 'x', reader: 'x' }] });
  assert.throws(() => api.parseReview('analyze', payload, { ...input, scope: 'selection', selection: { start: 7, end: 10 } }), /select/i);
  assert.throws(() => api.buildReviewRequest('analyze', { ...input, scope: 'selection' }, 'model'), /select/i);
});
test('reflection validates text and does not claim a numerical meaning score', () => {
  assert.equal(typeof api.parseReview, 'function');
  assert.deepEqual(api.parseReview('reflect', '{"meaning":"Offer preserved","reader":"May feel warm","questions":[]}', input), { meaning: 'Offer preserved', reader: 'May feel warm', questions: [] });
  assert.throws(() => api.parseReview('reflect', '{"score":100}', input));
});
test('live review uses existing provider transport and structured validation', async () => {
  assert.equal(typeof api.reviewWriting, 'function');
  const result = await api.reviewWriting('analyze', input, { apiKey: 'secret', model: 'openrouter/auto', fetcher: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer secret');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"summary":"No changes needed","suggestions":[]}' } }] }));
  } });
  assert.equal(result.summary, 'No changes needed');
});
test('starting drafts cannot exceed limits or delete protected text', () => {
  assert.throws(() => api.parseReview('start', '{"draft":"Thank you"}', input), /protect/i);
  assert.throws(() => api.parseReview('start', JSON.stringify({ draft: 'a'.repeat(6001) }), input), /6,000/i);
});
