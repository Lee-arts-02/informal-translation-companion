const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));

export function placeToolbar(anchor, size, viewport) {
  const gap = 10, left = viewport.left + gap, top = viewport.top + gap;
  const right = viewport.left + viewport.width - gap, bottom = viewport.top + viewport.height - gap;
  const above = anchor.top - gap - size.height;
  const below = anchor.bottom + gap;
  const side = above >= top ? 'above' : below + size.height <= bottom ? 'below' : anchor.top - top >= bottom - anchor.bottom ? 'above' : 'below';
  return { left: clamp((anchor.left + anchor.right - size.width) / 2, left, right - size.width),
    top: clamp(side === 'above' ? above : below, top, bottom - size.height), side };
}

// Textareas expose offsets, not Range rectangles. Mirror their rendered text metrics.
export function selectionRect(textarea, start, end) {
  if (start >= end || end > textarea.value.length) return null;
  const box = textarea.getBoundingClientRect(), css = getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'fontKerning', 'fontFeatureSettings', 'fontVariantLigatures', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign', 'textIndent', 'textTransform', 'direction', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']) mirror.style[key] = css[key];
  const borders = parseFloat(css.borderLeftWidth) + parseFloat(css.borderRightWidth);
  Object.assign(mirror.style, { position: 'fixed', visibility: 'hidden', pointerEvents: 'none', boxSizing: 'border-box',
    left: `${box.left}px`, top: `${box.top}px`, width: `${textarea.clientWidth + borders}px`,
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', borderStyle: 'solid', margin: '0' });
  mirror.dir = textarea.dir;
  const selected = document.createTextNode(textarea.value.slice(start, end));
  mirror.append(document.createTextNode(textarea.value.slice(0, start)), selected, document.createTextNode(textarea.value.slice(end) || '\u200b'));
  document.body.append(mirror);
  try {
    const range = document.createRange(); range.selectNodeContents(selected);
    const viewport = window.visualViewport;
    const clip = { left: Math.max(box.left + parseFloat(css.borderLeftWidth), viewport?.offsetLeft || 0),
      right: Math.min(box.left + textarea.clientWidth + parseFloat(css.borderLeftWidth), (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth)),
      top: Math.max(box.top + parseFloat(css.borderTopWidth), viewport?.offsetTop || 0),
      bottom: Math.min(box.bottom - parseFloat(css.borderBottomWidth), (viewport?.offsetTop || 0) + (viewport?.height || innerHeight)) };
    for (const rect of range.getClientRects()) {
      const left = rect.left - textarea.scrollLeft, top = rect.top - textarea.scrollTop;
      const right = rect.right - textarea.scrollLeft, bottom = rect.bottom - textarea.scrollTop;
      if (bottom > clip.top && top < clip.bottom && right >= clip.left && left <= clip.right) return {
        left: Math.max(left, clip.left), right: Math.min(Math.max(right, left + 1), clip.right),
        top: Math.max(top, clip.top), bottom: Math.min(bottom, clip.bottom),
      };
    }
    return null;
  } finally { mirror.remove(); }
}
