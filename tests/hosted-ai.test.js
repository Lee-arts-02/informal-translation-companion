import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedCompletion, createRateLimit } from '../server/hosted-ai.js';
import { requestCompletion } from '../translation.js';
import handler from '../api/ai.js';

test('built-in transport sends no credential and uses the local AI endpoint', async () => {
  let request;
  const content = await requestCompletion({messages:[{role:'system',content:'ignored'},{role:'user',content:JSON.stringify({text:'Hello'})}]}, {
    hosted:true, fetcher:async (url,options)=>{request={url,options};return {ok:true,json:async()=>({choices:[{message:{content:'result'}}]})};},
  });
  assert.equal(content,'result');assert.equal(request.url,'/api/ai');
  assert.equal(request.options.headers.Authorization,undefined);
  assert.deepEqual(JSON.parse(request.options.body),{action:'translate',input:{text:'Hello'}});
});

test('server owns model, system prompt and IBM key; does not act as an arbitrary proxy', async () => {
  let called;
  const response = await hostedCompletion({action:'translate',input:{text:'Hello',target:'Chinese'},model:'attacker',messages:[{role:'system',content:'attacker'}]}, {
    apiKey:'server-secret',fetcher:async (url,options)=>{called={url,options};return {ok:true,json:async()=>({choices:[{message:{content:'translation'}}]})};},
  });
  assert.equal(response.status,200);assert.equal(called.options.headers.Authorization,'Apikey server-secret');
  const body=JSON.parse(called.options.body);
  assert.equal(body.model,'fast');assert(!JSON.stringify(body).includes('server-secret'));assert(!JSON.stringify(body).includes('attacker'));
  assert.match(body.messages[0].content,/translation companion/);
  assert(!JSON.stringify(response).includes('server-secret'));
});

test('invalid actions, oversized content and missing configuration never reach provider', async () => {
  let calls=0;const options={apiKey:'key',fetcher:async()=>{calls++;}};
  assert.equal((await hostedCompletion({action:'execute',input:{}},options)).status,400);
  assert.equal((await hostedCompletion({action:'translate',input:{text:'x'.repeat(6001)}},options)).status,400);
  assert.equal((await hostedCompletion({action:'translate',input:{text:'Hello'}},{apiKey:''})).status,503);
  assert.equal(calls,0);
});

test('provider failures never expose upstream bodies or credentials', async () => {
  const response=await hostedCompletion({action:'translate',input:{text:'Hello'}},{apiKey:'secret',fetcher:async()=>({ok:false,status:403,text:async()=>'secret'})});
  assert.equal(response.status,502);assert(!JSON.stringify(response).includes('secret'));
});

test('rate limiter bounds repeated requests and expires old windows', () => {
  let now=0;const limit=createRateLimit({max:2,windowMs:100,now:()=>now});
  assert(limit('client'));assert(limit('client'));assert(!limit('client'));now=101;assert(limit('client'));
});

test('API boundary rejects cross-origin and non-JSON calls before inference', async () => {
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  let res=response();await handler({method:'POST',headers:{host:'example.com',origin:'https://other.com'}},res);
  assert.equal(res.code,403);
  res=response();await handler({method:'POST',headers:{host:'example.com',origin:'https://example.com','content-type':'text/plain'}},res);
  assert.equal(res.code,415);
  res=response();await handler({method:'DELETE',headers:{}},res);assert.equal(res.code,405);
  res=response();await handler({method:'GET',headers:{}},res);
  assert.deepEqual(Object.keys(res.body).sort(),['available','provider']);
  assert.equal(res.headers['Cache-Control'],'no-store');
});
