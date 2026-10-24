import { $, make, button, download } from './ui-helpers.js';
import { makeMemory, loadMemories, saveMemories, matchMemories, importMemories, exportMemories } from './memory-store.js';

export function initMemories({ context, changed, event, notify, enabled = () => true }) {
  let storage, items = [], exclusions = [], editing = null, source = null;
  let loadIssue = '';
  try { storage = localStorage; items = loadMemories(storage); }
  catch (error) { loadIssue = error instanceof SyntaxError || /habit file/i.test(error.message)
    ? 'Saved habit data is invalid. Existing storage is untouched; import a backup or clear it explicitly.'
    : 'Browser storage is unavailable. Habits can still be used for this visit.'; }
  let preserveUnread = loadIssue.startsWith('Saved habit data');
  const dialog = make('dialog'); dialog.id = 'habits-dialog'; dialog.setAttribute('aria-labelledby', 'habits-title');
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="habits-title">Your expression habits</h2><button type="button" id="close-habits" class="close-button" aria-label="Close habits">×</button></div>
    <p class="dialog-copy">Saved only on this browser, only when you choose. Scope is matched to the reader label, channel and writing language. New instructions take priority.</p>
    <p id="habits-status" class="help" role="status"></p><div id="habits-list"></div>
    <form id="habit-form"><h3 id="habit-form-title">Add a habit</h3><label>A habit you want to keep<textarea id="habit-content" required maxlength="400" rows="2" placeholder="e.g. Preserve uncertainty in tentative plans."></textarea></label>
    <div class="habit-scope"><label>Reader label<input id="habit-recipient" maxlength="150" placeholder="Any reader"></label><label>Channel<select id="habit-channel"><option value="">Any channel</option><option>Text message</option><option>Email</option><option>Social media</option><option>Personal writing</option><option>Creative writing</option><option>Community forum</option></select></label><label>Writing language<select id="habit-target"><option value="">Any language</option></select></label></div>
    <p id="habit-source" class="help"></p><div class="dialog-actions"><button id="cancel-habit-edit" type="button" class="button outline">Reset form</button><button class="button primary" type="submit">Save this habit</button></div></form>
    <details class="habit-tools"><summary>Samples, backup & storage</summary><button id="open-voice-example" class="text-button">Manage my explicitly saved writing sample</button><button id="export-habits" class="text-button">Export habits</button><label>Import habits (replaces this list)<input id="import-habits" type="file" accept="application/json,.json"></label><button id="clear-habits" class="text-button">Clear all habits</button></details>`;
  document.body.append(dialog);
  $('habit-target').append(...[...$('writing-target').options].map(option => option.cloneNode(true)));
  function persist() {
    if (preserveUnread) { $('habits-status').textContent = loadIssue; notify(loadIssue); return; }
    try { saveMemories(storage, items); $('habits-status').textContent = 'Saved on this browser. Drafts are not saved with your habits.'; }
    catch { $('habits-status').textContent = 'Browser storage unavailable. Changes last only for this visit.'; notify('Habits are available for this visit only; browser storage is unavailable.'); }
  }
  function reset(candidate) {
    editing = null; source = candidate?.source || null;
    $('habit-form').reset(); $('habit-content').value = candidate?.content || '';
    const scope = candidate?.scope || {};
    for (const key of ['recipient', 'channel', 'target']) {
      const field = $(`habit-${key}`), value = scope[key] || '';
      if (field.tagName === 'SELECT' && value && ![...field.options].some(option => option.value === value)) {
        const option = make('option', `${value} (imported scope)`); option.value = value; field.append(option);
      }
      field.value = value;
    }
    $('habit-source').textContent = source ? `Source to be saved: ${source.label}` : 'Source: a habit explicitly added by you.';
    $('habit-form-title').textContent = candidate ? 'Review before remembering' : 'Add a habit';
  }
  function render() {
    $('habits-list').replaceChildren();
    if (!items.length) $('habits-list').append(make('p', 'No habits yet. A choice in one draft never becomes a habit automatically.', 'empty-note'));
    items.forEach(item => {
      const card = make('article', '', 'habit-card');
      card.append(make('strong', item.content), make('p', `Scope: ${Object.values(item.scope).filter(Boolean).join(' · ') || 'Any context (no scope set)'}`, 'help'));
      const detail = make('details'); detail.append(make('summary', 'Source & saved details'));
      detail.append(make('p', item.source.label, 'help'), make('p', `Explicitly saved · ${new Date(item.updatedAt).toLocaleDateString()}${item.source.eventId ? ` · Source event ${item.source.eventId}` : ''}`, 'help')); card.append(detail);
      const actions = make('div', '', 'suggestion-actions');
      actions.append(button('Edit habit', () => {
        reset({ content: item.content, scope: item.scope, source: item.source }); editing = item.id;
        $('habit-form-title').textContent = 'Edit this habit'; $('habit-content').focus();
      }), button(item.enabled ? 'Pause' : 'Enable', () => {
        items = items.map(x => x.id === item.id ? { ...x, enabled: !x.enabled, updatedAt: new Date().toISOString() } : x);
        persist(); render(); changed(); event({ kind: 'habit-status', note: `${item.enabled ? 'Paused' : 'Enabled'}: ${item.content}` });
      }), button('Delete', () => { items = items.filter(x => x.id !== item.id); persist(); render(); changed(); event({ kind: 'habit-deleted', note: item.content }); }));
      card.append(make('span', item.enabled ? 'Enabled' : 'Paused', 'badge'), actions); $('habits-list').append(card);
    });
  }
  function refreshSession() {
    const matched = matchMemories(items, context());
    $('habit-count').textContent = enabled() ? `${matchMemories(items, context(), exclusions).length} enabled` : 'Off for writing';
    $('session-habits').replaceChildren();
    if (!enabled()) $('session-habits').append(make('p', 'Saved habits and your writing sample are switched off. No habits are sent with writing requests.', 'help'));
    else if (!matched.length) $('session-habits').append(make('p', 'No enabled habits match this context. You can write without any.', 'help'));
    for (const item of matched) {
      const label = make('label', '', 'check-label session-habit'); const check = make('input'); check.type = 'checkbox'; check.checked = enabled() && !exclusions.includes(item.id); check.disabled = !enabled();
      check.addEventListener('change', () => { exclusions = check.checked ? exclusions.filter(id => id !== item.id) : [...exclusions, item.id]; changed(); });
      label.append(check, make('span', item.content)); $('session-habits').append(label);
    }
  }
  $('habit-form').addEventListener('submit', e => {
    e.preventDefault();
    try {
      if (preserveUnread) throw new Error(loadIssue);
      if (!editing && items.length >= 50) throw new Error('You can save up to 50 habits.');
      const old = items.find(x => x.id === editing);
      const item = makeMemory({ ...(old || {}), content: $('habit-content').value,
        scope: Object.fromEntries(['recipient', 'channel', 'target'].map(key => [key, $(`habit-${key}`).value])),
        source: source || undefined, updatedAt: new Date().toISOString() });
      items = old ? items.map(x => x.id === editing ? item : x) : [...items, item];
      persist(); render(); event({ kind: 'habit-saved', note: item.content, memoryId: item.id }); changed(); reset();
    } catch (error) { $('habits-status').textContent = error.message; }
  });
  $('close-habits').addEventListener('click', () => dialog.close());
  $('cancel-habit-edit').addEventListener('click', () => reset());
  $('open-voice-example').addEventListener('click', () => { dialog.close(); $('voice-dialog').showModal(); });
  $('export-habits').addEventListener('click', () => download('nuancebridge-habits.json', exportMemories(items), 'application/json'));
  $('import-habits').addEventListener('change', async e => {
    try {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 150000) throw new Error('Choose a habit file smaller than 150 KB.');
      const imported = importMemories(await file.text());
      if (!confirm(`Replace ${items.length} existing habits with ${imported.length} imported habits? Source labels in imported files are supplied by that file, not independently verified.`)) return;
      preserveUnread = false; items = imported; exclusions = []; persist(); render(); changed(); reset(); event({ kind: 'habits-imported', note: `${items.length} habits imported by your choice` });
    } catch (error) { $('habits-status').textContent = `Nothing imported. ${error.message}`; }
    finally { e.target.value = ''; }
  });
  $('clear-habits').addEventListener('click', () => {
    if (!confirm('Clear all saved habits on this browser? Export them first if you want a backup.')) return;
    preserveUnread = false; items = []; exclusions = []; persist(); render(); changed(); reset(); event({ kind: 'habits-cleared' });
  });
  // Write migration once, including an empty list, so removed legacy habits never reappear.
  if (!preserveUnread && storage) { try { saveMemories(storage, items); } catch { /* Explicit saves report storage failure. */ } }
  render(); reset();
  return { open(candidate) { reset(candidate); render(); $('habits-status').textContent = loadIssue; dialog.showModal(); },
    matched: () => matchMemories(items, context(), exclusions), refresh: refreshSession,
    forContext: otherContext => matchMemories(items, otherContext),
    skip(content) { exclusions = [...new Set([...exclusions, ...items.filter(x => x.content === content).map(x => x.id)])]; changed(); },
    resetSession() { exclusions = []; refreshSession(); } };
}
