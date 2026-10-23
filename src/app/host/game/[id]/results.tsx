import { GameResult, Participant, QuizSet, supabase } from '@/types/types'
import { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import useWindowSize from 'react-use/lib/useWindowSize'
import BrandMark from '../../brand-mark'
import Link from 'next/link'

type LoadState = 'loading' | 'ready' | 'error'

// Podium order on screen: 2nd, 1st, 3rd
const PODIUM = [
  { rank: 2, height: 'h-40', block: 'bg-green-200', delay: 150 },
  { rank: 1, height: 'h-56', block: 'bg-white', delay: 450 },
  { rank: 3, height: 'h-28', block: 'bg-green-400', delay: 0 },
]

const formatScore = (score: number | null) => (score ?? 0).toLocaleString()

export default function Results({
  quizSet,
  gameId,
}: {
  participants: Participant[]
  quizSet: QuizSet
  gameId: string
}) {
  const [gameResults, setGameResults] = useState<GameResult[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reduceMotion, setReduceMotion] = useState(false)

  const { width, height } = useWindowSize()

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    const getResults = async () => {
      setLoadState('loading')
      const { data, error } = await supabase
        .from('game_results')
        .select()
        .eq('game_id', gameId)
        .order('total_score', { ascending: false })
      if (error) {
        console.error(error)
        setLoadState('error')
        return
      }

      setGameResults(data)
      setLoadState('ready')
    }
    getResults()
  }, [gameId])

  const topThree = gameResults.slice(0, 3)
  const rest = gameResults.slice(3)

  return (
    <div className="min-h-dvh bg-green-700 text-white flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 lg:px-10 py-5">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <BrandMark className="w-7 h-7" />
          SupaQuiz
        </div>
        <div className="flex items-center gap-5 min-w-0">
          <p className="hidden sm:block text-green-100 text-lg font-medium truncate">{quizSet.name}</p>
          <Link
            href="/host/dashboard"
            className="shrink-0 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-green-900 font-bold shadow-[0_8px_24px_-8px_rgba(2,44,22,0.55)] transition-[transform,background-color] hover:bg-green-50 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center px-6 lg:px-10 pb-12">
        <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-center">
          Final results
        </h1>

        {loadState === 'loading' && (
          <p className="mt-16 text-2xl text-green-100 motion-safe:animate-breathe">
            Counting points…
          </p>
        )}

        {loadState === 'error' && (
          <div className="mt-16 rounded-2xl bg-green-950 px-8 py-6 text-center">
            <p className="text-2xl font-bold">Couldn’t load the results.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 h-12 px-6 rounded-xl bg-white text-green-900 font-bold hover:bg-green-50"
            >
              Reload
            </button>
          </div>
        )}

        {loadState === 'ready' && gameResults.length === 0 && (
          <p className="mt-16 text-2xl text-green-100">No answers were recorded in this game.</p>
        )}

        {loadState === 'ready' && topThree.length > 0 && (
          <ol className="mt-12 flex items-end justify-center gap-3 lg:gap-5 w-full max-w-4xl">
            {PODIUM.map(({ rank, height, block, delay }) => {
              const result = topThree[rank - 1]
              if (!result) return <li key={rank} className="flex-1" aria-hidden="true" />
              const isWinner = rank === 1
              return (
                <li key={rank} className="flex-1 min-w-0 flex flex-col items-center">
                  <p
                    className={`w-full text-center font-extrabold truncate ${
                      isWinner ? 'text-4xl lg:text-5xl' : 'text-2xl lg:text-3xl'
                    }`}
                    title={result.nickname ?? undefined}
                  >
                    {result.nickname}
                  </p>
                  <p className={`mt-1 tabular-nums font-semibold ${isWinner ? 'text-2xl text-white' : 'text-xl text-green-100'}`}>
                    {formatScore(result.total_score)} pts
                  </p>
                  <div
                    className={`mt-4 w-full ${height} ${block} rounded-t-2xl flex items-start justify-center pt-4 origin-bottom motion-safe:animate-rise shadow-[0_-8px_24px_-12px_rgba(2,44,22,0.5)]`}
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    <span
                      className={`font-extrabold tabular-nums ${
                        isWinner ? 'text-6xl text-green-800' : 'text-5xl text-green-950'
                      }`}
                    >
                      {rank}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {loadState === 'ready' && rest.length > 0 && (
          <ol
            start={4}
            className="w-full max-w-4xl rounded-b-2xl bg-green-950 divide-y divide-white/10"
          >
            {rest.map((result, index) => (
              <li
                key={result.participant_id}
                className="flex items-center gap-5 px-6 py-3 text-xl"
              >
                <span className="w-8 text-right text-green-300 font-bold tabular-nums">
                  {index + 4}
                </span>
                <span className="flex-grow min-w-0 font-semibold truncate">
                  {result.nickname}
                </span>
                <span className="tabular-nums font-semibold text-green-100">
                  {formatScore(result.total_score)} pts
                </span>
              </li>
            ))}
          </ol>
        )}
      </main>

      {loadState === 'ready' && gameResults.length > 0 && !reduceMotion && (
        <Confetti
          width={width}
          height={height}
          recycle={true}
          numberOfPieces={160}
          colors={['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#ffffff']}
        />
      )}
    </div>
  )
}
