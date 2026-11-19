/** Kitten mode: line shown under "Sup?" after a wrong answer. One is picked at random. */
export const WRONG_PHRASES = [
  'That wasn’t it.',
  'Are you OK?',
  'Shake it off, next one.',
  'Close, but no.',
  '¿Todo bien?',
  'Casi, casi.',
  'A la próxima.',
]

export const pickRandom = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)]
