import test from 'node:test';
import assert from 'node:assert/strict';
import { addMark, addNote, addGoal, rebaseNotes, notesInScope, minimalEdit } from '../canvas-notes.js';
import { revisionRequest, sentenceScope } from '../canvas-state.js';

test('selections and repeated requirements accumulate without replacing earlier notes', () => {
  const text = 'Send the draft on Friday. Keep me posted.';
  let notes = addNote([], text, 0, 4, 'Use a softer verb.');
  notes = addNote(notes, text, 18, 24, 'Keep the date.');
  notes = addNote(notes, text, 0, 4, 'Keep it friendly.');
  assert.equal(notes.length, 2);
  assert.deepEqual(notes[0].goals, ['Use a softer verb.', 'Keep it friendly.']);
  assert.equal(notes[1].quote, 'Friday');
  assert.deepEqual(addGoal(notes, notes[0].id, 'Keep it friendly.'), notes);
});

test('marking several passages does not require writing their requirements first', () => {
  const text = 'Send the draft.';
  let notes = addMark([],text,0,4); notes = addMark(notes,text,9,14);
  assert.equal(notes.length,2); assert.deepEqual(notes.map(n => n.goals),[[],[]]);
  notes = addGoal(notes,notes[0].id,'Softer.');
  assert.equal(notes.length,2); assert.equal(notes[1].quote,'draft');
});
test('sentence requests include every relevant goal, excluding other sentences/detached notes', () => {
  const text = 'Send the draft on Friday. Keep me posted.';
  let notes = addNote([], text, 0, 4, 'Softer.');
  notes = addNote(notes, text, 18, 24, 'Keep Friday.');
  notes = addNote(notes, text, 26, 30, 'Keep me.');
  const focus = {start:0,end:4};
  assert.equal(notesInScope(notes,sentenceScope(text,0,4)).length,2);
  const request = revisionRequest(text, focus, 'Softer.', [], 'English', 'openrouter/auto', notes);
  const payload = JSON.parse(request.body.messages[1].content);
  assert.deepEqual(payload.notes.map(x=>x.goals), [['Softer.'],['Keep Friday.']]);
});
test('adoption rebases later notes, retains requirements and detaches deleted anchors', () => {
  const text = 'Send the draft. Keep me posted.';
  let notes = addNote([],text,0,4,'Softer.');
  notes = addNote(notes,text,16,20,'Keep the wording.');
  const scope = sentenceScope(text,0,4), next = rebaseNotes(notes,scope,'Please send the draft.');
  assert.deepEqual(next[1].goals, notes[1].goals);
  assert.equal(next[1].start,23);
  const deleted = rebaseNotes(notes,scope,'the draft.');
  assert.equal(deleted[0].start,null);
  assert.deepEqual(deleted[0].goals,['Softer.']);
  assert.equal(deleted[0].quote,'Send');
});

test('typing rebases only the changed fragment and preserves Unicode boundaries', () => {
  const before = '文'.repeat(5999), edit = minimalEdit(before, before + '字');
  assert.equal(edit.scope.text, ''); assert.equal(edit.replacement, '字');
  assert.deepEqual(rebaseNotes([],edit.scope,edit.replacement), []);
  const emoji = minimalEdit('A😀B', 'A😁B');
  assert.equal(emoji.scope.text,'😀'); assert.equal(emoji.replacement,'😁');
  const text = 'Send the draft.', notes = addNote([],text,0,4,'Softer.');
  const change = minimalEdit(text,'Please '+text);
  const rebased = rebaseNotes(notes,change.scope,change.replacement,text);
  assert.equal(rebased[0].quote,'Send'); assert.equal(rebased[0].start,7);
});
