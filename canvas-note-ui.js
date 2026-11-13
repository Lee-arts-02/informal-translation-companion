export function renderMarkedText(view, text, notes, offset = 0) {
  let pos = offset;
  for (const char of Array.from(text)) {
    const span = document.createElement('span'); span.textContent = char;
    span.dataset.start = pos; pos += char.length; span.dataset.end = pos;
    const marks = notes.filter(n => n.start !== null && +span.dataset.start >= n.start && pos <= n.end);
    if (marks.length) { span.className = 'focus-mark'; span.dataset.notes = marks.map(n => n.id).join(','); }
    view.append(span);
  }
}

export function renderNoteList(container, notes, activeId, t, onSelect, onRemove, onRemoveGoal) {
  container.replaceChildren(); container.hidden = !notes.length;
  for (const note of notes) {
    const row = document.createElement('article'); row.className = 'saved-note'; row.dataset.noteId = note.id;
    row.dataset.active = String(note.id === activeId);
    const head = document.createElement('div'); head.className = 'saved-note-head';
    const select = document.createElement('button'); select.type = 'button'; select.className = 'note-select';
    select.textContent = `${note.id} · “${note.quote}”`; select.setAttribute('aria-pressed', String(note.id === activeId));
    select.addEventListener('click', () => onSelect(note));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×';
    remove.className = 'icon-button'; remove.ariaLabel = `${t('remove')} ${note.id}`;
    remove.addEventListener('click', () => onRemove(note.id)); head.append(select, remove); row.append(head);
    const list = document.createElement('ul'); list.className = 'note-goals';
    note.goals.forEach((goal, index) => {
      const item = document.createElement('li'), label = document.createElement('span'), drop = document.createElement('button');
      label.textContent = goal; drop.textContent = '×'; drop.type = 'button'; drop.className = 'goal-remove';
      drop.ariaLabel = `${t('removeRequirement')} ${index + 1}`;
      drop.addEventListener('click', () => onRemoveGoal(note.id, index)); item.append(label, drop); list.append(item);
    });
    row.append(list);
    if (note.start === null || note.needsReview || note.accepted) {
      const status = document.createElement('span'); status.className = 'note-state';
      status.textContent = t(note.start === null ? 'detached' : note.needsReview ? 'reviewAnchor' : 'noteAccepted'); row.append(status);
    }
    container.append(row);
  }
}
