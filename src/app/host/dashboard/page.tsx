'use client'

import {
  downloadJson,
  draftToPayload,
  parseQuizFile,
  quizSetToFile,
  slugify,
} from '@/lib/quiz-json'
import { QuizSet, supabase } from '@/types/types'
import Link from 'next/link'
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import BrandMark from '../brand-mark'
import { useStaffUser } from './shell'

type LoadState = 'loading' | 'ready' | 'error'
type Notice = { tone: 'success' | 'error'; text: string } | null

// Quiz covers cycle through the answer colors
const COVER_COLORS = [
  'bg-red-500 text-white',
  'bg-blue-500 text-white',
  'bg-yellow-400 text-yellow-950',
  'bg-green-500 text-green-950',
]

const STEPS = [
  { label: 'Pick a quiz', color: 'bg-red-500 text-white' },
  { label: 'Show it on the big screen', color: 'bg-blue-500 text-white' },
  { label: 'Players scan and join', color: 'bg-yellow-400 text-yellow-950' },
  { label: 'Start the game', color: 'bg-green-400 text-green-950' },
]

const iconButtonClass =
  'inline-grid place-items-center w-10 h-10 rounded-xl text-green-900 ring-1 ring-green-900/10 bg-white transition-colors hover:bg-green-50 hover:ring-green-900/20 disabled:opacity-40 disabled:cursor-not-allowed'

export default function Home() {
  const user = useStaffUser()
  const [quizSets, setQuizSets] = useState<QuizSet[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ quizSetId: string; message: string } | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const getQuizSets = useCallback(async () => {
    const { data, error } = await supabase
      .from('quiz_sets')
      .select(`*, questions(*, choices(*))`)
      .order('created_at', { ascending: false })
      .order('order', { ascending: true, referencedTable: 'questions' })
      .order('order', { ascending: true, referencedTable: 'questions.choices' })
    if (error) {
      console.error(error)
      setLoadState('error')
      return
    }
    setQuizSets(data)
    setLoadState('ready')
  }, [])

  useEffect(() => {
    getQuizSets()
  }, [getQuizSets])

  const canEdit = (quizSet: QuizSet) => !quizSet.created_by || quizSet.created_by === user.id

  const startGame = async (quizSetId: string) => {
    setStartingId(quizSetId)
    setRowError(null)

    const { data, error } = await supabase
      .from('games')
      .insert({ quiz_set_id: quizSetId })
      .select()
      .single()

    setStartingId(null)

    if (error) {
      console.error(error)
      setRowError({
        quizSetId,
        message: 'Couldn’t create the game. Check your connection and try again.',
      })
      return
    }

    window.open(`/host/game/${data.id}`, '_blank', 'noopener,noreferrer')
  }

  const exportQuiz = (quizSet: QuizSet) => {
    downloadJson(quizSetToFile(quizSet), `${slugify(quizSet.name)}.json`)
  }

  const deleteQuiz = async (quizSet: QuizSet) => {
    setDeletingId(quizSet.id)
    setRowError(null)
    const { error, count } = await supabase
      .from('quiz_sets')
      .delete({ count: 'exact' })
      .eq('id', quizSet.id)
    setDeletingId(null)
    setConfirmingDeleteId(null)
    if (error || count === 0) {
      console.error(error)
      setRowError({
        quizSetId: quizSet.id,
        message: 'Couldn’t delete this quiz. You can only delete quizzes you created.',
      })
      return
    }
    setQuizSets((current) => current.filter((q) => q.id !== quizSet.id))
    setNotice({ tone: 'success', text: `Deleted “${quizSet.name}”.` })
  }

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setNotice(null)

    if (file.size > 1_000_000) {
      setNotice({ tone: 'error', text: 'That file is too big. Quiz files are usually a few KB.' })
      return
    }

    let drafts
    try {
      drafts = parseQuizFile(await file.text())
    } catch (error) {
      setNotice({ tone: 'error', text: `Couldn’t import ${file.name}: ${(error as Error).message}` })
      return
    }

    setIsImporting(true)
    let imported = 0
    for (const draft of drafts) {
      const { error } = await supabase.rpc('save_quiz_set', { payload: draftToPayload(draft) })
      if (error) {
        console.error(error)
        setIsImporting(false)
        setNotice({
          tone: 'error',
          text: `Imported ${imported} of ${drafts.length}. “${draft.name}” failed: ${error.message}`,
        })
        getQuizSets()
        return
      }
      imported++
    }
    setIsImporting(false)
    setNotice({
      tone: 'success',
      text:
        imported === 1
          ? `Imported “${drafts[0].name}”.`
          : `Imported ${imported} quizzes.`,
    })
    getQuizSets()
  }

  return (
    <div className="max-w-4xl">
      {/* Intro band: what hosting a game looks like */}
      <section className="relative overflow-hidden rounded-3xl bg-green-700 text-white px-6 py-7 md:px-8 md:py-8 shadow-[0_16px_40px_-20px_rgba(2,44,22,0.7)]">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Host a game</h1>
        <p className="mt-2 max-w-xl text-green-50 text-base md:text-lg">
          Pick a quiz below. It opens in a new tab: put that tab on the big screen
          and players join by scanning the code with their phones.
        </p>
        <ol className="relative mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-md grid place-items-center text-xs font-extrabold ${step.color}`}>
                {i + 1}
              </span>
              {step.label}
            </li>
          ))}
        </ol>
        {/* Oversized brand mark as a quiet backdrop */}
        <div className="pointer-events-none absolute -right-14 -top-14 opacity-[0.12] hidden lg:block" aria-hidden="true">
          <BrandMark className="w-56 h-56" />
        </div>
      </section>

      <div className="mt-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold tracking-tight text-green-950">Quiz sets</h2>
          {loadState === 'ready' && quizSets.length > 0 && (
            <p className="text-sm font-medium text-green-800/70 tabular-nums">
              {quizSets.length} {quizSets.length === 1 ? 'set' : 'sets'}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white ring-1 ring-green-900/15 text-sm font-semibold text-green-900 hover:bg-green-100/60 disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            {isImporting ? 'Importing…' : 'Import JSON'}
          </button>
          <Link
            href="/host/dashboard/quiz/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New quiz
          </Link>
        </div>
      </div>

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mb-4 flex items-start justify-between gap-4 rounded-2xl px-4 py-3 text-sm font-medium ${
            notice.tone === 'error'
              ? 'bg-red-50 text-red-900 ring-1 ring-red-200'
              : 'bg-green-100 text-green-900 ring-1 ring-green-200'
          }`}
        >
          <p>{notice.text}</p>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadState === 'loading' && (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading quiz sets">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-green-900/5">
              <div className="w-16 h-16 rounded-xl bg-green-100 animate-pulse" />
              <div className="flex-grow space-y-2">
                <div className="h-4 w-1/3 rounded bg-green-100 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-green-50 animate-pulse" />
              </div>
              <div className="h-11 w-32 rounded-xl bg-green-100 animate-pulse" />
            </li>
          ))}
        </ul>
      )}

      {loadState === 'error' && (
        <div className="rounded-2xl bg-red-50 ring-1 ring-red-200 px-5 py-6">
          <p className="font-semibold text-red-900">Couldn’t load your quiz sets.</p>
          <p className="mt-1 text-sm text-red-800">
            Check your connection to Supabase, then try again.
          </p>
          <button
            onClick={() => {
              setLoadState('loading')
              getQuizSets()
            }}
            className="mt-4 h-9 px-4 rounded-lg bg-white ring-1 ring-red-200 text-sm font-semibold text-red-900 hover:bg-red-100 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && quizSets.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-green-300 bg-white/60 px-5 py-12 text-center">
          <p className="font-semibold text-green-950">No quiz sets yet</p>
          <p className="mt-1 text-sm text-green-900/70">
            Create your first quiz, or import one from a JSON file.
          </p>
          <Link
            href="/host/dashboard/quiz/new"
            className="mt-5 inline-flex items-center h-10 px-4 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800"
          >
            New quiz
          </Link>
        </div>
      )}

      {loadState === 'ready' && quizSets.length > 0 && (
        <ul className="space-y-3">
          {quizSets.map((quizSet, index) => {
            const isStarting = startingId === quizSet.id
            const questionCount = quizSet.questions.length
            const cover = COVER_COLORS[index % COVER_COLORS.length]
            const editable = canEdit(quizSet)
            const isConfirmingDelete = confirmingDeleteId === quizSet.id
            const error = rowError?.quizSetId === quizSet.id ? rowError.message : null
            return (
              <li
                key={quizSet.id}
                className="rounded-2xl bg-white p-4 ring-1 ring-green-900/5 shadow-[0_2px_8px_-4px_rgba(2,44,22,0.12)] transition-shadow hover:shadow-[0_10px_24px_-12px_rgba(2,44,22,0.3)]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                  <div className="flex items-center gap-4 flex-grow min-w-0">
                    <div
                      className={`w-16 h-16 shrink-0 rounded-xl flex flex-col items-center justify-center ${cover}`}
                      aria-hidden="true"
                    >
                      <span className="text-2xl font-extrabold leading-none tabular-nums">
                        {questionCount}
                      </span>
                      <span className="mt-1 text-[0.6rem] font-bold uppercase tracking-wide opacity-80">
                        {questionCount === 1 ? 'question' : 'questions'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-green-950 [text-wrap:balance]">
                        {quizSet.name}
                      </h3>
                      {quizSet.description && (
                        <p className="mt-0.5 text-sm text-gray-600 line-clamp-2">
                          {quizSet.description}
                        </p>
                      )}
                      <p className="sr-only">
                        {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {editable ? (
                      <Link
                        href={`/host/dashboard/quiz/${quizSet.id}`}
                        className={iconButtonClass}
                        aria-label={`Edit ${quizSet.name}`}
                        title="Edit"
                      >
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                        </svg>
                      </Link>
                    ) : (
                      <span
                        className={`${iconButtonClass} opacity-40 cursor-not-allowed`}
                        title="Only the person who created this quiz can edit it"
                        aria-label="Editing not allowed"
                      >
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </span>
                    )}
                    <button
                      onClick={() => exportQuiz(quizSet)}
                      className={iconButtonClass}
                      aria-label={`Export ${quizSet.name} as JSON`}
                      title="Export JSON"
                    >
                      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </button>
                    {editable && (
                      <button
                        onClick={() => {
                          setRowError(null)
                          setConfirmingDeleteId(quizSet.id)
                        }}
                        className={`${iconButtonClass} hover:!bg-red-50 hover:text-red-700`}
                        aria-label={`Delete ${quizSet.name}`}
                        title="Delete"
                      >
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 ml-1 flex-grow sm:flex-grow-0 rounded-xl bg-green-600 text-white text-sm font-bold shadow-sm transition-[background-color,transform] hover:bg-green-700 active:scale-[0.98] active:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-600/50"
                      onClick={() => startGame(quizSet.id)}
                      disabled={startingId !== null || questionCount === 0}
                    >
                      {isStarting ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          Starting…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.5-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8Z" />
                          </svg>
                          Start game
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isConfirmingDelete && (
                  <div
                    role="alertdialog"
                    aria-label={`Delete ${quizSet.name}?`}
                    className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3"
                  >
                    <p className="text-sm text-red-900">
                      <strong>Delete this quiz?</strong> Its questions and past game results are
                      deleted too. This can’t be undone.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="h-9 px-3 rounded-lg bg-white ring-1 ring-red-200 text-sm font-semibold text-red-900 hover:bg-red-100"
                        autoFocus
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteQuiz(quizSet)}
                        disabled={deletingId === quizSet.id}
                        className="h-9 px-3 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {deletingId === quizSet.id ? 'Deleting…' : 'Delete quiz'}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
