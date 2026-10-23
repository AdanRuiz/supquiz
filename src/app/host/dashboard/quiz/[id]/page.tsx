'use client'

import {
  draftToPayload,
  MAX_CHOICES,
  MAX_NAME_LENGTH,
  MAX_QUESTIONS,
  MIN_CHOICES,
  parseQuestionJson,
  QuizChoiceDraft,
  QuizDraft,
  QuizQuestionDraft,
  questionToJson,
  quizSetToDraft,
  validateQuestion,
} from '@/lib/quiz-json'
import { QuizSet, supabase } from '@/types/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useStaffUser } from '../../shell'

// Answer colors in the same order as the game screens
const CHOICE_COLORS = [
  { swatch: 'bg-red-500', ring: 'focus-within:ring-red-500' },
  { swatch: 'bg-blue-500', ring: 'focus-within:ring-blue-500' },
  { swatch: 'bg-yellow-400', ring: 'focus-within:ring-yellow-500' },
  { swatch: 'bg-green-500', ring: 'focus-within:ring-green-500' },
]

// Local keys so React can track questions/answers that have no id yet
type Keyed<T> = T & { key: string }
type ChoiceState = Keyed<QuizChoiceDraft>
type QuestionState = Keyed<Omit<QuizQuestionDraft, 'choices'> & { choices: ChoiceState[] }>
type DraftState = Omit<QuizDraft, 'questions'> & { questions: QuestionState[] }

let keyCounter = 0
const newKey = () => `k${++keyCounter}`

const blankChoice = (isCorrect = false): ChoiceState => ({ key: newKey(), body: '', is_correct: isCorrect })
const blankQuestion = (): QuestionState => ({
  key: newKey(),
  body: '',
  choices: [blankChoice(true), blankChoice(), blankChoice(), blankChoice()],
})

const withKeys = (draft: QuizDraft): DraftState => ({
  ...draft,
  questions: draft.questions.map((question) => ({
    ...question,
    key: newKey(),
    choices: question.choices.map((choice) => ({ ...choice, key: newKey() })),
  })),
})

const stripKeys = (draft: DraftState): QuizDraft => ({
  ...draft,
  questions: draft.questions.map(({ key: _q, choices, ...question }) => ({
    ...question,
    choices: choices.map(({ key: _c, ...choice }) => choice),
  })),
})

/** A new question nobody has typed into yet: safe to drop when leaving it. */
const isUntouched = (question: QuestionState) =>
  !question.id && !question.body.trim() && question.choices.every((c) => !c.body.trim())

const loadQuiz = (id: string) =>
  supabase
    .from('quiz_sets')
    .select(`*, questions(*, choices(*))`)
    .eq('id', id)
    .order('order', { ascending: true, referencedTable: 'questions' })
    .order('order', { ascending: true, referencedTable: 'questions.choices' })
    .maybeSingle()

/** Copy database ids onto the draft (same positions), keeping React keys. */
const syncIds = (draft: DraftState, saved: QuizSet): DraftState => {
  const savedDraft = quizSetToDraft(saved)
  return {
    ...draft,
    id: saved.id,
    questions: draft.questions.map((question, qi) => ({
      ...question,
      id: savedDraft.questions[qi]?.id,
      choices: question.choices.map((choice, ci) => ({
        ...choice,
        id: savedDraft.questions[qi]?.choices[ci]?.id,
      })),
    })),
  }
}

type LoadState = 'loading' | 'ready' | 'not-found' | 'forbidden'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function QuizEditorPage({ params }: { params: { id: string } }) {
  const isNewRoute = params.id === 'new'
  const user = useStaffUser()
  const router = useRouter()

  const [loadState, setLoadState] = useState<LoadState>(isNewRoute ? 'ready' : 'loading')
  const [draft, setDraft] = useState<DraftState>(() => ({
    name: '',
    description: '',
    questions: [blankQuestion()],
  }))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [problems, setProblems] = useState<string[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // JSON mode: the current question is shown and edited as JSON
  const [isJsonMode, setIsJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const current = draft.questions[currentIndex]
  const isLast = currentIndex === draft.questions.length - 1
  const isSaving = saveState === 'saving'

  useEffect(() => {
    if (isNewRoute) return
    loadQuiz(params.id).then(({ data, error }) => {
      if (error || !data) {
        setLoadState('not-found')
        return
      }
      if (data.created_by && data.created_by !== user.id) {
        setLoadState('forbidden')
        return
      }
      setDraft(withKeys(quizSetToDraft(data)))
      setLoadState('ready')
    })
  }, [isNewRoute, params.id, user.id])

  // Refresh the JSON when switching question or turning JSON mode on
  const currentKey = current?.key
  useEffect(() => {
    if (!isJsonMode || !current) return
    setJsonText(questionToJson(current))
    setJsonError(null)
    // Only when the question or mode changes, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJsonMode, currentKey])

  // ---- draft updates -------------------------------------------------------
  const updateCurrent = (change: (q: QuestionState) => QuestionState) => {
    setProblems([])
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) => (i === currentIndex ? change(q) : q)),
    }))
  }

  const updateChoice = (choiceKey: string, change: (c: ChoiceState) => ChoiceState) =>
    updateCurrent((q) => ({ ...q, choices: q.choices.map((c) => (c.key === choiceKey ? change(c) : c)) }))

  const onJsonChange = (text: string) => {
    setJsonText(text)
    try {
      const parsed = parseQuestionJson(text)
      setJsonError(null)
      // Keep database ids by position so past results stay linked
      updateCurrent((q) => ({
        ...q,
        body: parsed.body,
        choices: parsed.choices.map((choice, i) => ({
          ...choice,
          id: q.choices[i]?.id,
          key: q.choices[i]?.key ?? newKey(),
        })),
      }))
    } catch (error) {
      setJsonError((error as Error).message)
    }
  }

  // ---- saving --------------------------------------------------------------
  /** Saves the whole quiz (name + every question) and syncs the new ids. */
  const persist = async (toSave: DraftState): Promise<boolean> => {
    if (!toSave.name.trim()) {
      setProblems(['Give the quiz a name before saving.'])
      return false
    }
    setSaveState('saving')
    setSaveError(null)
    const { data: savedId, error } = await supabase.rpc('save_quiz_set', {
      payload: draftToPayload(stripKeys(toSave)),
    })
    if (error || !savedId) {
      console.error(error)
      setSaveState('error')
      setSaveError(error?.message || 'Couldn’t save. Try again.')
      return false
    }
    const { data: saved } = await loadQuiz(savedId)
    setDraft(saved ? syncIds(toSave, saved) : { ...toSave, id: savedId })
    setSaveState('saved')
    if (!toSave.id) {
      // A new quiz now exists: keep the address in sync without reloading
      window.history.replaceState(null, '', `/host/dashboard/quiz/${savedId}`)
    }
    return true
  }

  /**
   * Leave the current question: validate it, save, then go to `target`
   * (an index, 'new' to add a question at the end, or 'close').
   */
  const leaveCurrent = async (target: number | 'new' | 'close') => {
    if (isSaving || !current) return
    if (jsonError) {
      setProblems([`Fix the JSON first: ${jsonError}`])
      return
    }

    let questions = draft.questions
    let nextIndex = typeof target === 'number' ? target : currentIndex

    if (isUntouched(current) && questions.length > 1 && target !== 'new') {
      // Drop an empty new question instead of blocking navigation
      questions = questions.filter((_, i) => i !== currentIndex)
      if (typeof target === 'number' && target > currentIndex) nextIndex = target - 1
      if (nextIndex >= questions.length) nextIndex = questions.length - 1
    } else {
      const found = validateQuestion(current, `Question ${currentIndex + 1}`)
      if (found.length > 0) {
        setProblems(found)
        return
      }
    }

    setProblems([])
    const ok = await persist({ ...draft, questions })
    if (!ok) return

    if (target === 'close') {
      router.push('/host/dashboard')
      return
    }
    if (target === 'new') {
      if (questions.length >= MAX_QUESTIONS) {
        setProblems([`A quiz can have up to ${MAX_QUESTIONS} questions.`])
        return
      }
      setDraft((d) => ({ ...d, questions: [...d.questions, blankQuestion()] }))
      setCurrentIndex(questions.length)
      return
    }
    setCurrentIndex(nextIndex)
  }

  const deleteCurrent = async () => {
    if (isSaving || draft.questions.length === 1) return
    const questions = draft.questions.filter((_, i) => i !== currentIndex)
    const nextIndex = Math.min(currentIndex, questions.length - 1)
    setProblems([])
    setJsonError(null)
    if (!draft.id) {
      setDraft((d) => ({ ...d, questions }))
      setCurrentIndex(nextIndex)
      return
    }
    // Every remaining question was validated when it was left, so it can be saved
    const ok = await persist({ ...draft, questions })
    if (ok) setCurrentIndex(nextIndex)
  }

  const moveCurrent = (delta: number) => {
    const target = currentIndex + delta
    if (target < 0 || target >= draft.questions.length) return
    setDraft((d) => {
      const questions = [...d.questions]
      ;[questions[currentIndex], questions[target]] = [questions[target], questions[currentIndex]]
      return { ...d, questions }
    })
    setCurrentIndex(target)
  }

  // ---- states --------------------------------------------------------------
  if (loadState === 'loading') {
    return <p className="text-green-800 font-medium motion-safe:animate-breathe">Loading quiz…</p>
  }

  if (loadState === 'not-found' || loadState === 'forbidden') {
    return (
      <div className="max-w-xl rounded-2xl bg-white p-6 ring-1 ring-green-900/5">
        <h1 className="text-xl font-bold text-green-950">
          {loadState === 'forbidden' ? 'You can’t edit this quiz' : 'Quiz not found'}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {loadState === 'forbidden'
            ? 'Only the person who created it can make changes. You can export it and import a copy of your own.'
            : 'It may have been deleted.'}
        </p>
        <Link
          href="/host/dashboard"
          className="mt-5 inline-flex items-center h-10 px-4 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800"
        >
          Back to quiz sets
        </Link>
      </div>
    )
  }

  if (!current) return null

  const navButtonClass =
    'shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-white ring-1 ring-green-900/15 text-green-900 hover:bg-green-50 disabled:opacity-35 disabled:cursor-not-allowed'

  return (
    <div className="max-w-4xl pb-28">
      <Link
        href="/host/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-800 hover:text-green-950"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Quiz sets
      </Link>

      {/* Quiz details */}
      <section className="mt-4 rounded-3xl bg-green-700 text-white p-6 md:p-8 shadow-[0_16px_40px_-20px_rgba(2,44,22,0.7)]">
        <p className="text-sm font-semibold text-green-100">{draft.id ? 'Editing quiz' : 'New quiz'}</p>
        <label htmlFor="quiz-name" className="sr-only">
          Quiz name
        </label>
        <input
          id="quiz-name"
          value={draft.name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => {
            const value = e.currentTarget.value
            setProblems([])
            setDraft((d) => ({ ...d, name: value }))
          }}
          placeholder="Quiz name"
          className="mt-1 w-full bg-transparent text-3xl md:text-4xl font-extrabold tracking-tight placeholder:text-green-200/60 outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-white/60"
          autoFocus={isNewRoute}
        />
        <label htmlFor="quiz-description" className="mt-4 block text-sm font-semibold text-green-100">
          Description <span className="font-normal text-green-200">(optional)</span>
        </label>
        <textarea
          id="quiz-description"
          value={draft.description}
          onChange={(e) => {
            const value = e.currentTarget.value
            setDraft((d) => ({ ...d, description: value }))
          }}
          rows={2}
          maxLength={500}
          placeholder="What is this quiz about?"
          className="mt-1.5 w-full rounded-xl bg-white/10 px-4 py-3 text-base text-white placeholder:text-green-200/60 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/60 resize-y"
        />
      </section>

      {/* Question navigator */}
      <nav aria-label="Questions" className="mt-6 flex items-center gap-2">
        <button
          onClick={() => leaveCurrent(currentIndex - 1)}
          disabled={currentIndex === 0 || isSaving}
          className={navButtonClass}
          aria-label="Save and go to the previous question"
          title="Previous question"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <ol className="flex-grow min-w-0 flex flex-wrap gap-1.5">
          {draft.questions.map((question, index) => (
            <li key={question.key}>
              <button
                onClick={() => index !== currentIndex && leaveCurrent(index)}
                disabled={isSaving}
                aria-current={index === currentIndex ? 'step' : undefined}
                aria-label={`Question ${index + 1}`}
                className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-bold tabular-nums transition-colors ${
                  index === currentIndex
                    ? 'bg-green-700 text-white'
                    : question.id
                    ? 'bg-white text-green-900 ring-1 ring-green-900/15 hover:bg-green-50'
                    : 'bg-white text-gray-400 ring-1 ring-gray-300'
                }`}
              >
                {index + 1}
              </button>
            </li>
          ))}
        </ol>

        {isLast ? (
          <button
            onClick={() => leaveCurrent('new')}
            disabled={isSaving || draft.questions.length >= MAX_QUESTIONS}
            className={`${navButtonClass} !bg-green-600 !text-white !ring-0 hover:!bg-green-700`}
            aria-label="Save and add a new question"
            title="Save and add a question"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => leaveCurrent(currentIndex + 1)}
            disabled={isSaving}
            className={navButtonClass}
            aria-label="Save and go to the next question"
            title="Next question"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </nav>

      {/* Current question */}
      <section
        aria-label={`Question ${currentIndex + 1}`}
        className="mt-3 rounded-2xl bg-white p-5 ring-1 ring-green-900/5 shadow-[0_2px_8px_-4px_rgba(2,44,22,0.12)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-green-900">
            Question {currentIndex + 1}
            <span className="font-medium text-gray-400"> of {draft.questions.length}</span>
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setIsJsonMode((on) => !on)}
              aria-pressed={isJsonMode}
              className={`h-9 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${
                isJsonMode ? 'bg-green-700 text-white' : 'text-green-900 hover:bg-green-50'
              }`}
              title={isJsonMode ? 'Back to the form' : 'Edit as JSON'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
              </svg>
              JSON
            </button>
            <button
              onClick={() => moveCurrent(-1)}
              disabled={currentIndex === 0 || isSaving}
              className="w-9 h-9 grid place-items-center rounded-lg text-green-900 hover:bg-green-50 disabled:opacity-30"
              aria-label="Move this question earlier"
              title="Move earlier"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <button
              onClick={() => moveCurrent(1)}
              disabled={isLast || isSaving}
              className="w-9 h-9 grid place-items-center rounded-lg text-green-900 hover:bg-green-50 disabled:opacity-30"
              aria-label="Move this question later"
              title="Move later"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
            <button
              onClick={deleteCurrent}
              disabled={draft.questions.length === 1 || isSaving}
              className="w-9 h-9 grid place-items-center rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-30"
              aria-label={`Delete question ${currentIndex + 1}`}
              title="Delete question"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>

        {isJsonMode ? (
          <div className="mt-3">
            <label htmlFor="question-json" className="sr-only">
              Question {currentIndex + 1} as JSON
            </label>
            <textarea
              id="question-json"
              value={jsonText}
              onChange={(e) => onJsonChange(e.currentTarget.value)}
              spellCheck={false}
              rows={16}
              className={`w-full rounded-xl bg-green-950 px-4 py-3 font-mono text-sm leading-relaxed text-green-50 outline-none ring-2 resize-y ${
                jsonError ? 'ring-red-400' : 'ring-transparent focus:ring-green-500'
              }`}
            />
            <p className={`mt-1.5 text-xs ${jsonError ? 'font-semibold text-red-700' : 'text-gray-500'}`} aria-live="polite">
              {jsonError ?? `Edit "body" and the ${MIN_CHOICES}–${MAX_CHOICES} "choices". Changes apply as you type.`}
            </p>
          </div>
        ) : (
          <>
            <label htmlFor={`q-${current.key}`} className="sr-only">
              Question {currentIndex + 1} text
            </label>
            <textarea
              id={`q-${current.key}`}
              value={current.body}
              onChange={(e) => {
                const value = e.currentTarget.value
                updateCurrent((q) => ({ ...q, body: value }))
              }}
              rows={2}
              maxLength={300}
              placeholder="Type the question"
              autoFocus={!current.id}
              className="mt-2 w-full rounded-xl bg-green-50/60 px-4 py-3 text-lg font-semibold text-green-950 placeholder:text-gray-400 placeholder:font-normal outline-none ring-1 ring-green-900/10 focus:ring-2 focus:ring-green-600 resize-y"
            />

            <fieldset className="mt-4 min-w-0">
              <legend className="text-xs font-semibold text-gray-500">
                Answers — mark the correct one{current.choices.length > 2 ? 's' : ''}
              </legend>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {current.choices.map((choice, choiceIndex) => {
                  const color = CHOICE_COLORS[choiceIndex % CHOICE_COLORS.length]
                  return (
                    <div
                      key={choice.key}
                      className={`flex items-center gap-2 rounded-xl bg-white pl-2 pr-1.5 py-1.5 ring-1 ring-gray-200 focus-within:ring-2 ${color.ring} ${
                        choice.is_correct ? '!ring-2 !ring-green-600 bg-green-50' : ''
                      }`}
                    >
                      <span className={`w-3 h-8 shrink-0 rounded-md ${color.swatch}`} aria-hidden="true" />
                      <label htmlFor={`c-${choice.key}`} className="sr-only">
                        Answer {choiceIndex + 1}
                      </label>
                      <input
                        id={`c-${choice.key}`}
                        value={choice.body}
                        onChange={(e) => {
                          const value = e.currentTarget.value
                          updateChoice(choice.key, (c) => ({ ...c, body: value }))
                        }}
                        maxLength={120}
                        placeholder={`Answer ${choiceIndex + 1}`}
                        className="flex-grow w-0 min-w-0 h-9 bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none"
                      />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={choice.is_correct}
                        aria-label={`Answer ${choiceIndex + 1} is correct`}
                        onClick={() => updateChoice(choice.key, (c) => ({ ...c, is_correct: !c.is_correct }))}
                        className={`shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                          choice.is_correct ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Correct
                      </button>
                      {current.choices.length > MIN_CHOICES && (
                        <button
                          type="button"
                          onClick={() =>
                            updateCurrent((q) => ({ ...q, choices: q.choices.filter((c) => c.key !== choice.key) }))
                          }
                          className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          aria-label={`Remove answer ${choiceIndex + 1}`}
                          title="Remove answer"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {current.choices.length < MAX_CHOICES && (
                <button
                  type="button"
                  onClick={() => updateCurrent((q) => ({ ...q, choices: [...q.choices, blankChoice()] }))}
                  className="mt-2 text-sm font-semibold text-green-700 hover:text-green-900"
                >
                  + Add answer
                </button>
              )}
            </fieldset>
          </>
        )}
      </section>

      {(problems.length > 0 || saveError) && (
        <div role="alert" className="mt-4 rounded-2xl bg-red-50 ring-1 ring-red-200 px-5 py-4 text-sm text-red-900">
          <p className="font-bold">{saveError ? 'Couldn’t save' : 'Fix this before moving on'}</p>
          {saveError ? (
            <p className="mt-1">{saveError}</p>
          ) : (
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 z-10 bg-white/95 border-t border-green-900/10 px-4 md:px-10 py-3">
        <div className="max-w-4xl flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600" aria-live="polite">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
              ? 'All changes saved'
              : 'Changes save when you move to another question'}
          </p>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/host/dashboard"
              className="inline-flex items-center h-11 px-4 rounded-xl text-sm font-semibold text-green-900 hover:bg-green-50"
            >
              Close
            </Link>
            <button
              onClick={() => leaveCurrent('close')}
              disabled={isSaving}
              className="h-11 px-5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save and close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
