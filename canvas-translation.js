import { translate } from './translation.js';

// Translation previews never mutate the writing canvas until explicit adoption.
export function setupTranslation({ t, connection, preferences, connect, onOutputChange = () => {} }) {
  const $ = id => document.getElementById(id);
  let result = null, version = 'translation', supplied = [], controller = null, generation = 0;
  const edits = new Map();
  const current = () => result ? (edits.get(version)?.value ?? (version === 'translation' ? result.translation : result.alternatives[version])) : '';
  function renderOutput() {
    $('output-status').textContent = '';
    onOutputChange();
    $('translation-output').value = current();
    $('output-empty').hidden = !!result;
    $('copy-output').disabled = !result;
    $('undo-output').disabled = !edits.get(version)?.history.length;
  }
  const fields = ['source', 'source-language', 'target-language', 'recipient', 'channel', 'tone', 'use-habits'];
  const message = key => { $('translation-status').textContent = t(key); };
  function cancel() {
    generation++; controller?.abort(); controller = null;
    $('translation-submit').disabled = false; $('translation-cancel').hidden = true;
  }
  function invalidate() {
    cancel(); result = null; edits.clear(); $('translation-result').hidden = true; renderOutput(); message('translationChanged');
  }
  function render() {
    $('translation-result').hidden = !result;
    renderOutput();
    if (!result) return;
    $('translation-origin').textContent = t('translationLive');
    $('translation-nuance').textContent = result.nuance;
    $('translation-preferences').textContent = supplied.length ? t('suppliedPreferences') + ' ' + supplied.join(' · ') : t('noPreferences');
    const tabs = $('translation-versions'); tabs.replaceChildren();
    for (const name of ['translation', 'casual', 'direct', 'formal']) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = t('version_' + name);
      button.setAttribute('aria-pressed', String(name === version));
      button.addEventListener('click', () => { version = name; renderOutput(); for (const tab of tabs.children) tab.setAttribute('aria-pressed', String(tab === button)); }); tabs.append(button);
    }
  }
  for (const field of fields) $('translation-' + field).addEventListener('input', invalidate);
  $('canvas-translation-form').addEventListener('submit', async event => {
    event.preventDefault();
    const { apiKey, model, hosted = false } = connection();
    if (!apiKey && !hosted) { connect(); message('translationConnect'); return; }
    cancel(); result = null; edits.clear(); $('translation-result').hidden = true; renderOutput();
    const id = generation; controller = new AbortController();
    supplied = $('translation-use-habits').checked ? [...preferences()] : [];
    const input = { text:$('translation-source').value, source:$('translation-source-language').value,
      target:$('translation-target-language').value, recipient:$('translation-recipient').value,
      channel:$('translation-channel').value, tone:$('translation-tone').value, preferences:supplied };
    $('translation-submit').disabled = true; $('translation-cancel').hidden = false; message('translationBusy');
    try {
      const next = await translate(input, { apiKey, model, hosted, signal:controller.signal });
      if (id !== generation) return;
      result = next; version = 'translation'; render(); message('translationReady');
    } catch (error) { if (id === generation) $('translation-status').textContent = error.message; }
    finally { if (id === generation) { controller = null; $('translation-submit').disabled = false; $('translation-cancel').hidden = true; } }
  });
  $('translation-cancel').addEventListener('click', () => { cancel(); message('cancelled'); });
  $('clear-source').addEventListener('click', () => {
    $('translation-source').value = ''; invalidate(); $('translation-source').focus();
  });
  $('copy-output').addEventListener('click', async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(current()); $('output-status').textContent = t('outputCopied'); }
    catch { $('output-status').textContent = t('outputCopyFailed'); }
  });
  $('undo-output').addEventListener('click', () => {
    const edit = edits.get(version);
    if (!edit?.history.length) return;
    edit.value = edit.history.pop(); renderOutput();
    $('output-status').textContent = t('outputUndone'); $('translation-output').focus();
  });
  render();
  return { render, invalidate, cancel, replace(before, start, end, replacement) {
    if (!result || current() !== before || start < 0 || end > before.length || start >= end) return false;
    const value = before.slice(0, start) + replacement + before.slice(end);
    if (!value.trim() || value.length > 30000 || value === before) return false;
    const history = edits.get(version)?.history ?? [];
    edits.set(version, {value, history:[...history.slice(-19), before]});
    renderOutput();
    $('output-status').textContent = t('outputReplaced'); return true;
  } };

}
