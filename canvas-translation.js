import { demos } from './demo.js';
import { translate } from './translation.js';

// Translation previews never mutate the writing canvas until explicit adoption.
export function setupTranslation({ t, connection, preferences, connect, adopt }) {
  const $ = id => document.getElementById(id);
  let result = null, version = 'translation', source = '', supplied = [], controller = null, generation = 0;
  const fields = ['source', 'source-language', 'target-language', 'recipient', 'channel', 'tone', 'use-habits'];
  const message = key => { $('translation-status').textContent = t(key); };
  function cancel() {
    generation++; controller?.abort(); controller = null;
    $('translation-submit').disabled = false; $('translation-cancel').hidden = true;
  }
  function invalidate() {
    cancel(); result = null; $('translation-result').hidden = true; message('translationChanged');
  }
  function render() {
    $('scenario-presets').replaceChildren();
    for (const demo of demos) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = t(`scenario_${demo.id}`);
      button.addEventListener('click', () => {
        if ($('translation-source').value.trim() && !confirm(t('replaceThought'))) return;
        cancel();
        for (const [field, value] of Object.entries({source:demo.text, 'source-language':demo.source,
          'target-language':demo.target, recipient:demo.recipient, channel:demo.channel, tone:demo.tone})) $('translation-' + field).value = value;
        result = demo; source = 'example'; version = 'translation'; supplied = []; render(); message('scenarioReady');
      });
      $('scenario-presets').append(button);
    }
    $('translation-result').hidden = !result;
    if (!result) return;
    $('translation-origin').textContent = t(source === 'example' ? 'modeExample' : 'translationLive');
    $('translation-output').textContent = version === 'translation' ? result.translation : result.alternatives[version];
    $('translation-nuance').textContent = result.nuance;
    $('translation-preferences').textContent = source === 'example' ? t('examplePreferences')
      : supplied.length ? t('suppliedPreferences') + ' ' + supplied.join(' · ') : t('noPreferences');
    $('translation-versions').replaceChildren();
    for (const name of ['translation', 'casual', 'direct', 'formal']) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = t('version_' + name);
      button.setAttribute('aria-pressed', String(name === version));
      button.addEventListener('click', () => { version = name; render(); }); $('translation-versions').append(button);
    }
  }
  for (const field of fields) $('translation-' + field).addEventListener('input', invalidate);
  $('canvas-translation-form').addEventListener('submit', async event => {
    event.preventDefault();
    const { apiKey, model } = connection();
    if (!apiKey) { connect(); message('translationConnect'); return; }
    cancel(); result = null; $('translation-result').hidden = true;
    const id = generation; controller = new AbortController();
    supplied = $('translation-use-habits').checked ? [...preferences()] : [];
    const input = { text:$('translation-source').value, source:$('translation-source-language').value,
      target:$('translation-target-language').value, recipient:$('translation-recipient').value,
      channel:$('translation-channel').value, tone:$('translation-tone').value, preferences:supplied };
    $('translation-submit').disabled = true; $('translation-cancel').hidden = false; message('translationBusy');
    try {
      const next = await translate(input, { apiKey, model, signal:controller.signal });
      if (id !== generation) return;
      result = next; source = 'live'; version = 'translation'; render(); message('translationReady');
    } catch (error) { if (id === generation) $('translation-status').textContent = error.message; }
    finally { if (id === generation) { controller = null; $('translation-submit').disabled = false; $('translation-cancel').hidden = true; } }
  });
  $('translation-cancel').addEventListener('click', () => { cancel(); message('cancelled'); });
  $('translation-apply').addEventListener('click', () => {
    if (!result) return;
    const value = version === 'translation' ? result.translation : result.alternatives[version];
    if (value.length > 6000) { message('translationTooLong'); return; }
    if (adopt(value)) message('translationUsed');
  });
  render();
  return { render, invalidate, cancel };
}
