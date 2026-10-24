import { $, make, button } from './ui-helpers.js';
export function renderOptions({ suggestions, intentions, apply, reject }) {
  $('writing-suggestions').replaceChildren(); $('suggestion-count').textContent = `${suggestions.length} to consider`;
  if (!suggestions.length) { $('writing-suggestions').append(make('p', 'Start with your words. We’ll look at one small change at a time.', 'empty-suggestions')); return; }
  suggestions.forEach((item, index) => {
    const card = make('article', '', 'suggestion-card');
    card.append(make('h4', item.correction ? 'A focused meaning repair' : `A small possibility · ${index + 1}`), make('span', 'Current wording', 'field-label'), make('del', item.original, 'suggestion-before'));
    const field = make('textarea', '', 'suggestion-replacement'); field.id = `replacement-${index}`; field.value = item.replacement; field.maxLength = 6000; field.rows = 2; field.dir = 'auto'; field.readOnly = true;
    const label = make('label', 'Possible expression'); label.htmlFor = field.id;
    card.append(label, field, make('p', item.reason, 'suggestion-explanation'));
    const details = make('details', '', 'suggestion-details'); details.append(make('summary', 'Why this option & possible effects'));
    details.append(make('p', `Possible tradeoff: ${item.tradeoff}`), make('p', `Possible reader impression: ${item.reader}`));
    for (const intent of intentions.filter(x => item.intentIds?.includes(x.id))) details.append(make('p', `AI linked this to your intention: ${intent.content}`));
    details.append(make('p', `Habits provided for this request: ${(item.habits || []).map(x => x.content).join(' · ') || 'None'}. Supplied context is not causal attribution.`)); card.append(details);
    const feedback = make('input'); feedback.maxLength = 400; feedback.placeholder = 'Optional: what fits or feels off?'; feedback.setAttribute('aria-label', `Feedback for suggestion ${index + 1}`); card.append(feedback);
    const actions = make('div', '', 'suggestion-actions');
    actions.append(button('Use this expression', () => apply(item, field.value, feedback.value), 'button small primary'), button('Make it my own', () => { field.readOnly = false; field.focus(); }), button('Keep my wording', () => reject(item, feedback.value)));
    card.append(actions); $('writing-suggestions').append(card);
  });
}
export function renderEvents(events) {
  $('revision-events').replaceChildren();
  if (!events.length) $('revision-events').append(make('p', 'Your decisions will appear here. Nothing is automatically saved.', 'empty-note'));
  [...events].reverse().forEach(item => {
    const card = make('article', '', 'event-card'); card.append(make('strong', item.kind.replaceAll('-', ' ')), make('span', `Revision ${item.revision} · ${new Date(item.at).toLocaleTimeString()}`, 'help'));
    for (const [key, title] of [['before', 'Before'], ['proposed', 'Offered'], ['after', 'Your result'], ['note', 'Note']]) if (item[key]) card.append(make('p', `${title}: ${item[key]}`));
    if (item.habits) card.append(make('p', `Provided habits: ${item.habits.map(x => x.content).join(' · ') || 'None'}`, 'help'));
    $('revision-events').append(card);
  });
}
