export function addEvent(events, data) {
  const previous = events.at(-1);
  if (data.kind === 'manual-edit' && previous?.kind === 'manual-edit' && Date.now() - Date.parse(previous.at) < 1500) {
    return [...events.slice(0, -1), { ...previous, after: data.after, revision: data.revision, at: new Date().toISOString(), note: 'Continuous typing grouped into one edit.' }];
  }
  return [...events, { ...data, id: crypto.randomUUID(), at: new Date().toISOString() }];
}
export function makeSnapshot(input, text) {
  return { id: crypto.randomUUID(), text, draft: input.text, revision: input.revision,
    language: input.backLanguage, signature: input.signature, at: new Date().toISOString() };
}
export function snapshotCurrent(snapshot, input) {
  return Boolean(snapshot && snapshot.draft === input.text && snapshot.revision === input.revision
    && snapshot.language === input.backLanguage && snapshot.signature === input.signature);
}
export function checkReviewed(snapshot, input, reviewedId) {
  return snapshotCurrent(snapshot, input) && snapshot.id === reviewedId;
}
