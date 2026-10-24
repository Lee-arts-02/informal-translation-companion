import { $ } from './ui-helpers.js';
export function initWritingVoice(changed) {
  const voice = { sample: '', enabled: true };
  try {
    const saved = JSON.parse(localStorage.getItem('nuancebridge.voice.v1'));
    if (typeof saved?.sample === 'string' && saved.sample.length <= 1000) voice.sample = saved.sample;
    if (typeof saved?.enabled === 'boolean') voice.enabled = saved.enabled;
  } catch { /* Optional sample; drafts are never auto-captured as the user's style. */ }
  function save() {
    try { localStorage.setItem('nuancebridge.voice.v1', JSON.stringify(voice)); $('voice-status').textContent = 'Your chosen sample is saved on this browser.'; }
    catch { $('voice-status').textContent = 'Storage unavailable; the sample lasts for this visit only.'; }
    changed();
  }
  $('voice-sample').value = voice.sample; $('use-voice').checked = voice.enabled;
  $('use-voice').addEventListener('change', () => { voice.enabled = $('use-voice').checked; save(); });
  $('save-voice').addEventListener('click', () => { voice.sample = $('voice-sample').value.trim(); save(); });
  $('clear-voice').addEventListener('click', () => { voice.sample = ''; $('voice-sample').value = ''; save(); });
  $('edit-style-from-writing').addEventListener('click', () => { $('voice-dialog').close(); $('open-habits').click(); });
  return { get: () => voice, setEnabled(value) { voice.enabled = value; $('use-voice').checked = value; save(); } };
}
