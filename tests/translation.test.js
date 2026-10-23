import test from 'node:test';
import assert from 'node:assert/strict';

// Optional import lets the first run report missing behavior as assertions.
const api = await import('../translation.js').catch(() => ({}));
const input = {
  text: 'Merci pour votre aide.', source: 'French', target: 'English',
  tone: 'Warm', recipient: 'Friend', channel: 'Text message',
  preferences: ['Keep sentences short'],
};
const result = {
  translation: 'Thanks so much for your help.',
  alternatives: { casual: 'Thanks for the help!', direct: 'Thank you for your help.', formal: 'Thank you for your assistance.' },
  nuance: 'Preserves the appreciation in a warmer register.',
};
const response = (content = JSON.stringify(result)) => new Response(JSON.stringify({
  choices: [{ message: { content } }],
}), { status: 200 });

test('request includes target language and context, with source text isolated as data', () => {
  assert.equal(typeof api.buildRequest, 'function');
  const body = api.buildRequest(input, 'openrouter/auto');
  assert.equal(body.model, 'openrouter/auto');
  const data = JSON.parse(body.messages[1].content);
  assert.equal(data.target, 'English');
  assert.equal(data.text, 'Merci pour votre aide.');
  assert.equal(data.recipient, 'Friend');
  assert.deepEqual(data.preferences, ['Keep sentences short']);
  assert.match(body.messages[0].content, /untrusted/i);
  assert.equal(body.messages[0].content.includes(input.text), false);
});

test('blank and oversized input are rejected before calling the provider', () => {
  assert.equal(typeof api.buildRequest, 'function');
  for (const text of ['', '   ', 'a'.repeat(6001)]) {
    assert.throws(() => api.buildRequest({ ...input, text }, 'openrouter/auto'));
  }
  assert.throws(() => api.buildRequest(input, ''));
});

test('live translation sends credentials only in the authorization header', async () => {
  assert.equal(typeof api.translate, 'function');
  const output = await api.translate(input, {
    apiKey: 'test-credential', model: 'openrouter/auto',
    fetcher: async (url, init) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(init.headers.Authorization, 'Bearer test-credential');
      assert.equal(init.body.includes('test-credential'), false);
      return response();
    },
  });
  assert.deepEqual(output, result);
});

test('code-fenced JSON is accepted but missing alternatives are rejected', () => {
  assert.equal(typeof api.parseResult, 'function');
  assert.deepEqual(api.parseResult('```json\n' + JSON.stringify(result) + '\n```'), result);
  for (const value of ['not JSON', '{}', '{"translation":"hello"}', 'null']) {
    assert.throws(() => api.parseResult(value), /invalid|incomplete/i);
  }
});

test('provider errors produce actionable messages without echoing secrets or raw errors', async () => {
  assert.equal(typeof api.translate, 'function');
  for (const [status, expected] of [[401, /key/i], [402, /credit/i], [429, /rate|busy/i], [500, /provider/i]]) {
    await assert.rejects(api.translate(input, {
      apiKey: 'test-credential', model: 'openrouter/auto',
      fetcher: async () => new Response('test-credential', { status }),
    }), error => expected.test(error.message) && !error.message.includes('test-credential'));
  }
});

test('successful HTTP response carrying an API error does not become a translation', async () => {
  assert.equal(typeof api.translate, 'function');
  await assert.rejects(api.translate(input, {
    apiKey: 'test', model: 'openrouter/auto',
    fetcher: async () => new Response(JSON.stringify({ error: { message: 'secret upstream data' } })),
  }), /provider/i);
});

test('timeout and cancellation terminate outstanding requests', async () => {
  assert.equal(typeof api.translate, 'function');
  const pending = async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(api.translate(input, {
    apiKey: 'test', model: 'openrouter/auto', fetcher: pending, timeoutMs: 10,
  }), /timed out/i);
  const controller = new AbortController();
  const request = api.translate(input, {
    apiKey: 'test', model: 'openrouter/auto', fetcher: pending, signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(request, /cancel/i);
});

test('network failures become a useful message', async () => {
  assert.equal(typeof api.translate, 'function');
  await assert.rejects(api.translate(input, {
    apiKey: 'test', model: 'openrouter/auto',
    fetcher: async () => { throw new TypeError('Failed to fetch'); },
  }), /network|connection/i);
});
