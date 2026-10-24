export const $ = id => document.getElementById(id);
export function make(tag, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
export function button(text, action, className = 'button small outline') {
  const node = make('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function download(name, content, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = make('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function expandWritingTools(section) {
  if (section === 'intent-panel' || section === 'context-panel') {
    $('writing-tools').open = false;
    $('context-panel').open = true;
    if (section === 'intent-panel') { $('intent-panel').hidden = false; $('intent-panel').open = true; }
    return;
  }
  $('intent-panel').hidden = true; $('intent-panel').open = false;
  $('writing-tools').open = true;
  if (section) $(section).open = true;
}
export function closeWritingTools() {
  $('writing-tools').open = false;
  $('context-panel').open = false;
  $('intent-panel').hidden = true; $('intent-panel').open = false;
}
export function showPanel(name, open = true) {
  if (!open) {
    for (const value of ['suggestions', 'check', 'history']) $(`panel-${value}`).hidden = true;
    $('suggestions-panel').classList.remove('is-open');
    return;
  }
  closeWritingTools();
  $(`panel-${name}`).hidden = false;
  if (name === 'history') { $('writing-tools').open = true; $('panel-history').scrollIntoView({ block: 'start' }); }
  else $('suggestions-panel').classList.add('is-open');
  const section = $(`panel-${name}`); section.tabIndex = -1; section.focus();
}
