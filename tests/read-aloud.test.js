import test from 'node:test';
import assert from 'node:assert/strict';
import {readingLanguage,setupReadAloud} from '../read-aloud.js';
test('read-aloud selects language, switches sides and discards stale events',()=>{
  const nodes=new Map();
  const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',events:{},setAttribute(k,v){this[k]=v;},addEventListener(k,f){this.events[k]=f;}});return nodes.get(id);};
  $('translation-source').value='你好'; $('translation-output').value='Hello';
  $('translation-source-language').value='Auto-detect';
  $('translation-target-language').value='English'; $('voice-language').value='en-US';
  const spoken=[];let cancelled=0;
  const host={addEventListener(){},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},
    speechSynthesis:{speak:u=>spoken.push(u),cancel:()=>cancelled++,getVoices:()=>[{lang:'zh-CN'}]}};
  const api=setupReadAloud({t:k=>k,host,doc:{getElementById:$}});
  $('listen-source').events.click();
  assert.equal(spoken[0].text,'你好');assert.equal(spoken[0].lang,'zh-CN');
  $('listen-output').events.click();
  assert.equal(cancelled,1);assert.equal(spoken[1].lang,'en-US');
  spoken[0].onend();assert.equal($('listen-output')['aria-pressed'],'true');
  $('translation-source').events.input();
  assert.equal(cancelled,2);assert.equal($('listen-output')['aria-pressed'],'false');
  $('translation-output').value=''; api.render();assert.equal($('listen-output').disabled,true);
  assert.equal(readingLanguage('Spanish','Hola'),'es-ES');
});
