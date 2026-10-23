// Authored examples for the portfolio. These are never presented as AI responses.
export const demos = [
  {
    id: 'urdu', title: 'A little appreciation', language: 'Urdu', native: 'اردو', category: 'FRIENDSHIP',
    text: 'Aapne toh iss project mein char chand laga diye!', source: 'Urdu', target: 'English',
    tone: 'Warm', recipient: 'Friend', channel: 'Text message',
    translation: 'You really brought something special to this project!',
    alternatives: { casual: 'You made this project shine!', direct: 'Your contribution made this project much better.',
      formal: 'Your contribution has considerably enhanced the quality of this project.' },
    nuance: '“Char chand laga diye” literally evokes adding four moons. It expresses admiration for making something more beautiful or impressive. “Brought something special” carries that warmth into natural English.',
  },
  {
    id: 'spanish', title: 'Reassurance at work', language: 'Spanish', native: 'Español', category: 'WORKPLACE',
    text: 'No te preocupes mi hermano, eso lo arreglamos en un abrir y cerrar de ojos.', source: 'Spanish', target: 'English',
    tone: 'Professional', recipient: 'Supervisor', channel: 'Email',
    translation: 'Please don’t worry; we can resolve this very quickly.',
    alternatives: { casual: 'No worries, we can fix that in no time!', direct: 'We can resolve this quickly.',
      formal: 'Please be reassured that we can resolve this matter promptly.' },
    nuance: '“En un abrir y cerrar de ojos” means “in the blink of an eye.” The workplace version preserves reassurance while omitting the very familiar “mi hermano.” It avoids adding a deadline absent from the original.',
  },
  {
    id: 'french', title: 'A shared frustration', language: 'French', native: 'Français', category: 'EVERYDAY LIFE',
    text: 'C’est n’importe quoi leur nouveau portail, je n’y comprends rien du tout.', source: 'French', target: 'English',
    tone: 'Empathetic', recipient: 'Support group', channel: 'Community forum',
    translation: 'Their new portal is really frustrating; I’m having a hard time making sense of it.',
    alternatives: { casual: 'Their new portal is a mess. I can’t make heads or tails of it!',
      direct: 'Their new portal makes no sense to me.', formal: 'I find their new portal confusing and difficult to understand.' },
    nuance: '“C’est n’importe quoi” conveys strong frustration, not merely confusion. This version softens the criticism for a support group while keeping the speaker’s frustration and first-person perspective.',
  },
];
