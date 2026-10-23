'use client'

import {
  draftToPayload,
  MAX_CHOICES,
  MAX_NAME_LENGTH,
  MAX_QUESTIONS,
  MIN_CHOICES,
  QuizChoiceDraft,
  QuizDraft,
  QuizQuestionDraft,
  quizSetToDraft,
  validateDraft,
} from '@/lib/quiz-json'
import { supabase } from '@/types/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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

type LoadState = 'loading' | 'ready' | 'not-found' | 'forbidden'

export default function QuizEditorPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new'
  const user = useStaffUser()
  const router = useRouter()

  const [loadState, setLoadState] = useState<LoadState>(isNew ? 'ready' : 'loading')
  const [draft, setDraft] = useState<DraftState>(() => ({
    name: '',
    description: '',
    questions: [blankQuestion()],
  }))
  const [problems, setProblems] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const problemsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isNew) return
    const load = async () => {
      const { data, error } = await supabase
        .from('quiz_sets')
        .select(`*, questions(*, choices(*))`)
        .eq('id', params.id)
        .order('order', { ascending: true, referencedTable: 'questions' })
        .order('order', { ascending: true, referencedTable: 'questions.choices' })
        .maybeSingle()
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
    }
    load()
  }, [isNew, params.id, user.id])

  // ---- draft updates -------------------------------------------------------
  const updateQuestion = (key: string, change: (q: QuestionState) => QuestionState) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.key === key ? change(q) : q)) }))

  const updateChoice = (
    questionKey: string,
    choiceKey: string,
    change: (c: ChoiceState) => ChoiceState
  ) =>
    updateQuestion(questionKey, (q) => ({
      ...q,
      choices: q.choices.map((c) => (c.key === choiceKey ? change(c) : c)),
    }))

  const moveQuestion = (index: number, delta: number) =>
    setDraft((d) => {
      const target = index + delta
      if (target < 0 || target >= d.questions.length) return d
      const questions = [...d.questions]
      ;[questions[index], questions[target]] = [questions[target], questions[index]]
      return { ...d, questions }
    })

  const removeQuestion = (key: string) =>
    setDraft((d) => ({ ...d, questions: d.questions.filter((q) => q.key !== key) }))

  const addQuestion = () =>
    setDraft((d) => ({ ...d, questions: [...d.questions, blankQuestion()] }))

  // ---- save ----------------------------------------------------------------
  const onSave = async () => {
    setSaveError(null)
    const clean = stripKeys(draft)
    const found = validateDraft(clean)
    setProblems(found)
    if (found.length > 0) {
      requestAnimationFrame(() => problemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }
    setIsSaving(true)
    const { error } = await supabase.rpc('save_quiz_set', { payload: draftToPayload(clean) })
    setIsSaving(false)
    if (error) {
      console.error(error)
      setSaveError(error.message || 'Couldn’t save the quiz. Try again.')
      return
    }
    router.push('/host/dashboard')
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
        <p className="text-sm font-semibold text-green-100">{isNew ? 'New quiz' : 'Editing quiz'}</p>
        <label htmlFor="quiz-name" className="sr-only">
          Quiz name
        </label>
        <input
          id="quiz-name"
          value={draft.name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => {
            const value = e.currentTarget.value
            setDraft((d) => ({ ...d, name: value }))
          }}
          placeholder="Quiz name"
          className="mt-1 w-full bg-transparent text-3xl md:text-4xl font-extrabold tracking-tight placeholder:text-green-200/60 outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-white/60"
          autoFocus={isNew}
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

      {/* Questions */}
      <ol className="mt-6 space-y-4">
        {draft.questions.map((question, index) => (
          <li key={question.key} className="rounded-2xl bg-white p-5 ring-1 ring-green-900/5 shadow-[0_2px_8px_-4px_rgba(2,44,22,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-green-900">
                Question {index + 1}
                <span className="font-medium text-gray-400"> / {draft.questions.length}</span>
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => moveQuestion(index, -1)}
                  disabled={index === 0}
                  className="w-9 h-9 grid place-items-center rounded-lg text-green-900 hover:bg-green-50 disabled:opacity-30"
                  aria-label={`Move question ${index + 1} up`}
                  title="Move up"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => moveQuestion(index, 1)}
                  disabled={index === draft.questions.length - 1}
                  className="w-9 h-9 grid place-items-center rounded-lg text-green-900 hover:bg-green-50 disabled:opacity-30"
                  aria-label={`Move question ${index + 1} down`}
                  title="Move down"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => removeQuestion(question.key)}
                  disabled={draft.questions.length === 1}
                  className="w-9 h-9 grid place-items-center rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-30"
                  aria-label={`Delete question ${index + 1}`}
                  title="Delete question"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <label htmlFor={`q-${question.key}`} className="sr-only">
              Question {index + 1} text
            </label>
            <textarea
              id={`q-${question.key}`}
              value={question.body}
              onChange={(e) => {
                const value = e.currentTarget.value
                updateQuestion(question.key, (q) => ({ ...q, body: value }))
              }}
              rows={2}
              maxLength={300}
              placeholder="Type the question"
              className="mt-2 w-full rounded-xl bg-green-50/60 px-4 py-3 text-lg font-semibold text-green-950 placeholder:text-gray-400 placeholder:font-normal outline-none ring-1 ring-green-900/10 focus:ring-2 focus:ring-green-600 resize-y"
            />

            <fieldset className="mt-4 min-w-0">
              <legend className="text-xs font-semibold text-gray-500">
                Answers — mark the correct one{question.choices.length > 2 ? 's' : ''}
              </legend>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {question.choices.map((choice, choiceIndex) => {
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
                          updateChoice(question.key, choice.key, (c) => ({ ...c, body: value }))
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
                        onClick={() =>
                          updateChoice(question.key, choice.key, (c) => ({ ...c, is_correct: !c.is_correct }))
                        }
                        className={`shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                          choice.is_correct
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Correct
                      </button>
                      {question.choices.length > MIN_CHOICES && (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(question.key, (q) => ({
                              ...q,
                              choices: q.choices.filter((c) => c.key !== choice.key),
                            }))
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
              {question.choices.length < MAX_CHOICES && (
                <button
                  type="button"
                  onClick={() =>
                    updateQuestion(question.key, (q) => ({ ...q, choices: [...q.choices, blankChoice()] }))
                  }
                  className="mt-2 text-sm font-semibold text-green-700 hover:text-green-900"
                >
                  + Add answer
                </button>
              )}
            </fieldset>
          </li>
        ))}
      </ol>

      {draft.questions.length < MAX_QUESTIONS && (
        <button
          onClick={addQuestion}
          className="mt-4 w-full h-14 rounded-2xl border-2 border-dashed border-green-300 text-green-800 font-bold hover:bg-green-100/60 hover:border-green-400 transition-colors"
        >
          + Add question
        </button>
      )}

      {(problems.length > 0 || saveError) && (
        <div
          ref={problemsRef}
          role="alert"
          className="mt-6 rounded-2xl bg-red-50 ring-1 ring-red-200 px-5 py-4 text-sm text-red-900"
        >
          <p className="font-bold">
            {saveError ? 'Couldn’t save the quiz' : 'Fix these before saving'}
          </p>
          {saveError ? (
            <p className="mt-1">{saveError}</p>
          ) : (
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {problems.slice(0, 8).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
              {problems.length > 8 && <li>…and {problems.length - 8} more</li>}
            </ul>
          )}
        </div>
      )}

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 z-10 bg-white/95 border-t border-green-900/10 px-4 md:px-10 py-3">
        <div className="max-w-4xl flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 tabular-nums">
            {draft.questions.length} {draft.questions.length === 1 ? 'question' : 'questions'}
          </p>
          <div className="flex gap-2">
            <Link
              href="/host/dashboard"
              className="inline-flex items-center h-11 px-4 rounded-xl text-sm font-semibold text-green-900 hover:bg-green-50"
            >
              Cancel
            </Link>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="h-11 px-6 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : isNew ? 'Create quiz' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
