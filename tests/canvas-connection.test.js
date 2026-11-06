import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConnection } from '../canvas-connection.js';

test('connection check authenticates without sending draft data or storing credentials', async () => {
  let called;
  assert.equal(await checkConnection('session-key', { fetcher: async (url, options) => {
    called = { url, options }; return { ok:true, json:async()=>({data:{label:'My app'}}) };
  } }), true);
  assert.equal(called.url,'https://openrouter.ai/api/v1/key');
  assert.equal(called.options.headers.Authorization,'Bearer session-key');
  assert.equal(called.options.body,undefined);
});
test('invalid credentials and malformed responses do not report success or echo response bodies', async () => {
  await assert.rejects(checkConnection('',{}));
  await assert.rejects(checkConnection('bad',{fetcher:async()=>({ok:false,status:401})}), /not accepted/);
  await assert.rejects(checkConnection('key',{fetcher:async()=>({ok:true,json:async()=>({error:'raw secret'})})}), /invalid response/);
});
