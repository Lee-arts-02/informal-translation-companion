// Text offsets use JavaScript/textarea UTF-16 units, with surrogate boundaries checked.
function validateText(text) {
  if (typeof text !== 'string' || text.length > 6000) throw new Error('Keep your draft within 6,000 characters.');
}
function boundary(text, index) {
  return !(index > 0 && index < text.length && /[\uD800-\uDBFF]/.test(text[index - 1]) && /[\uDC00-\uDFFF]/.test(text[index]));
}
export function validateRange(text, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length || !boundary(text, start) || !boundary(text, end)) {
    throw new Error('Select a complete word or phrase in the current draft.');
  }
}
function checkpoint(state) {
  const snapshot = { text: state.text, protected: state.protected.map(x => ({ ...x })), feedback: [...state.feedback] };
  return { ...state, revision: state.revision + 1, history: [...state.history.slice(-39), snapshot] };
}
export function createSession(text = '') {
  validateText(text);
  return { original: text, text, revision: 0, protected: [], history: [], feedback: [] };
}
export function protectSpan(state, start, end) {
  validateRange(state.text, start, end);
  if (state.protected.some(span => start < span.end && end > span.start)) throw new Error('This selection overlaps an existing protected expression.');
  if (state.protected.length >= 20) throw new Error('You can protect up to 20 expressions per session.');
  const next = checkpoint(state);
  return { ...next, protected: [...next.protected, { start, end, text: state.text.slice(start, end) }].sort((a, b) => a.start - b.start) };
}
export function unprotectSpan(state, index) {
  return { ...checkpoint(state), protected: state.protected.filter((_, i) => i !== index) };
}
function patch(state, start, end, replacement) {
  if (typeof replacement !== 'string') throw new Error('Enter a replacement.');
  if (state.protected.some(span => start < span.end && end > span.start || start === end && start > span.start && start < span.end)) {
    throw new Error('That change touches a protected expression. Unprotect it first if you want to edit it.');
  }
  const text = state.text.slice(0, start) + replacement + state.text.slice(end);
  validateText(text);
  const shift = replacement.length - (end - start);
  return { ...checkpoint(state), text, protected: state.protected.map(span => span.start >= end ? { ...span, start: span.start + shift, end: span.end + shift } : { ...span }) };
}
export function applySuggestion(state, suggestion, replacement = suggestion.replacement) {
  if (suggestion.revision !== state.revision) throw new Error('This suggestion is stale. Review the current draft again.');
  validateRange(state.text, suggestion.start, suggestion.end);
  if (state.text.slice(suggestion.start, suggestion.end) !== suggestion.original) throw new Error('This suggestion no longer matches your draft.');
  if (!boundary(state.text, suggestion.start) || !boundary(state.text, suggestion.end)) throw new Error('Invalid text boundary.');
  return patch(state, suggestion.start, suggestion.end, replacement);
}
export function editDraft(state, text) {
  validateText(text);
  if (text === state.text) return state;
  let start = 0;
  while (start < text.length && start < state.text.length && text[start] === state.text[start]) start++;
  // Widen a changed emoji to encompass the full surrogate pair.
  if (!boundary(state.text, start) || !boundary(text, start)) start--;
  let oldEnd = state.text.length;
  let newEnd = text.length;
  while (oldEnd > start && newEnd > start && state.text[oldEnd - 1] === text[newEnd - 1]) { oldEnd--; newEnd--; }
  if (!boundary(state.text, oldEnd) || !boundary(text, newEnd)) { oldEnd++; newEnd++; }
  return patch(state, start, oldEnd, text.slice(start, newEnd));
}
function occurrences(text, phrase) {
  const indexes = []; let offset = 0;
  while (offset <= text.length) { const index = text.indexOf(phrase, offset); if (index < 0) break; indexes.push(index); offset = index + phrase.length; }
  return indexes;
}
export function startingDraft(state, text) {
  validateText(text);
  if (!text.trim()) throw new Error('The starting draft is empty.');
  const protectedSpans = state.protected.map(span => {
    const before = occurrences(state.text, span.text), after = occurrences(text, span.text);
    if (after.length < before.length) throw new Error('The starting draft dropped a protected expression. Try again.');
    const start = after[before.indexOf(span.start)];
    if (start === undefined) throw new Error('Could not preserve a protected expression.');
    return { start, end: start + span.text.length, text: span.text };
  });
  protectedSpans.sort((a, b) => a.start - b.start);
  if (protectedSpans.some((span, index) => index > 0 && span.start < protectedSpans[index - 1].end)) {
    throw new Error('The starting draft makes protected expressions overlap. Try again while keeping their original order.');
  }
  return { ...checkpoint(state), text, protected: protectedSpans };
}
export function recordFeedback(state, action, reason = '', original = '') {
  if (!['accepted', 'edited', 'rejected', 'peer'].includes(action)) throw new Error('Unknown feedback action.');
  const item = { action, reason: String(reason).slice(0, 1000), original: String(original).slice(0, 1000) };
  return { ...state, feedback: [...state.feedback.slice(-19), item] };
}
export function undo(state) {
  if (!state.history.length) return state;
  const snapshot = state.history.at(-1);
  return { ...state, ...snapshot, revision: state.revision + 1, history: state.history.slice(0, -1) };
}
export function rebaseSuggestions(suggestions, applied, next, replacement) {
  const shift = replacement.length - applied.original.length;
  return suggestions.filter(item => item !== applied && item.revision === applied.revision
    && !(item.start < applied.end && item.end > applied.start)).flatMap(item => {
    const start = item.start >= applied.end ? item.start + shift : item.start;
    const end = start + item.original.length;
    if (next.text.slice(start, end) !== item.original) return [];
    return [{ ...item, start, end, revision: next.revision }];
  });
}
