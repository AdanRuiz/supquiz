import type { QuizSet } from '@/types/types'

/**
 * Portable quiz format used for export and import.
 *
 * {
 *   "format": "supquiz.quiz.v1",
 *   "name": "My quiz",
 *   "description": "Optional",
 *   "questions": [
 *     { "body": "Question text", "choices": [
 *       { "body": "Answer", "is_correct": true },
 *       { "body": "Another", "is_correct": false }
 *     ] }
 *   ]
 * }
 */
export const QUIZ_FORMAT = 'supquiz.quiz.v1'

export const MAX_QUESTIONS = 100
export const MIN_CHOICES = 2
export const MAX_CHOICES = 4
export const MAX_NAME_LENGTH = 120

export type QuizChoiceDraft = { id?: string; body: string; is_correct: boolean }
export type QuizQuestionDraft = { id?: string; body: string; choices: QuizChoiceDraft[] }
export type QuizDraft = {
  id?: string
  name: string
  description: string
  questions: QuizQuestionDraft[]
}

export type QuizFile = {
  format: typeof QUIZ_FORMAT
  name: string
  description?: string
  questions: { body: string; choices: { body: string; is_correct: boolean }[] }[]
}

const byOrder = <T extends { order?: number | null }>(a: T, b: T) =>
  (a.order ?? 0) - (b.order ?? 0)

/** Turn a quiz loaded from Supabase into an editable draft (keeps ids). */
export const quizSetToDraft = (quizSet: QuizSet): QuizDraft => ({
  id: quizSet.id,
  name: quizSet.name,
  description: quizSet.description ?? '',
  questions: [...quizSet.questions].sort(byOrder).map((question) => ({
    id: question.id,
    body: question.body,
    choices: [...question.choices].sort(byOrder).map((choice) => ({
      id: choice.id,
      body: choice.body,
      is_correct: choice.is_correct,
    })),
  })),
})

/** Export format: no database ids, so the file can be imported anywhere. */
export const quizSetToFile = (quizSet: QuizSet): QuizFile => {
  const draft = quizSetToDraft(quizSet)
  return {
    format: QUIZ_FORMAT,
    name: draft.name,
    ...(draft.description ? { description: draft.description } : {}),
    questions: draft.questions.map((question) => ({
      body: question.body,
      choices: question.choices.map(({ body, is_correct }) => ({ body, is_correct })),
    })),
  }
}

export const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'quiz'

export const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Returns a list of problems; empty means the draft can be saved. */
export const validateDraft = (draft: QuizDraft): string[] => {
  const problems: string[] = []
  const name = draft.name.trim()
  if (!name) problems.push('Give the quiz a name.')
  if (name.length > MAX_NAME_LENGTH)
    problems.push(`The name can be up to ${MAX_NAME_LENGTH} characters.`)
  if (draft.questions.length === 0) problems.push('Add at least one question.')
  if (draft.questions.length > MAX_QUESTIONS)
    problems.push(`A quiz can have up to ${MAX_QUESTIONS} questions.`)

  draft.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`
    if (!question.body.trim()) problems.push(`${label} has no text.`)
    if (question.choices.length < MIN_CHOICES || question.choices.length > MAX_CHOICES)
      problems.push(`${label} needs between ${MIN_CHOICES} and ${MAX_CHOICES} answers.`)
    if (question.choices.some((choice) => !choice.body.trim()))
      problems.push(`${label} has an empty answer.`)
    if (!question.choices.some((choice) => choice.is_correct))
      problems.push(`${label} needs at least one correct answer.`)
  })
  return problems
}

/** What the save_quiz_set RPC expects. */
export const draftToPayload = (draft: QuizDraft) => ({
  ...(draft.id ? { id: draft.id } : {}),
  name: draft.name.trim(),
  description: draft.description.trim(),
  questions: draft.questions.map((question) => ({
    ...(question.id ? { id: question.id } : {}),
    body: question.body.trim(),
    choices: question.choices.map((choice) => ({
      ...(choice.id ? { id: choice.id } : {}),
      body: choice.body.trim(),
      is_correct: choice.is_correct,
    })),
  })),
})

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Parse an imported file. Accepts one quiz or an array of quizzes.
 * Throws an Error with a readable message when the file doesn't fit the format.
 */
export const parseQuizFile = (text: string): QuizDraft[] => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file isn’t valid JSON.')
  }

  const items = Array.isArray(data) ? data : [data]
  if (items.length === 0) throw new Error('The file has no quizzes.')
  if (items.length > 50) throw new Error('Import up to 50 quizzes at a time.')

  return items.map((item, quizIndex) => {
    const where = items.length > 1 ? `Quiz ${quizIndex + 1}: ` : ''
    if (!isObject(item)) throw new Error(`${where}expected an object with name and questions.`)
    if (typeof item.name !== 'string')
      throw new Error(`${where}missing "name".`)
    if (!Array.isArray(item.questions))
      throw new Error(`${where}missing "questions" list.`)

    const draft: QuizDraft = {
      name: item.name,
      description: typeof item.description === 'string' ? item.description : '',
      questions: item.questions.map((question, questionIndex) => {
        if (!isObject(question) || typeof question.body !== 'string' || !Array.isArray(question.choices))
          throw new Error(`${where}question ${questionIndex + 1} needs "body" and "choices".`)
        return {
          body: question.body,
          choices: question.choices.map((choice, choiceIndex) => {
            if (!isObject(choice) || typeof choice.body !== 'string')
              throw new Error(
                `${where}question ${questionIndex + 1}, answer ${choiceIndex + 1} needs "body".`
              )
            return { body: choice.body, is_correct: choice.is_correct === true }
          }),
        }
      }),
    }

    const problems = validateDraft(draft)
    if (problems.length > 0) throw new Error(`${where}${problems[0]}`)
    return draft
  })
}
