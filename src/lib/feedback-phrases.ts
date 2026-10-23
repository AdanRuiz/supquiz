/** Lines shown to a player after the answer is revealed. One is picked at random. */
export const WRONG_PHRASES = [
  'That wasn’t it.',
  'Are you OK?',
  'Shake it off, next one.',
  'Close, but no.',
  '¿Todo bien?',
  'Casi, casi.',
  'A la próxima.',
]

export const CORRECT_PHRASES = ['Nailed it.']

export const pickRandom = (phrases: string[]) =>
  phrases[Math.floor(Math.random() * phrases.length)]
