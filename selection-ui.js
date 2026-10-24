import { $, make } from './ui-helpers.js';

// This is a display of the actual textarea range, never an inferred selection.
export function renderSelection(session, selection, target, busy = false) {
  const selected = selection ? session.text.slice(selection.start, selection.end) : '';
  const overlap = selection && session.protected.some(span => selection.start < span.end && selection.end > span.start);
  $('selection-workbench').classList.toggle('has-selection', Boolean(selected));
  $('selected-passage').replaceChildren(make('span', selected || 'Select a word or sentence in your draft above.'));
  $('selection-caption').textContent = selected ? 'You selected' : 'Start here';
  $('writing-selection').textContent = selected ? `${selection.end - selection.start} characters selected · choose what happens to this passage below.` : 'Highlight a word or sentence above, then choose an action below.';
  $('selection-guidance').textContent = overlap
    ? 'This selection includes protected words. Remove their protection chip before protecting it again or moving it to instructions. Wording suggestions cannot change protected words.'
    : selected ? 'Only this passage is targeted. Changing your selection updates this preview.'
      : 'Drag over text, or use Shift + arrow keys. These actions become available when you select a passage.';
  $('protect-selection').disabled = !selected || Boolean(overlap);
  $('express-selection').disabled = !selected || busy;
  $('instruction-selection').disabled = !selected || Boolean(overlap);
  $('expression-destination').textContent = `Preview alternatives in ${target || 'your writing language'}. Nothing changes until you accept.`;
}
