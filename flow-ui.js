import { $, make } from './ui-helpers.js';

export function initFlowGuide({ editGoal, reviewIntentions = editGoal, write, check, refine, copy }) {
  let next = write;
  $('flow-intention').addEventListener('click', reviewIntentions);
  $('edit-draft-goal').addEventListener('click', editGoal);
  $('flow-next-action').addEventListener('click', () => next());
  return { refresh(state) {
    $('flow-guide').classList.toggle('is-empty', !state.text.trim() && !state.goal && !state.intentions.length);
    const confirmed = state.intentions.filter(x => x.confirmed), pending = state.intentions.length - confirmed.length;
    $('goal-anchor-text').textContent = state.goal || confirmed[0]?.content || 'No goal added yet. You can write first.';
    $('check-intent-reference').textContent = [state.goal, ...confirmed.map(x => x.content), state.avoid ? `Avoid: ${state.avoid}` : ''].filter(Boolean).join(' · ') || 'No intended meaning added yet. Compare this draft with what you want to say, or add your own intention.';
    $('request-input-summary').textContent = `Refinement receives your current and original drafts, explicit context, protected expressions, ${confirmed.length} confirmed intention(s), ${state.habits.length} matching habit(s)${state.hasSample ? ' and your enabled writing sample' : ''}.`;
    $('confirmed-input-list').replaceChildren();
    for (const item of confirmed) $('confirmed-input-list').append(make('span', item.content, 'input-chip'));
    if (state.avoid) $('confirmed-input-list').append(make('span', `Avoid: ${state.avoid}`, 'input-chip'));
    if (pending) $('confirmed-input-list').append(make('p', `${pending} AI interpretation(s) awaiting your judgment — not used as writing instructions.`, 'help'));
    $('request-input-status').textContent = !state.lastInputs ? 'No request yet. Nothing is sent until you ask.'
      : `${state.demo ? 'Authored demo step' : 'Last request'}: ${state.lastInputs.action} · revision ${state.lastInputs.revision}. ${state.lastInputs.signature === state.signature && state.lastInputs.revision === state.revision ? 'These inputs are still current.' : 'Your text or inputs have changed since that request.'}`;
    let title, detail, action;
    if (!state.text.trim()) {
      title = 'Start with a few words.'; detail = 'Any language, or a mix.'; action = ['Start writing', write];
    } else if (state.reviewed) {
      title = 'You marked this version as matching.'; detail = 'Copy when ready. Remembering is optional.'; action = ['Copy my draft', copy];
    } else if (state.suggestions) {
      title = `${state.suggestions} suggestion${state.suggestions === 1 ? '' : 's'} ready.`; detail = 'Nothing changes until you choose an option.'; action = ['Review suggestions', write];
    } else if (state.snapshot && !state.fresh) {
      title = 'This check is out of date.'; detail = 'Create a new check for this version.'; action = ['Check updated draft', check];
    } else if (state.fresh) {
      title = 'Does the meaning still fit?'; detail = 'Flag a mismatch, or mark it as matching.'; action = ['Continue my check', check];
    } else if (pending && !state.intentionsDeferred) {
      title = 'Does this interpretation fit?'; detail = 'Only confirmed intentions guide writing.'; action = ['Review intentions', reviewIntentions];
    } else if (state.hasReview) {
      title = 'Ready to check your meaning?'; detail = 'Read this same draft in a familiar language.'; action = ['Check this draft', check];
    } else {
      title = 'Ready for a little help?'; detail = state.demo ? 'Authored example · no API key needed.' : state.connected ? 'Suggestions change nothing until you accept.' : 'Personal AI suggestions use your own API key.'; action = [state.demo || state.connected ? 'Get suggestions' : 'Connect my AI', refine];
    }
    $('flow-next-title').textContent = title; $('flow-next-detail').textContent = detail;
    $('flow-next-action').textContent = action[0]; next = action[1];
  } };
}
