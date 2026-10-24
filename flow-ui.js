import { $, make } from './ui-helpers.js';

export function initFlowGuide({ editGoal, reviewIntentions = editGoal, write, check, remember }) {
  let next = write;
  $('flow-intention').addEventListener('click', reviewIntentions);
  $('flow-writing').addEventListener('click', write);
  $('flow-check').addEventListener('click', check);
  $('flow-memory').addEventListener('click', remember);
  $('edit-draft-goal').addEventListener('click', editGoal);
  $('flow-next-action').addEventListener('click', () => next());
  return { refresh(state) {
    $('flow-guide').classList.toggle('is-empty', !state.text.trim() && !state.goal && !state.intentions.length);
    const confirmed = state.intentions.filter(x => x.confirmed), pending = state.intentions.length - confirmed.length;
    $('goal-anchor-text').textContent = state.goal || confirmed[0]?.content || 'No goal added yet. You can write first.';
    $('request-input-summary').textContent = `Refinement receives your current and original drafts, explicit context, protected expressions, ${confirmed.length} confirmed intention(s), ${state.habits.length} matching habit(s)${state.hasSample ? ' and your enabled writing sample' : ''}.`;
    $('confirmed-input-list').replaceChildren();
    for (const item of confirmed) $('confirmed-input-list').append(make('span', item.content, 'input-chip'));
    if (state.avoid) $('confirmed-input-list').append(make('span', `Avoid: ${state.avoid}`, 'input-chip'));
    if (pending) $('confirmed-input-list').append(make('p', `${pending} AI interpretation(s) awaiting your judgment — not used as writing instructions.`, 'help'));
    $('request-input-status').textContent = !state.lastInputs ? 'No request yet. Nothing is sent until you ask.'
      : `${state.demo ? 'Authored demo step' : 'Last request'}: ${state.lastInputs.action} · revision ${state.lastInputs.revision}. ${state.lastInputs.signature === state.signature && state.lastInputs.revision === state.revision ? 'These inputs are still current.' : 'Your text or inputs have changed since that request.'}`;
    let title, detail, action, current = 'writing';
    if (!state.text.trim()) {
      title = 'Start with what you want to say.'; detail = 'Write in any language. You can add a goal later.'; action = ['Start writing', write];
    } else if (state.reviewed) {
      title = 'You marked this version as matching your meaning.'; detail = 'You can copy it when ready. Saving a future habit is optional, and this is your judgment rather than a guarantee.'; action = ['Back to my draft', write]; current = 'check';
    } else if (state.suggestions) {
      title = `${state.suggestions} expression option(s) to consider.`; detail = 'Review the offered wording. Nothing changes until you choose it; keeping your wording is always valid.'; action = ['Review my wording', write];
    } else if (state.snapshot && !state.fresh) {
      title = 'Your wording or context changed after the last check.'; detail = 'The earlier view is kept for reference. Create a new check before reviewing or repairing this version.'; action = ['Check the new version', check]; current = 'check';
    } else if (state.fresh) {
      title = 'Read the language check and decide what fits.'; detail = 'Mark a mismatch and explain it, or say this version matches your meaning. You can keep editing either way.'; action = ['Continue my check', check]; current = 'check';
    } else if (pending) {
      title = 'Does this interpretation fit what you mean?'; detail = 'AI guesses are not yet instructions. Confirm, edit or remove them; you can also continue writing without them.'; action = ['Review my intentions', reviewIntentions]; current = 'intention';
    } else {
      title = 'Shape your words, then check any meaning you’re unsure about.'; detail = 'Ask for local suggestions or inspect the draft in a familiar language. No step is required to copy your writing.'; action = ['Check my meaning', check];
    }
    if (state.candidate && !state.suggestions) detail += ' You can also review the optional habit suggested by your correction.';
    $('flow-next-title').textContent = title; $('flow-next-detail').textContent = detail;
    $('flow-next-action').textContent = action[0]; next = action[1];
    for (const key of ['intention', 'writing', 'check', 'memory']) {
      const node = $(`flow-${key}`); if (key === current) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
    }
  } };
}
