import { createSession, protectSpan, unprotectSpan, editDraft, applySuggestion, startingDraft, recordFeedback, undo, rebaseSuggestions } from './writing-session.js';
import { reviewWriting } from './review-api.js';
import { writingDemos, demoReview } from './writing-demo.js';

const $ = id => document.getElementById(id);
const make = (tag, text, className = '') => {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};

export function initWriting({ getConnection, getPreferences, notify }) {
  let session = createSession();
  let demo = true, sample = writingDemos[0], suggestions = [], selection = null;
  let epoch = 0, controller = null, preview = null;
  let voice = { sample: '', enabled: true };
  try {
    const saved = JSON.parse(localStorage.getItem('nuancebridge.voice.v1'));
    if (typeof saved?.sample === 'string' && saved.sample.length <= 1000) voice.sample = saved.sample;
    if (typeof saved?.enabled === 'boolean') voice.enabled = saved.enabled;
  } catch { /* Memory-only fallback when browser storage is unavailable. */ }

  const contextIds = ['writing-intent', 'writing-avoid', 'writing-recipient', 'writing-relationship', 'writing-channel', 'writing-target', 'explanation-language', 'writing-scope', 'back-language'];
  const actionIds = ['analyze-writing', 'starting-draft', 'check-meaning', 'back-translate'];
  function error(message = '') { $('writing-error').textContent = message; $('writing-error').hidden = !message; }
  function busy(value) {
    actionIds.forEach(id => { $(id).disabled = value; });
    $('writing-cancel').hidden = !value; $('suggestions-panel').setAttribute('aria-busy', String(value));
  }
  function cancel() { epoch++; controller?.abort(); controller = null; busy(false); }
  function invalidate() {
    cancel(); suggestions = []; preview = null; $('reflection-result').replaceChildren();
    $('suggestion-summary').textContent = 'The draft or context changed. Request a fresh review when you are ready.';
    $('writing-status').textContent = ''; error(); renderSuggestions();
  }
  function updateSession() {
    $('writing-draft').value = session.text;
    $('writing-count').textContent = `${session.text.length.toLocaleString()} / 6,000`;
    $('writing-selection').textContent = selection ? `${selection.end - selection.start} characters selected. Keep them, or choose “Only my selected passage”.` : 'Select a phrase to protect it or request a focused edit.';
    $('writing-undo').disabled = !session.history.length;
    $('copy-draft').disabled = !$('writing-draft').value.trim();
    $('download-draft').disabled = !$('writing-draft').value.trim();
    $('original-text').textContent = session.original || 'Your original is captured when you first request guidance.';
    $('writing-session-info').textContent = `Revision ${session.revision} · ${session.feedback.length} session decisions · nothing auto-saved`;
    $('protected-phrases').replaceChildren();
    if (!session.protected.length) $('protected-phrases').append(make('span', 'No protected words yet. Select an expression above to keep it.', 'help'));
    session.protected.forEach((span, index) => {
      const button = make('button', `${span.text} ×`, 'protected-chip'); button.type = 'button';
      button.setAttribute('aria-label', `Unprotect ${span.text}`);
      button.addEventListener('click', () => { session = unprotectSpan(session, index); selection = null; invalidate(); updateSession(); });
      $('protected-phrases').append(button);
    });
    $('session-feedback').replaceChildren();
    if (session.feedback.length) {
      $('session-feedback').append(make('strong', 'What you have told your companion'));
      session.feedback.slice(-4).forEach(item => $('session-feedback').append(make('p', `${item.action}: ${item.reason || 'No reason specified; no style preference inferred.'}`)));
    }
  }
  function renderSuggestions() {
    $('writing-suggestions').replaceChildren(); $('suggestion-count').textContent = `${suggestions.length} to consider`;
    if (!suggestions.length) {
      $('writing-suggestions').append(make('p', 'No pending changes. You can keep your draft, ask for feedback, or explore a guided example.', 'empty-suggestions')); return;
    }
    suggestions.forEach((item, index) => {
      const card = make('article', '', 'suggestion-card');
      card.append(make('p', `OPTION ${index + 1} · ONLY THIS PASSAGE`, 'eyebrow'), make('del', item.original, 'suggestion-before'));
      const replacement = make('textarea', '', 'suggestion-replacement'); replacement.value = item.replacement;
      replacement.maxLength = 6000; replacement.rows = 2; replacement.dir = 'auto';
      replacement.setAttribute('aria-label', `Edit replacement ${index + 1}`); card.append(replacement);
      for (const [label, value] of [['Why', item.reason], ['Tradeoff', item.tradeoff], ['Possible reader impression', item.reader]]) {
        const row = make('p', '', 'suggestion-explanation'); row.append(make('strong', `${label}: `), document.createTextNode(value)); card.append(row);
      }
      const reasonLabel = make('label', 'Your feedback (optional)');
      const reason = make('select', ''); reason.setAttribute('aria-label', `Feedback for option ${index + 1}`);
      for (const value of ['', 'Too formal', 'Too casual', 'Does not sound like me', 'Changes my meaning', 'Loses cultural expression', 'Already clear', 'This sounds like me']) {
        const option = make('option', value || 'Choose a reason'); option.value = value; reason.append(option);
      }
      reasonLabel.append(reason); card.append(reasonLabel);
      const actions = make('div', '', 'suggestion-actions');
      const accept = make('button', 'Accept / apply my edit', 'button small primary');
      const reject = make('button', 'Reject', 'button small outline');
      accept.addEventListener('click', () => {
        try {
          cancel(); const edited = replacement.value !== item.replacement;
          session = applySuggestion(session, item, replacement.value);
          session = recordFeedback(session, edited ? 'edited' : 'accepted', reason.value, item.original);
          suggestions = rebaseSuggestions(suggestions, item, session, replacement.value);
          selection = null; $('reflection-result').replaceChildren(); updateSession(); renderSuggestions(); error();
          $('writing-status').textContent = 'Only that passage changed. The remaining suggestions have been aligned with your new draft.';
          $('analyze-writing').focus();
        } catch (issue) { error(issue.message); }
      });
      reject.addEventListener('click', () => {
        cancel(); session = recordFeedback(session, 'rejected', reason.value, item.original);
        suggestions = suggestions.filter(value => value !== item); updateSession(); renderSuggestions();
        $('writing-status').textContent = 'Suggestion rejected. Your draft is unchanged; your feedback guides the next review.';
        $('analyze-writing').focus();
      });
      actions.append(accept, reject); card.append(actions); $('writing-suggestions').append(card);
    });
  }
  function inputData() {
    return { ...session, intent: $('writing-intent').value, avoid: $('writing-avoid').value,
      recipient: $('writing-recipient').value, relationship: $('writing-relationship').value,
      channel: $('writing-channel').value, target: $('writing-target').value,
      explanationLanguage: $('explanation-language').value, backLanguage: $('back-language').value,
      scope: $('writing-scope').value, selection,
      preferences: voice.enabled ? getPreferences().traits : [], voiceSamples: voice.enabled && voice.sample ? [voice.sample] : [],
    };
  }
  async function run(action) {
    error();
    if (!session.text.trim()) { error('Write something first. English, another language, or a mixture is welcome.'); $('writing-draft').focus(); return; }
    if (action === 'analyze' && $('writing-scope').value === 'selection' && !selection) { error('Select a passage in your draft first.'); return; }
    const connection = getConnection();
    if (!demo && !connection.apiKey) { $('open-settings').click(); return; }
    cancel(); const requestEpoch = epoch;
    if (!session.original) session = { ...session, original: session.text };
    const input = inputData(); controller = new AbortController(); busy(true);
    $('writing-status').textContent = demo ? 'Exploring authored guidance. No AI request is made.' : 'Considering your intention and choices…';
    try {
      const output = demo ? demoReview(action, input, sample, input.explanationLanguage)
        : await reviewWriting(action, input, { ...connection, signal: controller.signal });
      if (requestEpoch !== epoch) return;
      if (action === 'analyze') {
        suggestions = output.suggestions; $('suggestion-summary').textContent = output.summary; renderSuggestions();
        $('writing-status').textContent = suggestions.length ? 'Nothing has changed yet. You choose which suggestions to use.' : 'No safe changes are suggested. Keeping your wording is a valid choice.';
      } else if (action === 'start') {
        startingDraft(session, output.draft); preview = { text: output.draft, revision: session.revision, epoch };
        $('starting-preview-text').textContent = output.draft; $('starting-preview').showModal();
        $('writing-status').textContent = 'Review the starting draft before choosing whether to use it.';
      } else {
        $('reflection-result').replaceChildren();
        const entries = action === 'back' ? [['Back-translation · reflection only', output.text]]
          : [['Meaning check', output.meaning], ['Possible reader perspective', output.reader], ...output.questions.map(q => ['A question to consider', q])];
        for (const [title, value] of entries) { const block = make('div', '', 'reflection-block'); block.append(make('h4', title), make('p', value)); $('reflection-result').append(block); }
        $('writing-status').textContent = demo ? 'Authored demo reflection; not a live assessment of your edits.' : 'Reflection ready. Your interpretation has the final say.';
      }
      updateSession();
    } catch (issue) { if (requestEpoch === epoch) { error(issue.message); $('writing-status').textContent = ''; } }
    finally { if (requestEpoch === epoch) { controller = null; busy(false); } }
  }
  function loadDemo(value) {
    demo = true; sample = value; session = createSession(value.text);
    const start = session.text.indexOf(value.protect); session = protectSpan(session, start, start + value.protect.length);
    $('writing-intent').value = value.intent; $('writing-avoid').value = value.avoid;
    $('writing-recipient').value = value.recipient; $('writing-relationship').value = value.relationship;
    $('writing-target').value = 'English'; $('writing-scope').value = 'light'; selection = null;
    invalidate(); updateMode(); updateSession(); run('analyze');
  }
  function updateMode() {
    $('writing-badge').textContent = demo ? 'CURATED DEMO · EDITABLE' : 'PERSONAL LIVE MODE';
    for (const [id, active] of [['writing-demo-mode', demo], ['writing-live-mode', !demo]]) { $(id).classList.toggle('active', active); $(id).setAttribute('aria-pressed', String(active)); }
    document.querySelectorAll('[data-writing-demo]').forEach(button => { button.classList.toggle('active', demo && sample?.id === button.dataset.writingDemo); });
  }
  function download(name, content) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function saveVoice() {
    try { localStorage.setItem('nuancebridge.voice.v1', JSON.stringify(voice)); return true; }
    catch { $('voice-status').textContent = 'Storage is unavailable. The example is available for this visit only.'; return false; }
  }
  // Reuse the existing 28-language menu without maintaining a third separate list.
  $('writing-target').replaceChildren(...[...$('target').options].map(option => option.cloneNode(true)));
  for (const value of writingDemos) {
    const button = make('button', '', 'writing-example'); button.dataset.writingDemo = value.id;
    button.append(make('span', value.culture, 'mono'), make('strong', value.title), make('span', 'Explore ↗'));
    button.addEventListener('click', () => {
      if (session.text && (!demo || session.text !== sample?.text) && !confirm('Load this example? Your current session will be replaced. Download your draft first if you want to keep it.')) return;
      loadDemo(value);
    }); $('writing-examples').append(button);
  }
  $('writing-live-mode').addEventListener('click', () => {
    if (!demo) return;
    demo = false; sample = null; invalidate(); updateMode(); updateSession();
    $('writing-status').textContent = 'You can keep editing this draft, or replace it with your own. Add a session key when you want AI feedback.';
    $('writing-draft').focus();
  });
  $('new-writing-session').addEventListener('click', () => {
    if (session.text && !confirm('Start a new draft? Download your current draft first if you want to keep it.')) return;
    session = createSession(); sample = null; demo = false; selection = null;
    for (const id of ['writing-intent', 'writing-avoid', 'writing-recipient', 'writing-relationship']) $(id).value = '';
    $('writing-scope').value = 'light'; invalidate(); updateMode(); updateSession(); $('writing-draft').focus();
    $('writing-status').textContent = 'New writing session. Your original is captured when you first request guidance.';
  });
  $('writing-demo-mode').addEventListener('click', () => {
    if (demo) return;
    if (session.text && !confirm('Load the guided example? Your current session will be replaced.')) return;
    loadDemo(writingDemos[0]);
  });
  $('writing-draft').addEventListener('input', () => {
    try { session = editDraft(session, $('writing-draft').value); selection = null; invalidate(); updateSession(); }
    catch (issue) { $('writing-draft').value = session.text; error(issue.message); }
  });
  $('writing-draft').addEventListener('select', () => {
    const start = $('writing-draft').selectionStart, end = $('writing-draft').selectionEnd;
    const previous = selection;
    selection = start < end ? { start, end } : null;
    $('writing-selection').textContent = selection ? `${end - start} characters selected. Keep them, or choose “Only my selected passage”.` : 'Select a phrase to protect it or request a focused edit.';
    if ($('writing-scope').value === 'selection' && (previous?.start !== selection?.start || previous?.end !== selection?.end)) invalidate();
  });
  $('writing-draft').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !controller) { event.preventDefault(); run('analyze'); } });
  $('protect-selection').addEventListener('click', () => {
    try { if (!selection) throw new Error('Select the expression you want to keep in your draft first.'); session = protectSpan(session, selection.start, selection.end); selection = null; invalidate(); updateSession(); }
    catch (issue) { error(issue.message); }
  });
  $('writing-undo').addEventListener('click', () => { session = undo(session); selection = null; invalidate(); updateSession(); $('writing-status').textContent = 'Last change undone. Request fresh guidance for this version.'; });
  $('show-original').addEventListener('click', () => { $('original-panel').hidden = !$('original-panel').hidden; });
  contextIds.forEach(id => $(id).addEventListener('input', invalidate));
  for (const [id, action] of [['analyze-writing', 'analyze'], ['starting-draft', 'start'], ['check-meaning', 'reflect'], ['back-translate', 'back']]) $(id).addEventListener('click', () => run(action));
  $('writing-cancel').addEventListener('click', () => { cancel(); $('writing-status').textContent = 'Request cancelled. Provider work already processed may still incur charges.'; });
  $('accept-starting').addEventListener('click', () => {
    try { if (!preview || preview.revision !== session.revision || preview.epoch !== epoch) throw new Error('This preview is stale. Request a new starting draft.'); session = startingDraft(session, preview.text); selection = null; $('starting-preview').close(); invalidate(); updateSession(); $('writing-status').textContent = 'Starting draft applied by your choice. Your original and undo remain available.'; }
    catch (issue) { $('starting-preview').close(); error(issue.message); }
  });
  $('copy-draft').addEventListener('click', async () => { try { await navigator.clipboard.writeText(session.text); notify('Draft copied. Your words, your choices.'); } catch { error('Clipboard unavailable. Select and copy the draft text.'); } });
  $('download-draft').addEventListener('click', () => download('nuancebridge-draft.txt', session.text));
  $('peer-review').addEventListener('click', () => $('peer-dialog').showModal());
  $('download-peer').addEventListener('click', () => download('nuancebridge-peer-review.txt', `NUANCEBRIDGE · HUMAN REVIEW COPY\n\nIntention: ${$('writing-intent').value}\nAvoid: ${$('writing-avoid').value}\n\nProtected expressions: ${session.protected.map(p => p.text).join(' / ')}\n\nDRAFT\n${session.text}\n\nQuestions for you:\nDoes this sound like me?\nIs any meaning or cultural expression lost?\nHow might you interpret the tone?\n\nPlease send your feedback to the writer. This file does not sync automatically.`));
  $('save-peer').addEventListener('click', () => {
    const notes = $('peer-notes').value.trim(); if (!notes) { $('peer-notes').focus(); return; }
    session = recordFeedback(session, 'peer', notes); $('peer-notes').value = ''; $('peer-dialog').close(); invalidate(); updateSession(); notify('Human feedback added to this session. Your draft is unchanged.');
  });
  $('writing-style').addEventListener('click', () => { $('voice-sample').value = voice.sample; $('use-voice').checked = voice.enabled; $('voice-status').textContent = ''; $('voice-dialog').showModal(); });
  $('use-voice').addEventListener('change', () => { voice.enabled = $('use-voice').checked; saveVoice(); invalidate(); });
  $('save-voice').addEventListener('click', () => { voice.sample = $('voice-sample').value.trim(); if (saveVoice()) $('voice-status').textContent = 'Example explicitly saved on this browser. You can forget it at any time.'; invalidate(); });
  $('clear-voice').addEventListener('click', () => { voice.sample = ''; $('voice-sample').value = ''; saveVoice(); invalidate(); $('voice-status').textContent = 'Saved voice example cleared.'; });
  $('edit-style-from-writing').addEventListener('click', () => { $('voice-dialog').close(); $('open-profile').click(); });
  window.addEventListener('nuancebridge:settings', invalidate);
  window.addEventListener('pagehide', cancel);
  loadDemo(writingDemos[0]);
}
