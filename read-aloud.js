const languages = {English:'en-US',Chinese:'zh-CN',Urdu:'ur-PK',Spanish:'es-ES',French:'fr-FR',Hindi:'hi-IN',Arabic:'ar-SA'};
export function readingLanguage(selected, text, fallback = 'en-US') {
  if (languages[selected]) return languages[selected];
  if (/\p{Script=Han}/u.test(text)) return 'zh-CN';
  if (/\p{Script=Devanagari}/u.test(text)) return 'hi-IN';
  if (/\p{Script=Arabic}/u.test(text)) return /[ٹڈڑںھہے]/u.test(text) ? 'ur-PK' : 'ar-SA';
  return fallback;
}
export function setupReadAloud({t, beforeSpeak=()=>{}, host=window, doc=document}) {
  const $=id=>doc.getElementById(id), synth=host.speechSynthesis;
  const supported=!!synth && !!host.SpeechSynthesisUtterance;
  let active=null, utterance=null;
  function render() {
    for (const side of ['source','output']) {
      const button=$('listen-'+side), playing=active===side;
      button.disabled=!supported || !($('translation-'+side).value || '').trim();
      button.textContent=playing?'■':'🔊';
      button.setAttribute('aria-pressed',String(playing));
      const label=t(playing?'listenStop':side==='source'?'listenSource':'listenOutput');
      button.setAttribute('aria-label',label); button.title=label;
      if (!supported) $('listen-'+side+'-status').textContent=t('listenUnsupported');
    }
  }
  function stop() {
    const previous=active;
    active=null; utterance=null;
    if (previous) {synth.cancel(); $('listen-'+previous+'-status').textContent='';}
    render();
  }
  for (const side of ['source','output']) {
    $('listen-'+side).addEventListener('click',()=>{
      if (active===side) {stop(); return;}
      stop();
      const text=$('translation-'+side).value.trim();
      if (!supported || !text) return;
      beforeSpeak();
      const request=new host.SpeechSynthesisUtterance(text);
      const lang=readingLanguage($('translation-'+(side==='source'?'source':'target')+'-language').value,text,$('voice-language').value);
      request.lang=lang;
      const voices=synth.getVoices();
      const voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())
        || voices.find(v=>v.lang.split('-')[0]===lang.split('-')[0]);
      if (voice) request.voice=voice;
      active=side; utterance=request; render();
      $('listen-'+side+'-status').textContent=t('listenPlaying');
      request.onend=()=>{
        if (utterance!==request) return;
        active=null; utterance=null; $('listen-'+side+'-status').textContent=''; render();
      };
      request.onerror=()=>{
        if (utterance!==request) return;
        active=null; utterance=null; render(); $('listen-'+side+'-status').textContent=t('listenFailed');
      };
      try {synth.speak(request);} catch {request.onerror();}
    });
  }
  $('translation-source').addEventListener('input',stop);
  for (const id of ['translation-source-language','translation-target-language','voice-language']) $(id).addEventListener('change',stop);
  host.addEventListener('pagehide',stop);
  render(); return {stop,render};
}
