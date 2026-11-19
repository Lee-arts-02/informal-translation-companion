import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSpeechInput } from '../speech-input.js';
test('speech input appends only final results and ignores stopped sessions',()=>{
  const nodes=new Map();
  const $=id=>{
    if (!nodes.has(id)) nodes.set(id,{value:'',textContent:'',events:{},setAttribute(k,v){this[k]=v;},
      addEventListener(k,f){this.events[k]=f;},dispatchEvent(event){this.events[event.type]?.(event);}});
    return nodes.get(id);
  };
  let latest;
  class Recognition {constructor(){latest=this;} start(){} stop(){this.stopping=true;} abort(){this.aborted=true;}}
  const host={SpeechRecognition:Recognition,addEventListener(){}};
  $('voice-language').value='en-US'; $('translation-source').value='Hello';
  let changes=0; $('translation-source').events.input=()=>changes++;
  const api=setupSpeechInput({t:k=>k,host,doc:{getElementById:$}});
  $('voice-input').events.click();
  assert.equal(latest.lang,'en-US'); assert.equal($('voice-input')['aria-pressed'],'true');
  const result=[{transcript:'there'}]; result.isFinal=true;
  latest.onresult({resultIndex:0,results:[result]});
  assert.equal($('translation-source').value,'Hello there'); assert.equal(changes,1);
  $('voice-input').events.click(); assert.equal(latest.stopping,true);
  assert.equal($('voice-status').textContent,'voiceFinishing');
  result.isFinal=true; latest.onresult({resultIndex:0,results:[result]});
  assert.equal(changes,2);
  result.isFinal=false; latest.onresult({resultIndex:0,results:[result]}); assert.equal(changes,2);
  api.stop(); result.isFinal=true; latest.onresult({resultIndex:0,results:[result]}); assert.equal(changes,2);
  $('translation-source').value='a'.repeat(6000); $('voice-input').events.click();
  latest.onresult({resultIndex:0,results:[result]}); assert.equal($('voice-status').textContent,'voiceLimit');
  $('voice-input').events.click(); latest.onerror({error:'not-allowed'});
  assert.equal($('voice-status').textContent,'voiceDenied');
  assert.equal($('voice-input')['aria-pressed'],'false');
  setupSpeechInput({t:k=>k,host:{addEventListener(){}},doc:{getElementById:$}});
  assert.equal($('voice-input').disabled,true); assert.equal($('voice-status').textContent,'voiceUnsupported');
});
