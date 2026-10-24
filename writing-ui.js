import { createSession, protectSpan, unprotectSpan, editDraft, applySuggestion, startingDraft, recordFeedback, undo, rebaseSuggestions } from './writing-session.js';
import { reviewWriting } from './review-api.js';
import { writingDemos, demoReview } from './writing-demo.js';
import { $, make, button, download, showPanel } from './ui-helpers.js';
import { initMemories } from './memory-ui.js';
import { initIntentPanel } from './intent-ui.js';
import { addEvent, makeSnapshot, snapshotCurrent, checkReviewed } from './workflow-state.js';
import { initWritingVoice } from './writing-voice.js';
import { renderOptions, renderEvents } from './writing-panels.js';
import { renderSelection } from './selection-ui.js';
import { initFlowGuide } from './flow-ui.js';
import { confirmedIntentions } from './intent-state.js';

export function initWriting({ getConnection, notify }) {
  let session = createSession(), demo = false, sample = null, suggestions = [], selection = null;
  let epoch = 0, controller = null, preview = null, snapshot = null, flagged = '', events = [], candidate = null;
  let lastInputs = null, guide = null, reviewedId = null;
  const contextIds = ['writing-intent', 'writing-avoid', 'writing-recipient', 'writing-relationship', 'writing-channel', 'writing-target', 'explanation-language', 'writing-scope', 'back-language', 'allow-mix'];
  const actionIds = ['analyze-writing', 'starting-draft', 'check-meaning', 'back-translate', 'extract-intents', 'repair-writing'];
  function fail(message = '') { for (const id of ['writing-error', 'companion-error']) { $(id).textContent = message; $(id).hidden = !message; } }
  function busy(value) {
    actionIds.forEach(id => { $(id).disabled = value; });
    $('writing-cancel').hidden = !value; $('suggestions-panel').setAttribute('aria-busy', String(value));
    if (!value && memory && intents) refreshSnapshot();
    if (memory && intents) renderSelection(session, selection, $('writing-target').value, value);
  }
  function cancel() { epoch++; controller?.abort(); controller = null; busy(false); }
  const context = () => ({ recipient: $('writing-recipient').value, channel: $('writing-channel').value, target: $('writing-target').value });
  for (const id of ['writing-target', 'back-language']) $(id).replaceChildren(...[...$('target').options].map(x => x.cloneNode(true)));
  $('back-language').value = 'Chinese (Simplified)';
  const voice = initWritingVoice(() => invalidate());
  const memory = initMemories({ context, changed: () => invalidate(), event: log, notify, enabled: () => voice.get().enabled });
  const intents = initIntentPanel({ changed: () => invalidate(), event: log, fail, remember: rememberCandidate, getRevision: () => session.revision });
  function inputData() {
    const habits = voice.get().enabled ? memory.matched() : [];
    return { ...session, ...context(), intent: $('writing-intent').value, avoid: $('writing-avoid').value,
      relationship: $('writing-relationship').value, explanationLanguage: $('explanation-language').value,
      backLanguage: $('back-language').value, scope: $('writing-scope').value, selection,
      preferences: habits.map(item => item.content), intentions: confirmedIntentions(intents.get()), allowMix: $('allow-mix').checked,
      voiceSamples: voice.get().enabled && voice.get().sample ? [voice.get().sample] : [] };
  }
  function signature() {
    return JSON.stringify({ context: contextIds.map(id => $(id).type === 'checkbox' ? $(id).checked : $(id).value), intentions: confirmedIntentions(intents.get()), habits: memory.matched(), voice: voice.get() });
  }
  function snapshotInput() { return { text: session.text, revision: session.revision, backLanguage: $('back-language').value, signature: signature() }; }
  function refreshSnapshot() {
    $('check-current-draft').textContent = session.text || 'Your current draft will appear here.';
    if (!snapshot) { $('snapshot-status').textContent = 'First, create a view in a familiar language. Your draft will stay unchanged.'; $('snapshot-status').classList.remove('stale'); $('repair-writing').disabled = true; $('mark-check-reviewed').disabled = true; $('check-reviewed-status').textContent = ''; $('repair-help').textContent = 'Create a language check, then describe any mismatch. Nothing changes until you accept a fix.'; refreshFlow(); return; }
    const fresh = snapshotCurrent(snapshot, snapshotInput());
    $('snapshot-status').textContent = fresh ? `Current check · revision ${snapshot.revision} · ${snapshot.language}` : `Earlier check · revision ${snapshot.revision}. Draft or context changed — check again before repairing.`;
    $('snapshot-status').classList.toggle('stale', !fresh); $('repair-writing').disabled = !fresh || Boolean(controller) || !$('correction-note').value.trim();
    $('mark-check-reviewed').disabled = !fresh || Boolean(controller);
    $('check-reviewed-status').textContent = checkReviewed(snapshot, snapshotInput(), reviewedId) ? 'Reviewed by you for this version. You can copy or keep editing.' : 'Not yet reviewed by you for the current wording and context.';
    $('repair-help').textContent = fresh ? 'Describe the mismatch to preview a local fix. You accept each edit; nothing is changed automatically.' : 'Create an updated check before requesting a repair. Your earlier notes are kept.';
    refreshFlow();
  }
  function refreshFlow() {
    guide?.refresh({ text: session.text, goal: $('writing-intent').value, avoid: $('writing-avoid').value, intentions: intents.get(),
      habits: voice.get().enabled ? memory.matched() : [], hasSample: Boolean(voice.get().enabled && voice.get().sample),
      snapshot, fresh: snapshotCurrent(snapshot, snapshotInput()), reviewed: checkReviewed(snapshot, snapshotInput(), reviewedId),
      suggestions: suggestions.length, candidate, lastInputs, signature: signature(), revision: session.revision, demo });
  }
  function updateContext() { $('context-summary').textContent = [context().recipient, context().channel, $('writing-intent').value].filter(Boolean).join(' · ').slice(0, 100) || 'Add a little context, if you like'; }
  function invalidate() {
    cancel(); suggestions = []; preview = null; candidate = null; $('memory-nudge').hidden = true;
    $('reflection-result').replaceChildren(); $('writing-status').textContent = '';
    $('selection-feedback').textContent = '';
    $('habit-conflicts').replaceChildren();
    $('suggestion-summary').textContent = 'Ready when you are. Ask for fresh suggestions after a change.';
    fail(); renderSuggestions(); memory.refresh(); refreshSnapshot(); updateContext(); $('use-writing-habits').checked = voice.get().enabled; refreshFlow();
  }
  function log(data) { events = addEvent(events, { revision: session.revision, ...data }); if (!$('panel-history').hidden) renderEvents(events); return events.at(-1); }
  function updateSession() {
    if ($('writing-draft').value !== session.text) $('writing-draft').value = session.text;
    $('writing-count').textContent = `${session.text.length.toLocaleString()} / 6,000`;
    $('writing-undo').disabled = !session.history.length;
    for (const id of ['copy-draft', 'download-draft']) $(id).disabled = !session.text.trim();
    $('original-text').textContent = session.original || 'Your original is captured when you first ask for help.';
    $('writing-session-info').textContent = `Revision ${session.revision} · ${events.length} session events · draft stays in this tab`;
    $('writing-badge').textContent = demo ? 'AUTHORED EXAMPLE' : 'YOUR DRAFT';
    for (const [id, active] of [['writing-demo-mode', demo], ['writing-live-mode', !demo]]) { $(id).classList.toggle('active', active); $(id).setAttribute('aria-pressed', String(active)); }
    $('protected-phrases').replaceChildren();
    for (const [index, span] of session.protected.entries()) $('protected-phrases').append(button(`Keep: ${span.text} ×`, () => {
      session = unprotectSpan(session, index); log({ kind: 'protection-removed', note: span.text }); selection = null; invalidate(); updateSession();
    }, 'protected-chip'));
    renderSelection(session, selection, $('writing-target').value, Boolean(controller));
    $('session-feedback').replaceChildren();
    if (session.feedback.length) $('session-feedback').append(make('p', `Latest feedback: ${session.feedback.at(-1).reason || session.feedback.at(-1).action}. Session only.`));
    memory.refresh(); refreshSnapshot(); updateContext();
  }
  function rememberCandidate(data) { memory.open({ ...data, scope: data.scope || context() }); }
  function renderSuggestions() {
    renderOptions({ suggestions, intentions: intents.get(), apply, reject });
  }
  function apply(item, replacement, reason) {
    try {
      cancel(); session = applySuggestion(session, item, replacement);
      session = recordFeedback(session, replacement === item.replacement ? 'accepted' : 'edited', reason || item.correction || '', item.original);
      const event = log({ kind: replacement === item.replacement ? 'accepted' : 'edited', before: item.original, proposed: item.replacement, after: replacement, note: reason || item.correction || '', habits: item.habits, source: item.source });
      suggestions = rebaseSuggestions(suggestions, item, session, replacement); selection = null; preview = null;
      $('reflection-result').replaceChildren(); updateSession(); renderSuggestions(); fail();
      const content = item.correction || reason || intents.get().find(x => item.intentIds?.includes(x.id))?.content;
      if (content) {
        candidate = { content: content.slice(0, 400), source: { kind: 'correction', label: `You reviewed “${item.original}” → “${replacement}”. Feedback: ${content}`.slice(0, 600), eventId: event.id } };
        $('memory-nudge-text').textContent = content; $('memory-nudge').hidden = false;
      }
      refreshFlow();
      $('writing-status').textContent = 'Only that passage changed. You can undo it or check the new wording.'; $('analyze-writing').focus();
    } catch (error) { fail(error.message); }
  }
  function reject(item, reason) {
    cancel(); session = recordFeedback(session, 'rejected', reason, item.original); suggestions = suggestions.filter(x => x !== item);
    log({ kind: 'rejected', before: item.original, proposed: item.replacement, note: reason }); updateSession(); renderSuggestions();
    $('writing-status').textContent = 'Kept your wording. No lasting habit was inferred.'; $('analyze-writing').focus();
  }
  async function run(action) {
    fail();
    if (!session.text.trim()) { fail('Start with a few words, in any language.'); $('writing-draft').focus(); return; }
    if (action === 'repair' && (!snapshotCurrent(snapshot, snapshotInput()) || !$('correction-note').value.trim())) { fail('Make a current language check and describe what should be different.'); return; }
    if (['analyze', 'repair'].includes(action) && $('writing-scope').value === 'selection' && !selection) { fail('Select the passage you want help with.'); return; }
    const connection = getConnection(); if (!demo && !connection.apiKey) { $('open-settings').click(); return; }
    cancel(); const requestEpoch = epoch;
    if (!session.original) session = { ...session, original: session.text };
    const input = inputData(), binding = snapshotInput();
    if (action === 'repair') Object.assign(input, { correction: $('correction-note').value.trim(), checkText: snapshot.text, flaggedText: flagged });
    const habits = action === 'back' ? [] : voice.get().enabled ? memory.matched().map(({ id, content }) => ({ id, content })) : [];
    controller = new AbortController(); busy(true);
    $('writing-status').textContent = demo ? 'Exploring authored example guidance. No AI request is made.' : 'Considering your words…';
    try {
      const output = demo ? demoReview(action, input, sample, input.explanationLanguage) : await reviewWriting(action, input, { ...connection, signal: controller.signal });
      if (requestEpoch !== epoch) return;
      lastInputs = { action, habits, at: new Date().toISOString(), revision: input.revision, signature: binding.signature, intentions: input.intentions };
      $('last-habits').textContent = `${demo ? 'Demo inputs' : 'Last request inputs'} (${action}): ${habits.map(x => x.content).join(' · ') || 'no saved habits'}${action === 'back' ? '; original, intent and voice sample were excluded.' : ''}`;
      log({ kind: demo ? 'demo-request' : 'ai-request', note: action, habits });
      if (action === 'intentions') {
        intents.propose(output.intentions); $('writing-status').textContent = 'These are tentative interpretations. Confirm, edit or remove what you like.';
      } else if (action === 'analyze' || action === 'repair') {
        $('habit-conflicts').replaceChildren();
        for (const conflict of output.conflicts || []) {
          const card = make('div', '', 'conflict-card');
          card.append(make('strong', 'Possible habit conflict'), make('p', `Habit: ${conflict.habit}`), make('p', `Current instruction: ${conflict.instruction}`), make('p', conflict.explanation), button('Skip this habit for now', () => memory.skip(conflict.habit)));
          $('habit-conflicts').append(card);
        }
        suggestions = output.suggestions.map(x => ({ ...x, habits, correction: action === 'repair' ? input.correction : '', source: demo ? 'authored-demo' : 'model' }));
        $('suggestion-summary').textContent = output.summary; renderSuggestions(); showPanel('suggestions'); $('writing-status').textContent = 'Your draft is unchanged. You choose each expression.';
      } else if (action === 'start') {
        startingDraft(session, output.draft); preview = { text: output.draft, revision: session.revision, epoch, habits };
        $('starting-preview-text').textContent = output.draft; $('starting-preview').showModal();
      } else if (action === 'back') {
        snapshot = makeSnapshot(binding, output.text); reviewedId = null; flagged = ''; $('flagged-text').textContent = '';
        $('check-text').value = output.text; $('correction-note').value = ''; showPanel('check');
        log({ kind: 'cross-language-check', note: `${snapshot.language} · snapshot ${snapshot.id}` });
      } else {
        $('reflection-result').replaceChildren(); showPanel('check');
        for (const [title, text] of [['Meaning', output.meaning], ['Possible reader impression', output.reader], ...output.questions.map(x => ['Consider', x])]) {
          const block = make('div', '', 'reflection-block'); block.append(make('h4', title), make('p', text)); $('reflection-result').append(block);
        }
      }
      updateSession();
    } catch (error) { if (requestEpoch === epoch) { fail(error.message); $('writing-status').textContent = ''; } }
    finally { if (requestEpoch === epoch) { controller = null; busy(false); } }
  }
  function resetWorkspace(text = '') {
    cancel(); session = createSession(text); selection = null; snapshot = null; reviewedId = null; events = []; flagged = ''; lastInputs = null;
    $('last-habits').replaceChildren(); $('check-text').value = ''; $('correction-note').value = ''; $('flagged-text').textContent = '';
    intents.reset(); memory.resetSession(); invalidate(); renderEvents(events); showPanel('suggestions', false);
  }
  function loadDemo(value) {
    resetWorkspace(value.text); demo = true; sample = value;
    if (value.protect) { const start = value.text.indexOf(value.protect); session = protectSpan(session, start, start + value.protect.length); }
    for (const key of ['intent', 'avoid', 'recipient', 'relationship']) $(`writing-${key}`).value = value[key];
    $('writing-target').value = 'English'; $('writing-channel').value = 'Text message'; $('back-language').value = 'Chinese (Simplified)'; $('explanation-language').value = 'Chinese (Simplified)'; $('writing-scope').value = 'light';
    $('context-panel').open = true; updateSession();
    $('writing-status').textContent = value.id === 'promise' ? 'Authored example: the English overstates “尽量”. Check it in Chinese, describe the mismatch, then preview a fix.' : 'Authored example. Try a suggestion or check the meaning.';
  }
  for (const value of writingDemos) {
    const item = button('', () => {
      if (session.text && !confirm('Load this example? Your current session will be replaced. Export your draft first if you want to keep it.')) return;
      loadDemo(value);
    }, 'writing-example'); item.dataset.writingDemo = value.id;
    item.append(make('span', value.culture, 'mono'), make('strong', value.title), make('span', 'Try this moment ↗')); $('writing-examples').append(item);
  }
  document.querySelectorAll('[data-panel]').forEach(node => node.addEventListener('click', () => { showPanel(node.dataset.panel); if (node.dataset.panel === 'history') renderEvents(events); }));
  $('open-companion').addEventListener('click', () => showPanel('suggestions'));
  $('close-companion').addEventListener('click', () => { $('suggestions-panel').classList.remove('is-open'); $('open-companion').focus(); });
  $('suggestions-panel').addEventListener('keydown', e => { if (e.key === 'Escape' && matchMedia('(max-width:750px)').matches) { e.preventDefault(); $('close-companion').click(); } });
  for (const id of ['open-habits', 'writing-style']) $(id).addEventListener('click', () => memory.open());
  $('use-writing-habits').checked = voice.get().enabled;
  $('use-writing-habits').addEventListener('change', () => voice.setEnabled($('use-writing-habits').checked));
  $('remember-correction').addEventListener('click', () => { if (candidate) rememberCandidate(candidate); });
  $('dismiss-memory').addEventListener('click', () => { candidate = null; $('memory-nudge').hidden = true; refreshFlow(); });
  $('open-check').addEventListener('click', () => { showPanel('check'); $('back-translate').focus(); });
  $('mark-check-reviewed').addEventListener('click', () => {
    if (!snapshotCurrent(snapshot, snapshotInput())) return;
    reviewedId = snapshot.id; log({ kind: 'meaning-reviewed', note: 'Writer marked the current check as matching their meaning; not a model accuracy claim.' }); refreshSnapshot();
  });
  $('return-to-writing').addEventListener('click', () => { $('suggestions-panel').classList.remove('is-open'); $('writing-draft').focus(); });
  document.querySelectorAll('[data-mismatch]').forEach(node => node.addEventListener('click', () => {
    const previous = $('correction-note').value.trim();
    if (previous) { $('correction-note').focus(); return; }
    $('correction-note').value = node.dataset.mismatch; $('correction-note').dispatchEvent(new Event('input')); $('correction-note').focus();
  }));
  $('writing-live-mode').addEventListener('click', () => { demo = false; sample = null; invalidate(); updateSession(); $('writing-draft').focus(); });
  $('writing-demo-mode').addEventListener('click', () => { if (session.text && !confirm('Replace this session with an authored example?')) return; loadDemo(writingDemos.find(x => x.id === 'promise') || writingDemos[0]); });
  $('new-writing-session').addEventListener('click', () => {
    if (session.text && !confirm('Start fresh? Export your current draft first if you want to keep it.')) return;
    for (const id of ['writing-intent', 'writing-avoid', 'writing-recipient', 'writing-relationship']) $(id).value = '';
    demo = false; sample = null; $('writing-scope').value = 'light'; resetWorkspace(); updateSession(); $('writing-draft').focus();
  });
  $('writing-draft').addEventListener('input', () => {
    try { const before = session.text; session = editDraft(session, $('writing-draft').value); selection = null; log({ kind: 'manual-edit', before, after: session.text }); invalidate(); updateSession(); }
    catch (error) { $('writing-draft').value = session.text; fail(error.message); }
  });
  $('writing-draft').addEventListener('select', () => {
    const { selectionStart: start, selectionEnd: end } = $('writing-draft'); const previous = selection; selection = start < end ? { start, end } : null;
    if (previous?.start !== selection?.start || previous?.end !== selection?.end) $('selection-feedback').textContent = '';
    renderSelection(session, selection, $('writing-target').value, Boolean(controller));
    if ($('writing-scope').value === 'selection' && (previous?.start !== selection?.start || previous?.end !== selection?.end)) invalidate();
  });
  $('writing-draft').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !controller) { e.preventDefault(); run('analyze'); } });
  $('protect-selection').addEventListener('click', () => {
    try {
      if (!selection) throw new Error('Select the words you want to keep first.');
      const text = session.text.slice(selection.start, selection.end), end = selection.end;
      session = protectSpan(session, selection.start, selection.end); log({ kind: 'protected', note: text });
      selection = null; $('writing-draft').setSelectionRange(end, end); invalidate(); updateSession();
      $('selection-feedback').textContent = `Kept exactly: “${text}”. Remove its protection chip to change it, or use Undo last change.`;
      $('writing-draft').focus();
    }
    catch (error) { fail(error.message); }
  });
  $('express-selection').addEventListener('click', () => { if (!selection) { fail('Select the words you want help expressing.'); return; } $('writing-scope').value = 'selection'; run('analyze'); });
  $('instruction-selection').addEventListener('click', () => {
    try {
      if (!selection) throw new Error('Select your note in the draft first.');
      const text = session.text.slice(selection.start, selection.end), note = [$('writing-intent').value, text].filter(Boolean).join('\n');
      if (note.length > 600) throw new Error('Keep combined instructions within 600 characters.');
      if (!confirm(`Move this note out of the final draft and into your instructions?\n\n${text}`)) return;
      if (!session.original) session = { ...session, original: session.text };
      const previousIntent = $('writing-intent').value;
      session = applySuggestion(session, { ...selection, original: text, replacement: '', revision: session.revision });
      session = { ...session, history: [...session.history.slice(0, -1), { ...session.history.at(-1), movedInstruction: { before: previousIntent, after: note } }] };
      $('writing-intent').value = note;
      log({ kind: 'instruction-moved', before: text, note: 'Moved to task instructions by the writer; omitted from final draft.' }); selection = null; invalidate(); updateSession(); $('context-panel').open = true;
      $('selection-feedback').textContent = `Moved to “What do you want to convey?”: “${text}”. It is no longer in the final draft. Undo last change restores it.`;
    } catch (error) { fail(error.message); }
  });
  $('writing-undo').addEventListener('click', () => {
    const move = session.history.at(-1)?.movedInstruction;
    if (move && $('writing-intent').value === move.after) $('writing-intent').value = move.before;
    session = undo(session); selection = null; log({ kind: 'undo', note: 'Restored prior draft/protection snapshot. A moved note is restored unless its instructions were subsequently edited. Saved habits are unchanged.' }); invalidate(); updateSession();
  });
  $('show-original').addEventListener('click', () => { $('original-panel').hidden = !$('original-panel').hidden; });
  contextIds.forEach(id => $(id).addEventListener('input', invalidate));
  for (const [id, action] of [['analyze-writing', 'analyze'], ['starting-draft', 'start'], ['extract-intents', 'intentions'], ['back-translate', 'back'], ['check-meaning', 'reflect'], ['repair-writing', 'repair']]) $(id).addEventListener('click', () => run(action));
  $('writing-cancel').addEventListener('click', () => { cancel(); $('writing-status').textContent = 'Cancelled. Provider work already processed may still incur charges.'; });
  $('check-text').addEventListener('select', () => {
    const next = $('check-text').value.slice($('check-text').selectionStart, $('check-text').selectionEnd);
    if (next !== flagged) { cancel(); reviewedId = null; suggestions = suggestions.filter(item => !item.correction); preview = null; renderSuggestions(); refreshSnapshot(); $('writing-status').textContent = 'Your flagged passage changed. Preview a new fix when ready.'; }
    flagged = next; $('flagged-text').textContent = flagged ? `You flagged: ${flagged}` : '';
  });
  $('correction-note').addEventListener('input', () => { cancel(); reviewedId = null; suggestions = []; preview = null; renderSuggestions(); refreshSnapshot(); $('writing-status').textContent = 'Your explanation changed. Preview a new fix when ready.'; });
  $('accept-starting').addEventListener('click', () => {
    try {
      if (!preview || preview.revision !== session.revision || preview.epoch !== epoch) throw new Error('This preview is out of date. Request a new draft.');
      const before = session.text; session = startingDraft(session, preview.text); log({ kind: 'starting-draft-accepted', before, proposed: preview.text, after: session.text, habits: preview.habits });
      $('starting-preview').close(); selection = null; invalidate(); updateSession();
    } catch (error) { $('starting-preview').close(); fail(error.message); }
  });
  $('copy-draft').addEventListener('click', async () => { try { await navigator.clipboard.writeText(session.text); notify('Copied. Ready when you are.'); } catch { fail('Select and copy the draft text; clipboard is unavailable.'); } });
  $('download-draft').addEventListener('click', () => download('nuancebridge-draft.txt', session.text));
  $('export-events').addEventListener('click', () => download('nuancebridge-session.json', JSON.stringify({ original: session.original, draft: session.text, intentions: intents.get(), events, snapshot, lastInputs }, null, 2), 'application/json'));
  $('peer-review').addEventListener('click', () => $('peer-dialog').showModal());
  $('download-peer').addEventListener('click', () => download('nuancebridge-review.txt', `Intention: ${$('writing-intent').value}\nAvoid: ${$('writing-avoid').value}\n\n${session.text}\n\nPlease check meaning, tone and cultural expressions. This file does not sync.`));
  $('save-peer').addEventListener('click', () => { const note = $('peer-notes').value.trim(); if (!note) return; session = recordFeedback(session, 'peer', note); log({ kind: 'human-feedback', note }); $('peer-notes').value = ''; $('peer-dialog').close(); invalidate(); updateSession(); });
  window.addEventListener('nuancebridge:settings', invalidate); window.addEventListener('pagehide', cancel);
  guide = initFlowGuide({ editGoal: () => { $('context-panel').open = true; $('writing-intent').focus(); },
    reviewIntentions: () => { $('intent-panel').open = true; (document.querySelector('.intent-card button') || $('new-intent')).focus(); },
    write: () => { if (suggestions.length) { showPanel('suggestions'); document.querySelector('.suggestion-card button')?.focus(); } else { $('suggestions-panel').classList.remove('is-open'); $('writing-draft').focus(); } },
    check: () => { showPanel('check'); $('back-translate').focus(); }, remember: () => candidate ? rememberCandidate(candidate) : memory.open() });
  updateSession(); renderSuggestions(); renderEvents(events);
  return { openHabits: () => memory.open(), habitsFor: otherContext => memory.forContext(otherContext).map(x => x.content) };
}
