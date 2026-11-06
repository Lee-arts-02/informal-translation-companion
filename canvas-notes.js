import { validateRange } from './writing-session.js';
import { wordDiff } from './canvas-state.js';

export function addGoal(notes, id, goal) {
  const value = goal.trim();
  if (!value || value.length > 400) throw new Error('Add a requirement between 1 and 400 characters.');
  return notes.map(note => {
    if (note.id !== id || note.goals.includes(value)) return note;
    if (note.goals.length >= 12) throw new Error('Keep up to 12 requirements per note.');
    return { ...note, goals: [...note.goals, value], accepted: false };
  });
}

export function addMark(notes, text, start, end) {
  validateRange(text, start, end);
  const existing = notes.find(note => note.start === start && note.end === end);
  if (existing) return notes;
  if (notes.length >= 24) throw new Error('Keep up to 24 marked passages. Remove a note first.');
  const note = { id: Math.max(0, ...notes.map(x => x.id)) + 1, start, end,
    quote: text.slice(start, end), goals: [], accepted: false, needsReview: false };
  return [...notes, note];
}

export function addNote(notes, text, start, end, goal) {
  const marked = addMark(notes, text, start, end);
  return addGoal(marked, marked.find(n => n.start === start && n.end === end).id, goal);
}

export function notesInScope(notes, scope) {
  return notes.filter(note => note.start !== null && note.start < scope.end && note.end > scope.start);
}

export function minimalEdit(before, after) {
  let start = 0, suffix = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  const splitsPair = (text, at) => /[\uD800-\uDBFF]/.test(text[at - 1] || '') && /[\uDC00-\uDFFF]/.test(text[at] || '');
  if (splitsPair(before, start) || splitsPair(after, start)) start--;
  while (suffix < before.length - start && suffix < after.length - start && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  if (splitsPair(before, before.length - suffix) || splitsPair(after, after.length - suffix)) suffix--;
  return { scope: { start, end: before.length - suffix, text: before.slice(start, before.length - suffix) },
    replacement: after.slice(start, after.length - suffix) };
}

// A changed block maps to its replacement; deleted anchors remain as detached notes.
// Insertion at the beginning of a focus belongs outside it (right-biased start).
export function rebaseNotes(notes, scope, replacement, fullText) {
  if (!notes.some(n => n.start !== null && n.end > scope.start)) return notes;
  const parts = wordDiff(scope.text, replacement, { start: 0, end: scope.text.length });
  function mapped(offset, right) {
    let old = 0, now = 0, index = 0;
    while (index < parts.length) {
      if (parts[index].kind === 'same') {
        const length = parts[index].text.length;
        if (offset < old + length || offset === old && !right) return now + Math.max(0, offset - old);
        old += length; now += length; index++; continue;
      }
      let removed = 0, added = 0;
      while (index < parts.length && parts[index].kind !== 'same') {
        const item = parts[index++];
        if (item.kind === 'del') removed += item.text.length; else added += item.text.length;
      }
      if (offset === old && !removed) return now + (right ? added : 0);
      if (offset < old + removed) return now + (right && offset > old ? added : 0);
      old += removed; now += added;
    }
    return now;
  }
  const delta = replacement.length - scope.text.length;
  const nextText = typeof fullText === 'string' ? fullText.slice(0, scope.start) + replacement + fullText.slice(scope.end) : null;
  return notes.map(note => {
    if (note.start === null || note.end <= scope.start) return note;
    if (note.start >= scope.end) return { ...note, start: note.start + delta, end: note.end + delta };
    const start = note.start < scope.start ? note.start : scope.start + mapped(note.start - scope.start, true);
    const end = note.end > scope.end ? note.end + delta : scope.start + mapped(note.end - scope.start, false);
    if (end <= start) return { ...note, start: null, end: null, needsReview: true, accepted: false };
    const quote = nextText ? nextText.slice(start, end) : start >= scope.start && end <= scope.start + replacement.length
      ? replacement.slice(start - scope.start, end - scope.start) : note.quote;
    return { ...note, start, end, quote, needsReview: quote !== note.quote || note.needsReview };
  });
}
