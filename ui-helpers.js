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
export function showPanel(name, open = true) {
  for (const value of ['suggestions', 'check', 'history']) {
    $(`panel-${value}`).hidden = value !== name;
    const tab = document.querySelector(`[data-panel="${value}"]`);
    tab.classList.toggle('active', value === name); tab.setAttribute('aria-pressed', String(value === name));
  }
  $('suggestions-panel').classList.toggle('is-open', open);
  if (open && matchMedia('(max-width:750px)').matches) $('close-companion')?.focus();
}
