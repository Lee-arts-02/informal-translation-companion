import { setupTranslation } from './canvas-translation.js';
import { requestCompletion } from './translation.js';
import { sentenceScope, wordDiff, applyRevision, revisionRequest, parseRevision } from './canvas-state.js';
import { selectionRect, placeToolbar } from './selection-position.js';
import { copy } from './canvas-i18n.js';

const $ = id => document.getElementById(id);
const EXAMPLE = "I'll send you the draft on Friday. If I'm delayed, I'll let you know in advance.";
let storage;
try { storage = localStorage; } catch { storage = null; }
let language = 'en', habits = [];
try {
  language = storage?.getItem('nuancebridge.canvas.language') === 'zh' ? 'zh' : 'en';
  const saved = JSON.parse(storage?.getItem('nuancebridge.canvas.habits') || '[]');
  habits = Array.isArray(saved) ? saved.filter(x => typeof x === 'string' && x.trim() && x.length <= 400).slice(0, 12) : [];
} catch { /* Use memory-only defaults when browser storage is unavailable. */ }
let text = '', focus = null, proposal = null, lastAccepted = null, undo = null;
let mode = 'write', showChanges = true, example = false, key = '', model = 'openrouter/auto';
let controller = null, generation = 0, drawing = null, anchor = null;
let noteReady = false;
let translationTools;
const t = name => copy[language][name] || copy.en[name] || name;
const status = name => { $('status').textContent = t(name); };
const el = (tag, content, className) => {
  const node = document.createElement(tag); if (content !== undefined) node.textContent = content;
  if (className) node.className = className; return node;
};

function localize() {
  document.documentElement.lang = language;
  $('ui-language').value = language;
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  for (const [id, name] of [['draft','placeholder'], ['goal','goalPlaceholder'], ['intent-input','intentPlaceholder']]) $(id).placeholder = t(name);
  $('close-popover').ariaLabel = t('close'); $('clear-note').ariaLabel = t('dismissNote');
  document.querySelectorAll('[data-close]').forEach(node => { node.ariaLabel = t('close'); });
  translationTools?.render(); renderHabits(); render(); $('status').textContent = ''; $('error').hidden = true;
}
function hidePopover() { if ($('intent-popover').matches(':popover-open')) $('intent-popover').hidePopover(); }
function clearError() { $('error').hidden = true; $('error').textContent = ''; }
function report(error) { $('error').textContent = error.message || String(error); $('error').hidden = false; }
function resizeDraft() { $('draft').style.height = 'auto'; $('draft').style.height = `${Math.max(290, $('draft').scrollHeight)}px`; }
function abortRequest() { generation++; controller?.abort(); controller = null; $('preview').disabled = false; $('cancel-request').hidden = true; }

function renderDocument() {
  const revision = proposal || lastAccepted;
  const tracked = !!proposal || !!lastAccepted && showChanges;
  const view = $('document-view'); view.replaceChildren();
  $('draft').hidden = tracked || mode === 'pen'; view.hidden = !tracked && mode !== 'pen';
  view.dataset.pen = String(mode === 'pen' && !tracked);
  if (tracked) {
    view.append(document.createTextNode(revision.before.slice(0, revision.scope.start)));
    for (const part of wordDiff(revision.scope.text, revision.replacement, {
      start: revision.focus.start - revision.scope.start, end: revision.focus.end - revision.scope.start,
    })) view.append(el(part.kind === 'same' ? 'span' : part.kind === 'add' ? 'ins' : 'del', part.text,
      part.outside ? part.kind === 'del' ? 'supporting-del' : 'supporting' : ''));
    view.append(document.createTextNode(revision.before.slice(revision.scope.end)));
  } else if (mode === 'pen') {
    let pos = 0;
    for (const char of Array.from(text)) {
      const span = el('span', char, focus && pos >= focus.start && pos < focus.end ? 'focus-mark' : '');
      span.dataset.start = pos; pos += char.length; span.dataset.end = pos; view.append(span);
    }
  }
  $('legend').hidden = !tracked;
  $('revision-state').textContent = t(proposal ? 'pending' : 'applied');
  $('edit-draft').hidden = !tracked;
  $('show-changes').hidden = !lastAccepted || !!proposal;
  $('show-changes').textContent = t(showChanges ? 'hideChanges' : 'showChanges');
  $('show-changes').setAttribute('aria-pressed', String(showChanges));
  $('document-hint').textContent = t(tracked ? 'focusHint' : mode === 'pen' ? 'penHint' : 'hint');
}
function hasSupporting(revision) {
  return wordDiff(revision.scope.text, revision.replacement, { start: revision.focus.start - revision.scope.start,
    end: revision.focus.end - revision.scope.start }).some(x => x.outside);
}
function render() {
  $('draft').value = text; resizeDraft(); renderDocument();
  $('count').textContent = `${text.length.toLocaleString()} / 6,000`;
  $('copy').disabled = !text.trim(); $('undo').disabled = !undo;
  $('connect').textContent = t(key ? 'connected' : 'connect');
  $('source-label').hidden = !example && !proposal && !lastAccepted;
  $('source-label').textContent = t((proposal || lastAccepted)?.source === 'live' ? 'modeLive' : 'modeExample');
  $('revision-note').hidden = !proposal && !lastAccepted && (!focus || !noteReady);
  $('focus-quote').textContent = `“${(proposal || lastAccepted)?.focusText || (focus ? text.slice(focus.start, focus.end) : '')}”`;
  $('revision-form').hidden = !!proposal || !!lastAccepted;
  $('review-actions').hidden = !proposal; $('remember-row').hidden = !lastAccepted || !!proposal;
  $('reason').hidden = !(proposal || lastAccepted)?.reason;
  $('reason').textContent = (proposal || lastAccepted)?.reason || '';
  if (proposal) {
    $('replacement').value = proposal.replacement;
    $('accept').textContent = t(hasSupporting(proposal) ? 'acceptOutside' : 'accept');
    $('accept').disabled = !proposal.replacement.trim() || proposal.replacement === proposal.scope.text;
  }
  for (const name of ['write', 'pen']) {
    $(`${name}-mode`).classList.toggle('selected', mode === name);
    $(`${name}-mode`).setAttribute('aria-pressed', String(mode === name));
  }
}
function positionPopover() {
  if (!$('intent-popover').matches(':popover-open') || !anchor) return;
  if (mode === 'write' && focus) anchor = selectionRect($('draft'), focus.start, focus.end);
  if (!anchor) { hidePopover(); return; }
  const vv = window.visualViewport, size = $('intent-popover').getBoundingClientRect();
  const placed = placeToolbar(anchor, size, { left: vv?.offsetLeft || 0, top: vv?.offsetTop || 0,
    width: vv?.width || innerWidth, height: vv?.height || innerHeight });
  Object.assign($('intent-popover').style, { left: `${placed.left}px`, top: `${placed.top}px` });
}
function mark(start, end, rect) {
  if (start === end || !rect) return;
  abortRequest(); clearError(); proposal = null; lastAccepted = null;
  focus = { start, end }; anchor = rect; noteReady = false;
  $('intent-input').value = ''; $('goal').value = '';
  render(); $('intent-popover').showPopover(); positionPopover();
}
function captureSelection() {
  if ($('draft').hidden) return;
  const { selectionStart: start, selectionEnd: end } = $('draft');
  if (end > start) mark(start, end, selectionRect($('draft'), start, end));
}
$('draft').addEventListener('pointerup', captureSelection);
$('draft').addEventListener('keyup', event => { if (event.key === 'Shift') captureSelection(); });
$('draft').addEventListener('input', () => {
  abortRequest(); hidePopover(); clearError(); text = $('draft').value;
  focus = null; proposal = null; lastAccepted = null; undo = null; example = false; render(); status('draftChanged');
});
function writeMode(next) {
  abortRequest(); hidePopover(); proposal = null; mode = next;
  if (lastAccepted && next === 'pen') lastAccepted = null;
  showChanges = false; render();
  if (next === 'write') $('draft').focus();
}
$('write-mode').addEventListener('click', () => writeMode('write'));
$('pen-mode').addEventListener('click', () => writeMode('pen'));
$('edit-draft').addEventListener('click', () => writeMode('write'));
$('show-changes').addEventListener('click', () => { showChanges = !showChanges; render(); });
$('close-popover').addEventListener('click', hidePopover);
$('intent-form').addEventListener('submit', event => {
  event.preventDefault(); if (!focus) return;
  $('goal').value = $('intent-input').value.trim(); noteReady = true; hidePopover(); render(); $('goal').focus();
});
document.querySelectorAll('[data-goal]').forEach(button => button.addEventListener('click', () => {
  $('intent-input').value = t(`${button.dataset.goal}Goal`); $('intent-input').focus();
}));
$('clear-note').addEventListener('click', () => { abortRequest(); hidePopover(); focus = null; proposal = null; lastAccepted = null; render(); });
$('goal').addEventListener('input', () => { if (controller) { abortRequest(); status('cancelled'); } });

function nearestChar(x, y) {
  let hit = null, best = Infinity;
  for (const span of $('document-view').children) {
    const rect = span.getBoundingClientRect(), dx = Math.max(rect.left - x, 0, x - rect.right), dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const score = dx * dx + 3 * dy * dy;
    if (score < best) { best = score; hit = span; }
  }
  return best < 1300 ? hit : null;
}
$('document-view').addEventListener('pointerdown', event => {
  if (mode !== 'pen' || proposal || lastAccepted && showChanges) return;
  const hit = nearestChar(event.clientX, event.clientY); if (!hit) return;
  event.preventDefault(); hidePopover(); drawing = { start: +hit.dataset.start, end: +hit.dataset.end,
    lastStart: +hit.dataset.start, lastEnd: +hit.dataset.end, id: event.pointerId };
  $('document-view').setPointerCapture(event.pointerId);
});
$('document-view').addEventListener('pointermove', event => {
  if (!drawing || event.pointerId !== drawing.id) return;
  const hit = nearestChar(event.clientX, event.clientY);
  if (hit) { drawing.lastStart = +hit.dataset.start; drawing.lastEnd = +hit.dataset.end; }
});
$('document-view').addEventListener('pointerup', event => {
  if (!drawing || event.pointerId !== drawing.id) return;
  const start = Math.min(drawing.start, drawing.lastStart), end = Math.max(drawing.end, drawing.lastEnd);
  const hit = nearestChar(event.clientX, event.clientY); drawing = null;
  if (hit) mark(start, end, hit.getBoundingClientRect());
});
$('document-view').addEventListener('pointercancel', () => { drawing = null; });

$('revision-form').addEventListener('submit', async event => {
  event.preventDefault(); clearError(); hidePopover(); if (!focus) { status('selectFirst'); return; }
  const goal = $('goal').value.trim(); if (!goal) { $('goal').focus(); return; }
  if (!key && !example) { $('connection').showModal(); $('canvas-key').focus(); return; }
  abortRequest(); const id = generation, before = text, selected = { ...focus }, source = key ? 'live' : 'example';
  const scope = sentenceScope(text, focus.start, focus.end);
  $('preview').disabled = true; $('cancel-request').hidden = false; status('busy');
  try {
    let result;
    if (!key) {
      if (text !== EXAMPLE || text.slice(focus.start, focus.end) !== 'send' || !/soft|promise|commit|尽量|承诺|委婉/i.test(goal)) throw new Error(t('exampleOnly'));
      result = { replacement: scope.text.replace("I'll send", "I'll try to send"), reason: t('exampleReason') };
    } else {
      controller = new AbortController();
      const request = revisionRequest(text, focus, goal, $('use-habits').checked ? habits : [], language === 'zh' ? 'Chinese' : 'English', model);
      result = parseRevision(await requestCompletion(request.body, { apiKey: key, signal: controller.signal }), before, scope);
    }
    if (id !== generation || text !== before) return;
    proposal = { ...result, before, scope, focus: selected, focusText: before.slice(selected.start, selected.end), goal, source };
    lastAccepted = null; mode = 'write'; showChanges = true; render();
    status(result.replacement === scope.text ? 'noChange' : 'previewReady');
    $('accept').focus();
  } catch (error) { if (id === generation) report(error); }
  finally { if (id === generation) { controller = null; $('preview').disabled = false; $('cancel-request').hidden = true; } }
});
$('cancel-request').addEventListener('click', () => { abortRequest(); status('cancelled'); });
$('replacement').addEventListener('input', () => {
  if (!proposal) return; proposal.replacement = $('replacement').value;
  proposal.reason = t('manualReason'); $('reason').textContent = proposal.reason;
  renderDocument(); $('accept').textContent = t(hasSupporting(proposal) ? 'acceptOutside' : 'accept');
  $('accept').disabled = !proposal.replacement.trim() || proposal.replacement === proposal.scope.text;
});
$('accept').addEventListener('click', () => {
  if (!proposal) return;
  try {
    const next = applyRevision(text, proposal.scope, proposal.replacement);
    undo = { text, lastAccepted, focus, example }; text = next;
    lastAccepted = { ...proposal }; proposal = null; focus = null; showChanges = true; render(); status('accepted');
    $('edit-draft').focus();
  } catch (error) { report(error); }
});
$('dismiss').addEventListener('click', () => { proposal = null; render(); status('dismissed'); $('goal').focus(); });
$('undo').addEventListener('click', () => {
  if (!undo) return; abortRequest(); hidePopover();
  ({ text, lastAccepted, focus, example } = undo); undo = null; proposal = null; showChanges = true; render(); status('undone');
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(text); status('copied'); } catch { status('copyError'); }
});
$('example').addEventListener('click', () => {
  if (text.trim() && text !== EXAMPLE && !confirm(t('confirmExample'))) return;
  abortRequest(); hidePopover(); text = EXAMPLE; example = true; focus = null; proposal = null; lastAccepted = null; undo = null; mode = 'write';
  render(); clearError(); status('exampleStatus'); $('draft').focus();
});
$('ui-language').addEventListener('change', () => {
  language = $('ui-language').value; try { storage?.setItem('nuancebridge.canvas.language', language); } catch { /* Memory only. */ }
  localize(); positionPopover();
});
$('connect').addEventListener('click', () => { hidePopover(); $('connection').showModal(); $('canvas-key').focus(); });
$('connection-form').addEventListener('submit', event => {
  event.preventDefault(); translationTools.cancel(); abortRequest(); key = $('canvas-key').value.trim(); model = $('canvas-model').value.trim();
  $('canvas-key').value = ''; $('connection').close(); render(); status('connectionSaved');
});
$('disconnect').addEventListener('click', () => { translationTools.cancel(); abortRequest(); key = ''; $('canvas-key').value = ''; $('connection').close(); render(); status('keyCleared'); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));

function renderHabits() {
  $('habit-list').replaceChildren();
  if (!habits.length) $('habit-list').append(el('li', t('emptyHabits')));
  habits.forEach((habit, index) => {
    const item = el('li'), remove = el('button', t('remove')); remove.type = 'button';
    remove.addEventListener('click', () => { habits.splice(index, 1); persistHabits(); renderHabits(); });
    item.append(el('span', habit), remove); $('habit-list').append(item);
  });
}
function persistHabits() {
  translationTools.invalidate();
  try { if (!storage) throw new Error(); storage.setItem('nuancebridge.canvas.habits', JSON.stringify(habits)); status('saved'); }
  catch { status('storageError'); }
}
$('habits-open').addEventListener('click', () => { hidePopover(); $('habit-input').value = ''; renderHabits(); $('habits-dialog').showModal(); });
$('remember').addEventListener('click', () => {
  $('habit-input').value = lastAccepted?.goal || ''; renderHabits(); $('habits-dialog').showModal(); $('habit-input').focus(); status('rememberHelp');
});
$('habit-form').addEventListener('submit', event => {
  event.preventDefault(); const value = $('habit-input').value.trim(); if (!value) return;
  if (habits.length >= 12) { status('limit'); return; }
  if (!habits.includes(value)) habits.push(value); persistHabits(); renderHabits(); $('habits-dialog').close(); $('remember').focus();
});
document.addEventListener('pointerdown', event => {
  if (!$('intent-popover').contains(event.target) && event.target !== $('draft') && !$('document-view').contains(event.target)) hidePopover();
});
window.addEventListener('resize', () => { resizeDraft(); positionPopover(); });
window.addEventListener('scroll', positionPopover, true);
window.visualViewport?.addEventListener('resize', positionPopover);
window.addEventListener('pagehide', () => { translationTools.cancel(); abortRequest(); key = ''; $('canvas-key').value = ''; });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') hidePopover();
  if (event.key === 'Tab' && !event.shiftKey && event.target === $('draft') && $('intent-popover').matches(':popover-open')) {
    event.preventDefault(); $('intent-input').focus();
  }
});
translationTools = setupTranslation({ t,
  connection: () => ({ apiKey:key, model }), preferences: () => habits,
  connect: () => { hidePopover(); $('connection').showModal(); $('canvas-key').focus(); },
  adopt: value => {
    if (text.trim() && !confirm(t('replaceDraftTranslation'))) return false;
    abortRequest(); hidePopover(); clearError();
    undo = { text, lastAccepted, focus, example };
    text = value; focus = null; proposal = null; lastAccepted = null; example = false; mode = 'write';
    render(); $('draft').focus(); status('translationUsed'); return true;
  },
});
localize();
