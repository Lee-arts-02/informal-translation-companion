import { parseIntents } from './intent-state.js';

export const writingDemos = [
  {
    id: 'gratitude', title: 'Keep the warmth', culture: '中文 + English',
    text: 'Thanks for your assistance，辛苦了！下次请你吃饭。',
    intent: 'Thank my classmate warmly and keep my offer to buy a meal.', avoid: 'Sounding formal or distant.',
    recipient: 'Classmate', relationship: 'We are friends working on a presentation.',
    protect: '辛苦了',
    suggestions: [
      { original: 'Thanks for your assistance', replacement: 'Thanks so much for your help',
        reason: '“Assistance” sounds more formal than a message to a classmate.',
        tradeoff: 'Warmer and more conversational; keeps the gratitude.', reader: 'A classmate may read this as a friendly personal thank-you.',
        zh: ['“assistance”较正式，给同学发消息时可以更自然。', '语气更亲近，保留感谢的意思。', '同学可能更容易感受到朋友之间的感谢。'] },
      { original: '下次请你吃饭。', replacement: 'I’ll treat you to a meal next time.',
        reason: 'Carries the meal offer into English without changing who is paying.',
        tradeoff: 'More explicit for an English reader; it retains the original commitment.', reader: 'The reader may understand this as an actual offer, not only a polite closing.',
        zh: ['把请吃饭的意思表达为英文，同时保留“我请客”。', '表达更明确，保留原来的承诺。', '读者可能把它理解为真实的邀请，而不只是客套。'] },
    ],
    starting: 'Thanks so much for your help—辛苦了! I’ll treat you to a meal next time.',
    back: '非常感谢你的帮助——辛苦了！下次我请你吃饭。',
  },
  {
    id: 'boundary', title: 'Kind, still direct', culture: 'English draft',
    text: 'You need to send your part today. I cannot keep waiting.',
    intent: 'Ask my teammate for their section today without weakening the deadline.', avoid: 'Blaming them or losing the deadline.',
    recipient: 'Teammate', relationship: 'We share responsibility for a group assignment.',
    protect: 'today',
    suggestions: [
      { original: 'You need to send your part', replacement: 'Could you please send your part', reason: 'Frames the request more gently.', tradeoff: 'Less forceful, but the protected deadline remains.', reader: 'A teammate may hear a request rather than an order.', zh: ['让请求更温和。', '语气更柔和，但保留截止时间。', '队友可能感受到请求，而不是命令。'] },
      { original: 'I cannot keep waiting.', replacement: 'I’m not able to wait any longer.', reason: 'Keeps the boundary while making the phrasing a little softer.', tradeoff: 'Still communicates urgency; does not add a new reason or promise.', reader: 'The teammate may hear a firm limit with less frustration.', zh: ['保留边界，同时稍微软化措辞。', '仍然表达紧迫性，不增加新的原因或承诺。', '队友可能感受到明确的限制，而不是强烈的抱怨。'] },
    ],
    starting: 'Could you please send your part today? I cannot keep waiting.',
    back: '你需要在今天发来你的部分。我不能一直等下去。',
  },
  {
    id: 'idiom', title: 'Keep the expression', culture: 'Urdu + English',
    text: 'Your work added four moons to this project. Shukriya!',
    intent: 'Celebrate my friend’s contribution and keep my own way of saying thanks.', avoid: 'Losing the warmth of the original idiom.',
    recipient: 'Friend', relationship: 'We made this project together.',
    protect: 'Shukriya!',
    suggestions: [{ original: 'Your work added four moons to this project.', replacement: 'Your work made this project shine.',
      reason: 'A literal idiom may be unfamiliar. This is one possible adaptation; you can reject it to keep the metaphor.',
      tradeoff: 'More familiar in English, but loses the specific four-moons image. Reject or edit if that image matters to you.',
      reader: 'A reader unfamiliar with the metaphor may need an explanation.', zh: ['直译的习语可能不熟悉；也可以拒绝建议，保留原来的比喻。', '英文更易理解，但失去“四个月亮”的具体意象；在意时可拒绝或编辑。', '不熟悉这个比喻的读者可能需要解释。'] }],
    starting: 'Your work made this project shine. Shukriya!', back: '你的贡献让这个项目更加出色。Shukriya!',
  },
];

writingDemos.push({
  id: 'promise', title: '“尽量” is not a promise', culture: '中文 intent → English draft',
  text: "I'll send it to you by Friday.",
  intent: '我会尽量周五给你，不要说得像保证。', avoid: 'Adding a guarantee or changing the date.',
  recipient: 'Friend', relationship: 'We are helping each other with a project.', protect: 'Friday',
  suggestions: [{ original: "I'll send it to you", replacement: "I'll try to send it to you",
    reason: 'Restores the uncertainty explicitly requested by the writer.', tradeoff: 'The date remains a target, not a guarantee.', reader: 'The reader may understand this as an intention to try.',
    zh: ['保留你明确表达的“尽量”。', '周五仍是目标，但不是确定承诺。', '读者可能理解为愿意尝试，而不是保证完成。'] }],
  starting: "I'll try to send it to you by Friday.", back: '我会在周五前发给你。',
});

export function demoReview(action, session, sample, language = 'English') {
  const chinese = language.startsWith('Chinese');
  if (!sample) throw new Error('Choose a curated example or switch to live mode for your own draft.');
  if (!['English', 'Chinese (Simplified)'].includes(language)) throw new Error('Curated explanations are available in English and Simplified Chinese. Switch to live mode for your chosen explanation language.');
  const variants = new Set([sample.text, sample.starting]);
  for (let mask = 0; mask < 2 ** sample.suggestions.length; mask++) {
    let draft = sample.text;
    sample.suggestions.forEach((item, index) => { if (mask & 2 ** index) draft = draft.replace(item.original, item.replacement); });
    variants.add(draft);
  }
  if (!variants.has(session.text)) throw new Error('This edited draft is outside the curated example. Switch to live mode for guidance on your own wording.');
  if (session.target && session.target !== 'English') throw new Error('Guided examples use English as the writing language. Switch to live mode for other languages.');
  if (action === 'back' && !session.backLanguage?.startsWith('Chinese')) throw new Error('The curated back-translation is in Simplified Chinese. Switch to live mode for other languages.');
  if (action === 'back' && session.backLanguage !== 'Chinese (Simplified)') throw new Error('The curated back-translation is in Simplified Chinese. Switch to live mode for Traditional Chinese.');
  if (action === 'start') return { draft: sample.starting };
  if (action === 'back') return { text: sample.id === 'promise' && session.text === sample.starting ? '我会尽量在周五前发给你。' : sample.back };
  if (action === 'intentions') return { intentions: parseIntents([
    { content: chinese ? sample.intent : `Keep the writer’s stated intention: ${sample.intent}`, evidence: sample.intent, category: 'meaning' },
    { content: chinese ? `避免：${sample.avoid}` : `Avoid: ${sample.avoid}`, evidence: sample.avoid, category: 'tone' },
  ], session) };
  if (action === 'repair' && sample.id !== 'promise') throw new Error('The authored repair journey is in the “尽量” example. Use live mode for other repairs.');
  if (action === 'repair' && !/尽量|保证|承诺|try|uncertain|promise|guarantee|commitment/i.test(session.correction || '')) throw new Error('This authored repair demonstrates preserving uncertainty. Switch to live mode for other feedback.');
  if (action === 'reflect') return {
    meaning: chinese ? '这是演示说明，不是实时判断。请比较原稿与当前草稿，特别检查承诺、情绪和受保护表达。' : 'Authored demo guidance, not a live assessment: compare the original and current draft for promises, emotion, and protected expressions.',
    reader: chinese ? '读者的理解可能不同。可以询问对方，或邀请朋友反馈；不要把文化背景当成固定规则。' : 'Readers may interpret this differently. Ask your reader or invite a friend; cultural background does not determine an individual response.',
    questions: [chinese ? '修改后的文字仍然像你自己会说的话吗？' : 'Does the current draft still sound like something you would say?'],
  };
  const suggestions = sample.suggestions.flatMap((item, index) => {
    const start = session.text.indexOf(item.original), end = start + item.original.length;
    if (start < 0 || session.protected.some(span => start < span.end && end > span.start)) return [];
    if (session.scope === 'selection' && (start < session.selection.start || end > session.selection.end)) return [];
    if (session.scope === 'grammar') return [];
    const rejected = session.feedback.some(f => f.action === 'rejected' && f.original === item.original);
    if (rejected) return [];
    return [{ ...item, id: `demo-${index}`, revision: session.revision, start, end, intentIds: session.intentions?.slice(0, 1).map(x => x.id) || [],
      reason: chinese ? item.zh[0] : item.reason, tradeoff: chinese ? item.zh[1] : item.tradeoff, reader: chinese ? item.zh[2] : item.reader }];
  });
  return { summary: chinese ? '演示建议由人工编写，不会根据新草稿或新背景生成内容。接受或拒绝后可再查看；实时模式会使用你的反馈。' : 'Authored demo suggestions, not generated for new text or context. Rejected passages are omitted on the next review. Live mode uses your context and explicit feedback.', suggestions };
}
