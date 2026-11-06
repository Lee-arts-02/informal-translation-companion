import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTranslation } from '../canvas-translation.js';

class Element {
  value = ''; checked = true; hidden = false; disabled = false; children = []; listeners = {};
  addEventListener(name, handler) { this.listeners[name] = handler; }
  replaceChildren(...nodes) { this.children = nodes; }
  append(node) { this.children.push(node); }
  setAttribute(name, value) { this[name] = value; }
  fire(name) { return this.listeners[name]?.({preventDefault(){}}); }
}
test('canvas translation previews are explicit, context-bound, cancellable and undo-ready', async () => {
  const nodes = new Map();
  const $ = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const original = { document:globalThis.document, confirm:globalThis.confirm, fetch:globalThis.fetch };
  globalThis.document = {getElementById:$, createElement:()=>new Element()};
  globalThis.confirm = () => true;
  let key = '', adopted = [], prompts = 0, request;
  try {
    const tools = setupTranslation({t:x=>x, connection:()=>({apiKey:key,model:'test/model'}),
      preferences:()=>['Keep uncertainty.'], connect:()=>prompts++, adopt:value=>{adopted.push(value);return true;}});
    await $('scenario-presets').children[0].fire('click');
    assert.equal($('translation-source').value, 'Aapne toh iss project mein char chand laga diye!');
    assert.equal($('translation-result').hidden, false); assert.equal(adopted.length,0);
    await $('translation-versions').children[1].fire('click');
    assert.equal($('translation-output').textContent,'You made this project shine!');
    await $('translation-apply').fire('click'); assert.deepEqual(adopted,['You made this project shine!']);
    await $('translation-tone').fire('input'); assert.equal($('translation-result').hidden,true);
    await $('translation-apply').fire('click'); assert.equal(adopted.length,1);
    await $('canvas-translation-form').fire('submit'); assert.equal(prompts,1);
    key = 'fixture-key';
    globalThis.fetch = async (_, options) => { request = JSON.parse(options.body); return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({translation:'Live preview',alternatives:{casual:'Casual',direct:'Direct',formal:'Formal'},nuance:'Context explanation'})}}]})}; };
    await $('canvas-translation-form').fire('submit');
    assert.equal($('translation-output').textContent,'Live preview');
    assert.deepEqual(JSON.parse(request.messages[1].content).preferences,['Keep uncertainty.']);
    assert.equal(adopted.length,1); assert.equal($('translation-submit').disabled,false);
    $('translation-use-habits').checked = false;
    await $('canvas-translation-form').fire('submit');
    assert.deepEqual(JSON.parse(request.messages[1].content).preferences,[]);
    let finish;
    globalThis.fetch = () => new Promise(resolve=>{finish=resolve;});
    const pending = $('canvas-translation-form').fire('submit');
    await $('translation-source').fire('input');
    finish({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({translation:'Stale',alternatives:{casual:'c',direct:'d',formal:'f'},nuance:'old'})}}]})});
    await pending; assert.equal($('translation-result').hidden,true);
    assert.equal($('translation-submit').disabled,false); tools.cancel();
  } finally { Object.assign(globalThis,original); }
});
