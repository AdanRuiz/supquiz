'use client'

import { QuizSet, supabase } from '@/types/types'
import { useCallback, useEffect, useState } from 'react'
import BrandMark from '../brand-mark'

type LoadState = 'loading' | 'ready' | 'error'

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

export default function Home() {
  const [quizSets, setQuizSets] = useState<QuizSet[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [startError, setStartError] = useState<{
    quizSetId: string
    message: string
  } | null>(null)

  const getQuizSets = useCallback(async () => {
    setLoadState('loading')
    const { data, error } = await supabase
      .from('quiz_sets')
      .select(`*, questions(*, choices(*))`)
      .order('created_at', { ascending: false })
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

  const startGame = async (quizSetId: string) => {
    setStartingId(quizSetId)
    setStartError(null)

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      await supabase.auth.signInAnonymously()
    }

    const { data, error } = await supabase
      .from('games')
      .insert({
        quiz_set_id: quizSetId,
      })
      .select()
      .single()

    setStartingId(null)

    if (error) {
      console.error(error)
      setStartError({
        quizSetId,
        message: 'Couldn’t create the game. Check your connection and try again.',
      })
      return
    }

    const gameId = data.id
    window.open(`/host/game/${gameId}`, '_blank', 'noopener,noreferrer')
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

      <div className="mt-10 mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-green-950">Quiz sets</h2>
        {loadState === 'ready' && quizSets.length > 0 && (
          <p className="text-sm font-medium text-green-800/70 tabular-nums">
            {quizSets.length} {quizSets.length === 1 ? 'set' : 'sets'}
          </p>
        )}
      </div>

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
            onClick={getQuizSets}
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
            Add questions to the <code className="font-mono text-[0.9em]">quiz_sets</code> table
            (or run the seed) and they’ll show up here.
          </p>
        </div>
      )}

      {loadState === 'ready' && quizSets.length > 0 && (
        <ul className="space-y-3">
          {quizSets.map((quizSet, index) => {
            const isStarting = startingId === quizSet.id
            const questionCount = quizSet.questions.length
            const cover = COVER_COLORS[index % COVER_COLORS.length]
            const error =
              startError?.quizSetId === quizSet.id ? startError.message : null
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
                  <button
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 shrink-0 sm:self-center rounded-xl bg-green-600 text-white text-sm font-bold shadow-sm transition-[background-color,transform] hover:bg-green-700 active:scale-[0.98] active:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-600/50"
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
