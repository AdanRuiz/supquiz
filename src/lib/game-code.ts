/** Game codes: 6 characters, no look-alike symbols (no 0/O, 1/I/L). Mirrors public.generate_game_code(). */
export const GAME_CODE_LENGTH = 6
const GAME_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

/** Uppercase and drop spaces/dashes people add when typing a code. */
export const normalizeGameCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '')

export const isValidGameCode = (code: string) => GAME_CODE_PATTERN.test(code)
