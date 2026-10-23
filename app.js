import { translate } from './translation.js';
import { loadPreferences, savePreferences } from './preferences.js';
import { demos } from './demo.js';
import { initWriting } from './writing-ui.js';

const $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let preferences = loadPreferences(storage);
let mode = 'demo';
let sample = demos[0];
let result = null;
let apiKey = '';
let controller = null;
let generation = 0;
let toastTimer;
const fields = ['source', 'target', 'recipient', 'channel', 'tone'];

function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}

function persist() {
  if (!savePreferences(storage, preferences)) notify('Browser storage is unavailable. Preferences will last only for this visit.');
  window.dispatchEvent(new Event('nuancebridge:settings'));
}

function updateCount() {
  $('character-count').textContent = `${$('source-text').value.length.toLocaleString()} / 6,000`;
}

function setRegister(register = 'translation') {
  if (!result) return;
  $('translation').textContent = register === 'translation' ? result.translation : result.alternatives[register];
  $('output-label').textContent = register === 'translation' ? 'A NATURAL WAY TO SAY IT' : `${register.toUpperCase()} REGISTER`;
  document.querySelectorAll('[data-register]').forEach(button => {
    const active = button.dataset.register === register;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function render(value, context) {
  result = value;
  $('copy').disabled = !value;
  document.querySelectorAll('[data-register]').forEach(button => { button.disabled = !value; });
  $('nuance-card').hidden = !value;
  $('result-context').textContent = context || '';
  $('result-badge').textContent = mode === 'demo' ? 'CURATED DEMO' : value ? 'LIVE AI' : 'READY WHEN YOU ARE';
  $('result-note').textContent = mode === 'demo'
    ? 'An authored example, not a live AI response. No text is sent anywhere in demo mode.'
    : 'AI can miss nuance. Review the meaning before sharing. No translation history is saved by this app.';
  if (value) {
    $('nuance').textContent = value.nuance;
    setRegister();
  } else {
    $('output-label').textContent = 'YOUR NEXT CONVERSATION STARTS HERE';
    $('translation').textContent = 'A new language. The same you.';
  }
}

function setBusy(busy) {
  $('translate').disabled = busy;
  $('cancel').hidden = !busy;
  $('output-panel').setAttribute('aria-busy', String(busy));
  $('source-text').readOnly = mode === 'demo' || busy;
  fields.forEach(id => { $(id).disabled = mode === 'demo' || busy; });
  $('use-profile').disabled = mode === 'demo' || busy;
  $('translate').textContent = busy ? 'Finding the right words…' : mode === 'demo' ? 'Explore this translation ↗' : 'Carry my meaning across ↗';
}

function cancelPending() {
  generation += 1;
  controller?.abort();
  controller = null;
  setBusy(false);
}

function clearError() { $('error').hidden = true; $('error').textContent = ''; }
function invalidate() {
  cancelPending();
  clearError();
  $('request-status').textContent = '';
  if (mode === 'live') render(null);
  updateCount();
}

function loadSample(value) {
  sample = value;
  $('source-text').value = sample.text;
  fields.forEach(id => { $(id).value = sample[id]; });
  updateCount();
  document.querySelectorAll('.example').forEach(button => {
    button.classList.toggle('active', button.dataset.demo === sample.id && mode === 'demo');
    button.setAttribute('aria-pressed', String(button.dataset.demo === sample.id && mode === 'demo'));
  });
  if (mode === 'demo') render(sample, `${sample.tone} · ${sample.recipient} · ${sample.target}`);
}

function setMode(value) {
  cancelPending();
  mode = value;
  clearError();
  $('request-status').textContent = '';
  for (const name of ['demo', 'live']) {
    $(`${name}-mode`).classList.toggle('active', name === mode);
    $(`${name}-mode`).setAttribute('aria-pressed', String(name === mode));
  }
  $('mode-status').replaceChildren();
  $('mode-status').append(document.createElement('span'), document.createTextNode(
    mode === 'demo' ? 'No API key needed' : apiKey ? 'Session key set · live requests may cost credits' : 'Your own API key · connect in settings'));
  $('input-hint').textContent = mode === 'demo' ? 'A curated example. Try another below.' : 'Your text is sent only when you translate.';
  setBusy(false);
  if (mode === 'demo') loadSample(sample);
  else { render(null); document.querySelectorAll('.example').forEach(button => { button.classList.remove('active'); button.setAttribute('aria-pressed', 'false'); }); }
}

async function runTranslation() {
  clearError();
  if (mode === 'demo') { render(sample, `${sample.tone} · ${sample.recipient} · ${sample.target}`); notify('Curated demo — switch to live mode for your own text.'); return; }
  if (!apiKey) { $('settings').showModal(); $('api-key').focus(); return; }
  if (!$('source-text').value.trim()) {
    $('error').textContent = 'Enter something to translate.'; $('error').hidden = false; $('source-text').focus(); return;
  }
  cancelPending();
  const requestId = generation;
  controller = new AbortController();
  const input = { text: $('source-text').value, preferences: preferences.useProfile ? preferences.traits : [] };
  fields.forEach(id => { input[id] = $(id).value; });
  render(null);
  setBusy(true);
  $('request-status').textContent = 'Translating with your context. You can cancel at any time.';
  try {
    const value = await translate(input, { apiKey, model: preferences.model, signal: controller.signal });
    if (requestId !== generation) return;
    render(value, `${input.tone} · ${input.recipient} · ${input.target}`);
    $('request-status').textContent = 'Translation ready. Review the meaning before sharing.';
  } catch (error) {
    if (requestId !== generation) return;
    $('error').textContent = error.message;
    $('error').hidden = false;
    $('request-status').textContent = '';
  } finally {
    if (requestId === generation) { controller = null; setBusy(false); }
  }
}

function renderTraits() {
  $('traits').replaceChildren();
  preferences.traits.forEach((trait, index) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = trait;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove preference ${index + 1}`);
    remove.addEventListener('click', () => {
      preferences.traits.splice(index, 1); persist(); renderTraits();
      if (mode === 'live') invalidate();
      $('profile-status').textContent = 'Preference removed.';
      $('new-trait').focus();
    });
    item.append(label, remove); $('traits').append(item);
  });
  if (!preferences.traits.length) {
    const item = document.createElement('li'); item.textContent = 'Your style starts here. Add a preference below.'; $('traits').append(item);
  }
}

for (const demo of demos) {
  const button = document.createElement('button'); button.className = 'example'; button.dataset.demo = demo.id;
  for (const [tag, className, text] of [['span', 'mono', demo.category], ['strong', '', demo.title], ['span', 'native', demo.native], ['span', 'example-arrow', '↗']]) {
    const node = document.createElement(tag); node.className = className; node.textContent = text; button.append(node);
  }
  button.addEventListener('click', () => { setMode('demo'); loadSample(demo); });
  $('examples').append(button);
}

$('demo-mode').addEventListener('click', () => setMode('demo'));
$('live-mode').addEventListener('click', () => setMode('live'));
$('translate').addEventListener('click', runTranslation);
$('cancel').addEventListener('click', () => { cancelPending(); $('request-status').textContent = 'Translation cancelled. The provider may still charge for work already processed.'; });
$('source-text').addEventListener('input', invalidate);
$('source-text').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !controller) { event.preventDefault(); runTranslation(); } });
fields.forEach(id => $(id).addEventListener('change', invalidate));
$('use-profile').checked = preferences.useProfile;
$('use-profile').addEventListener('change', () => { preferences.useProfile = $('use-profile').checked; persist(); invalidate(); });
$('open-settings').addEventListener('click', () => {
  $('model').value = preferences.model; $('api-key').value = '';
  $('connection-note').textContent = apiKey ? 'A session key is set. Leave the key field blank to keep it, or paste a replacement.' : 'No key connected. Demo mode always works without one.';
  $('settings').showModal();
});
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('model').value.trim()) { $('model').setCustomValidity('Enter a model ID.'); $('model').reportValidity(); return; }
  cancelPending();
  const enteredKey = $('api-key').value.trim();
  if (enteredKey) apiKey = enteredKey;
  $('api-key').value = '';
  preferences.model = $('model').value.trim(); persist();
  $('settings').close(); setMode(mode);
  notify(apiKey ? 'Settings saved. Key set for this visit; not yet verified.' : 'Model saved. Add a key to use live mode.');
});
$('model').addEventListener('input', () => $('model').setCustomValidity(''));
$('disconnect').addEventListener('click', () => { cancelPending(); apiKey = ''; $('api-key').value = ''; $('connection-note').textContent = 'Key forgotten.'; setMode(mode); window.dispatchEvent(new Event('nuancebridge:settings')); });
$('settings').addEventListener('close', () => { $('api-key').value = ''; });
$('open-profile').addEventListener('click', () => { renderTraits(); $('profile-status').textContent = ''; $('profile').showModal(); });
$('trait-form').addEventListener('submit', event => {
  event.preventDefault(); const trait = $('new-trait').value.trim();
  if (!trait) return;
  if (preferences.traits.length >= 12) { $('profile-status').textContent = 'Remove a preference before adding another (maximum 12).'; return; }
  if (preferences.traits.includes(trait)) { $('profile-status').textContent = 'That preference is already saved.'; return; }
  preferences.traits.push(trait); persist(); renderTraits(); $('new-trait').value = '';
  if (mode === 'live') invalidate();
  $('profile-status').textContent = 'Preference saved in this browser.';
});
$('reset-profile').addEventListener('click', () => { preferences.traits = []; persist(); renderTraits(); if (mode === 'live') invalidate(); $('profile-status').textContent = 'All style preferences cleared.'; });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
document.querySelectorAll('[data-register]').forEach(button => button.addEventListener('click', () => setRegister(button.dataset.register)));
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('translation').textContent); notify('Copied. Ready for your next conversation.'); }
  catch { notify('Clipboard unavailable. Select the translation text to copy it.'); }
});
window.addEventListener('pagehide', () => { apiKey = ''; $('api-key').value = ''; cancelPending(); });
window.addEventListener('pageshow', event => { if (event.persisted) setMode(mode); });
$('model').value = preferences.model;
setMode('demo');
initWriting({ getConnection: () => ({ apiKey, model: preferences.model }), getPreferences: () => preferences, notify });
