// An inspectable working interpretation, never a claim about hidden model reasoning.
export function makeIntent(content, options = {}) {
  if (typeof content !== 'string' || !content.trim() || content.length > 400) throw new Error('Use an intention of 1–400 characters.');
  return { id: crypto.randomUUID(), content: content.trim(), category: options.category || 'expression',
    evidence: options.evidence || '', origin: options.origin === 'model' ? 'model' : 'user',
    confirmed: options.origin !== 'model' };
}
export function reviseIntent(item, content) {
  return { ...makeIntent(content), id: item.id, evidence: item.evidence, category: item.category };
}
export function parseIntents(items, input) {
  if (!Array.isArray(items) || items.length > 6) throw new Error('Invalid intention list.');
  const evidence = [input.text, input.intent, input.avoid, input.recipient, input.relationship].filter(Boolean);
  return items.map(item => {
    if (typeof item?.evidence !== 'string' || !item.evidence.trim() || item.evidence.length > 600 || !evidence.some(value => value.includes(item.evidence))) throw new Error('An intention has no matching evidence. Try again or add your own.');
    return makeIntent(item.content, { origin: 'model', evidence: item.evidence, category: typeof item.category === 'string' ? item.category.slice(0, 40) : 'expression' });
  });
}
