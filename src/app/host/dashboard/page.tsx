'use client'

import { QuizSet, supabase } from '@/types/types'
import { useCallback, useEffect, useState } from 'react'

type LoadState = 'loading' | 'ready' | 'error'

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
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Quiz sets</h1>
        {loadState === 'ready' && quizSets.length > 0 && (
          <p className="text-sm text-gray-500 tabular-nums">
            {quizSets.length} {quizSets.length === 1 ? 'set' : 'sets'}
          </p>
        )}
      </div>

      {loadState === 'loading' && (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white" aria-busy="true" aria-label="Loading quiz sets">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-5">
              <div className="flex-grow space-y-2">
                <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse" />
                <div className="h-3 w-1/5 rounded bg-gray-100 animate-pulse" />
              </div>
              <div className="h-10 w-28 rounded-lg bg-gray-100 animate-pulse" />
            </li>
          ))}
        </ul>
      )}

      {loadState === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6">
          <p className="font-semibold text-red-900">Couldn’t load your quiz sets.</p>
          <p className="mt-1 text-sm text-red-800">
            Check your connection to Supabase, then try again.
          </p>
          <button
            onClick={getQuizSets}
            className="mt-4 h-9 px-4 rounded-lg bg-white border border-red-200 text-sm font-semibold text-red-900 hover:bg-red-100 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && quizSets.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
          <p className="font-semibold">No quiz sets yet</p>
          <p className="mt-1 text-sm text-gray-600">
            Add questions to the <code className="font-mono text-[0.9em]">quiz_sets</code> table
            (or run the seed) and they’ll show up here.
          </p>
        </div>
      )}

      {loadState === 'ready' && quizSets.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {quizSets.map((quizSet) => {
            const isStarting = startingId === quizSet.id
            const questionCount = quizSet.questions.length
            const error =
              startError?.quizSetId === quizSet.id ? startError.message : null
            return (
              <li
                key={quizSet.id}
                className="px-5 py-4 transition-colors hover:bg-gray-50/70"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                  <div className="flex-grow min-w-0">
                    <h2 className="font-semibold text-gray-900 [text-wrap:balance]">
                      {quizSet.name}
                    </h2>
                    {quizSet.description && (
                      <p className="mt-0.5 text-sm text-gray-600 line-clamp-2">
                        {quizSet.description}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500 tabular-nums">
                      {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                    </p>
                  </div>
                  <button
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 shrink-0 self-start sm:self-center rounded-lg bg-green-600 text-white text-sm font-semibold shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-600/60"
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
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {loadState === 'ready' && quizSets.length > 0 && (
        <p className="mt-4 text-sm text-gray-500">
          The game opens in a new tab. Put it on the big screen so players can scan the code.
        </p>
      )}
    </div>
  )
}
