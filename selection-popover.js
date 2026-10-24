import { $, make } from './ui-helpers.js';
import { selectionRect, placeToolbar } from './selection-position.js';

let activeRange = null, currentKey = '', dismissed = false, scheduled = false;
function hide() {
  const toolbar = $('selection-workbench');
  if (toolbar.showPopover && toolbar.matches(':popover-open')) toolbar.hidePopover();
  toolbar.classList.remove('popover-fallback-open');
}
function position() {
  scheduled = false;
  if (!activeRange || dismissed) { hide(); return; }
  const draft = $('writing-draft'), toolbar = $('selection-workbench');
  const anchor = selectionRect(draft, activeRange.start, activeRange.end);
  const companionOpen = matchMedia('(max-width:750px)').matches && $('suggestions-panel').classList.contains('is-open');
  if (!anchor || companionOpen || document.querySelector('dialog[open]')) { hide(); return; }
  if (toolbar.showPopover) { if (!toolbar.matches(':popover-open')) toolbar.showPopover(); }
  else { if (toolbar.parentElement !== document.body) document.body.append(toolbar); toolbar.classList.add('popover-fallback-open'); }
  const view = window.visualViewport;
  const viewport = { left: view?.offsetLeft || 0, top: view?.offsetTop || 0, width: view?.width || innerWidth, height: view?.height || innerHeight };
  toolbar.style.maxWidth = `${Math.max(1, viewport.width - 20)}px`;
  toolbar.style.maxHeight = `${Math.max(1, viewport.height - 20)}px`;
  const placed = placeToolbar(anchor, toolbar.getBoundingClientRect(), viewport);
  toolbar.style.left = `${placed.left}px`; toolbar.style.top = `${placed.top}px`;
  toolbar.dataset.side = placed.side;
  toolbar.dataset.anchorTop = String(anchor.top); toolbar.dataset.anchorBottom = String(anchor.bottom);
}
export function refreshSelectionPopover(range, text) {
  const key = range ? `${range.start}:${range.end}:${text}` : '';
  if (key !== currentKey) dismissed = false;
  currentKey = key; activeRange = range;
  if (!range) hide();
  if (!scheduled) { scheduled = true; requestAnimationFrame(position); }
}
export function initSelectionPopover() {
  const toolbar = $('selection-workbench'), draft = $('writing-draft');
  const close = make('button', '×', 'selection-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close passage actions');
  close.addEventListener('click', () => { dismissed = true; hide(); draft.focus({ preventScroll: true }); });
  toolbar.querySelector('.selection-preview').append(close);
  const queue = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(position); } };
  window.addEventListener('scroll', queue, true); window.addEventListener('resize', queue);
  window.visualViewport?.addEventListener('resize', queue); window.visualViewport?.addEventListener('scroll', queue);
  if (window.ResizeObserver) new ResizeObserver(queue).observe(draft);
  const reopen = event => {
    if (event.key === 'Escape' || event.key === 'Tab') return;
    if (draft.selectionStart < draft.selectionEnd) { dismissed = false; queue(); }
  };
  draft.addEventListener('pointerup', reopen); draft.addEventListener('keyup', reopen);
  const isOpen = () => Boolean(toolbar.showPopover && toolbar.matches(':popover-open') || toolbar.classList.contains('popover-fallback-open'));
  draft.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.shiftKey || !isOpen()) return;
    const first = toolbar.querySelector('.selection-actions button:not(:disabled)');
    if (first) { event.preventDefault(); first.focus(); }
  });
  toolbar.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...toolbar.querySelectorAll('button:not(:disabled)')];
    const index = controls.indexOf(document.activeElement);
    if (event.shiftKey && index === 0) {
      event.preventDefault(); dismissed = true; hide(); draft.focus({ preventScroll: true });
    } else if (!event.shiftKey && index === controls.length - 1) {
      const outside = [...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
        .filter(node => node.tabIndex >= 0 && !node.disabled && !toolbar.contains(node) && node.getClientRects().length);
      event.preventDefault(); dismissed = true; hide();
      (outside[outside.indexOf(draft) + 1] || draft).focus({ preventScroll: true });
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!toolbar.contains(event.target) && event.target !== draft) { dismissed = true; hide(); }
  }, true);
  document.addEventListener('focusin', event => {
    if (!toolbar.contains(event.target) && event.target !== draft) { dismissed = true; hide(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault(); event.stopPropagation(); dismissed = true; hide(); draft.focus({ preventScroll: true });
    }
  }, true);
}
