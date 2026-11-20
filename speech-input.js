// Browser-native speech recognition: no app API key or automatic translation.
export function setupSpeechInput({t, beforeStart = () => {}, host = window, doc = document}) {
  const $ = id => doc.getElementById(id);
  const button = $('voice-input'), source = $('translation-source'), status = $('voice-status');
  const Recognition = host.SpeechRecognition || host.webkitSpeechRecognition;
  let session = null;
  function render() {
    button.disabled = !Recognition;
    button.textContent = t(session ? 'voiceStop' : 'voiceStart');
    button.setAttribute('aria-pressed',String(!!session));
    if (!Recognition) status.textContent=t('voiceUnsupported');
  }
  function stop() {
    const old = session; session=null;
    try {old?.abort();} catch {}
    render();
  }
  button.addEventListener('click',()=>{
    if (session) {
      try {session.stop(); status.textContent=t('voiceFinishing');}
      catch {stop(); status.textContent=t('voiceFailed');}
      return;
    }
    if (!Recognition) return;
    if (host.isSecureContext === false) {status.textContent=t('voiceSecure'); return;}
    beforeStart();
    let recognition;
    try {recognition=new Recognition();} catch {status.textContent=t('voiceFailed'); return;}
    recognition.lang=$('voice-language').value;
    recognition.continuous=true; recognition.interimResults=false;
    let error=false;
    session=recognition; render(); status.textContent=t('voiceStarting');
    recognition.onstart=()=>{if(session===recognition) status.textContent=t('voiceListening');};
    recognition.onresult=event=>{
      if (session!==recognition) return;
      for (let i=event.resultIndex;i<event.results.length;i++) {
        if (!event.results[i].isFinal) continue;
        const text=event.results[i][0].transcript.trim();
        const separator=source.value && !/\s$/.test(source.value) ? ' ' : '';
        const next=source.value+separator+text;
        if (next.length>6000) {stop(); status.textContent=t('voiceLimit'); return;}
        source.value=next;
        source.dispatchEvent(new Event('input',{bubbles:true}));
      }
    };
    recognition.onerror=event=>{
      if (session!==recognition) return;
      error=true; session=null; render();
      status.textContent=t(['not-allowed','service-not-allowed'].includes(event.error)?'voiceDenied':event.error==='no-speech'?'voiceNoSpeech':event.error==='network'?'voiceNetwork':event.error==='audio-capture'?'voiceMicrophone':event.error==='language-not-supported'?'voiceLanguageError':'voiceFailed');
    };
    recognition.onend=()=>{
      if (session!==recognition) return;
      session=null; render(); if (!error) status.textContent=t('voiceStopped');
    };
    try {recognition.start();} catch {stop(); status.textContent=t('voiceFailed');}
  });
  $('voice-language').addEventListener('change',stop);
  $('clear-source').addEventListener('click',stop);
  host.addEventListener('pagehide',stop);
  render(); return {stop,render};
}
