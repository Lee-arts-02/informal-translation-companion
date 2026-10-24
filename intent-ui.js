import { $, make, button, expandWritingTools } from './ui-helpers.js';
import { makeIntent, reviseIntent } from './intent-state.js';

export function initIntentPanel({ changed, event, fail, remember, getRevision }) {
  let items = [];
  function focusNext() { (document.querySelector('[data-confirm-intent]') || $('back-from-intentions')).focus(); }
  function render() {
    $('intent-count').textContent = items.length ? `${items.length} intentions · ${items.filter(x => x.confirmed).length} confirmed` : 'Add your own or let AI suggest';
    $('intent-list').replaceChildren();
    if (!items.length) $('intent-list').append(make('p', 'You can start writing now. Add an intention whenever you need it.', 'help'));
    items.forEach(item => {
      const card = make('article', '', 'intent-card'); card.dataset.intentId = item.id;
      card.append(make('strong', item.content), make('span', item.confirmed ? item.origin === 'user' ? 'Your instruction · this draft' : 'Confirmed by you · this draft' : 'AI interpretation · not used until confirmed', `origin-label ${item.confirmed ? 'confirmed' : ''}`));
      card.append(make('p', item.confirmed ? 'Used for this draft only. Saving a future habit is a separate choice.' : 'Check this against your meaning. Confirm to use it, edit it, or remove it.', 'help intent-scope-note'));
      if (item.evidence) card.append(make('p', `Source wording: “${item.evidence}”${Number.isInteger(item.evidenceRevision) ? ` · revision ${item.evidenceRevision}` : ''}`, 'help'));
      const actions = make('div', '', 'suggestion-actions');
      if (!item.confirmed) {
        const confirm = button('That’s what I mean', () => {
          items = items.map(x => x.id === item.id ? { ...x, confirmed: true } : x); event({ kind: 'intent-confirmed', note: item.content }); render(); changed();
          focusNext();
        }); confirm.dataset.confirmIntent = item.id; actions.append(confirm);
      }
      const edit = make('details', '', 'intent-edit'); edit.append(make('summary', 'Edit'));
      const field = make('input'); field.value = item.content; field.maxLength = 400; field.setAttribute('aria-label', 'Edit intention');
      edit.append(field, button('Use my wording', () => {
        try { const updated = reviseIntent(item, field.value); items = items.map(x => x.id === item.id ? updated : x); event({ kind: 'intent-edited', note: updated.content }); render(); changed(); focusNext(); }
        catch (error) { fail(error.message); }
      })); actions.append(edit);
      actions.append(button('Remove', () => { items = items.filter(x => x.id !== item.id); event({ kind: 'intent-removed', note: item.content }); render(); changed(); focusNext(); }));
      if (item.confirmed) actions.append(button('Remember for later', () => remember({ content: item.content, source: { kind: 'intention', label: `Explicitly saved intention: ${item.content}`, eventId: '' } })));
      card.append(actions); $('intent-list').append(card);
    });
  }
  $('intent-form').addEventListener('submit', e => {
    e.preventDefault();
    try {
      if (items.length >= 12) throw new Error('Keep up to 12 intentions for this draft.');
      const item = makeIntent($('new-intent').value); items.push(item); $('new-intent').value = '';
      event({ kind: 'intent-added', note: item.content }); render(); changed();
    } catch (error) { fail(error.message); }
  });
  render();
  return { get: () => items,
    reset() { items = []; render(); },
    propose(proposed) {
      const additions = proposed.filter(item => !items.some(x => x.content === item.content));
      items = [...items, ...additions.map(x => ({ ...x, evidenceRevision: getRevision() }))].slice(0, 12);
      render(); expandWritingTools('intent-panel'); changed();
      focusNext();
    } };
}
