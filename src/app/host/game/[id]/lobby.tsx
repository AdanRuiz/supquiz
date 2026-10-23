import { Participant, supabase } from '@/types/types'
import { useQRCode } from 'next-qrcode'
import { useEffect, useState } from 'react'
import BrandMark from '../../brand-mark'

export default function Lobby({
  participants: participants,
  gameId,
  quizName,
}: {
  participants: Participant[]
  gameId: string
  quizName?: string
}) {
  const { Canvas } = useQRCode()

  // Build the join URL from the current domain so the QR works on any deployment
  const [joinUrl, setJoinUrl] = useState('')
  useEffect(() => {
    setJoinUrl(`${window.location.origin}/game/${gameId}`)
  }, [gameId])

  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const playerCount = participants.length
  const canStart = playerCount > 0 && !isStarting

  const onClickStartGame = async () => {
    setIsStarting(true)
    setStartError(null)
    const { error } = await supabase
      .from('games')
      .update({ phase: 'quiz' })
      .eq('id', gameId)
    if (error) {
      console.error(error)
      setStartError('Couldn’t start the game. Try again.')
      setIsStarting(false)
    }
    // On success the realtime listener in page.tsx switches to the quiz screen
  }

  // Shown under the QR so people without a camera can type it
  const displayUrl = joinUrl.replace(/^https?:\/\//, '')

  return (
    <div className="min-h-dvh bg-green-700 text-white flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 lg:px-10 py-5">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <BrandMark className="w-7 h-7" />
          SupaQuiz
        </div>
        {quizName && (
          <p className="text-green-100 text-lg font-medium truncate">
            {quizName}
          </p>
        )}
      </header>

      <div className="flex-grow grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 lg:gap-10 px-6 lg:px-10 pb-8">
        {/* Join panel */}
        <section
          aria-labelledby="join-heading"
          className="rounded-3xl bg-green-950 p-8 flex flex-col items-center justify-center text-center shadow-[0_24px_48px_-16px_rgba(2,44,22,0.6)]"
        >
          <h2 id="join-heading" className="text-3xl font-extrabold tracking-tight">
            Scan to join
          </h2>
          <p className="mt-2 text-green-200 text-lg">
            Use your phone’s camera, then pick a nickname.
          </p>
          <div className="mt-6 rounded-2xl bg-white p-3 w-full max-w-[20rem] aspect-square [&_canvas]:!w-full [&_canvas]:!h-auto">
            {joinUrl ? (
              <Canvas
                text={joinUrl}
                options={{
                  errorCorrectionLevel: 'M',
                  margin: 1,
                  scale: 4,
                  width: 400,
                  color: { dark: '#052e16', light: '#ffffff' },
                }}
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-gray-100 animate-pulse" />
            )}
          </div>
          {displayUrl && (
            <div className="mt-6 w-full">
              <p className="text-green-300 text-sm font-medium">or go to</p>
              <p className="mt-1 text-lg font-semibold break-all leading-snug select-all">
                {displayUrl}
              </p>
            </div>
          )}
        </section>

        {/* Players + start */}
        <section aria-labelledby="players-heading" className="flex flex-col min-h-[20rem]">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <h2 id="players-heading" className="flex items-baseline gap-3">
              <span className="text-7xl font-extrabold tabular-nums leading-none">
                {playerCount}
              </span>
              <span className="text-2xl font-semibold text-green-100">
                {playerCount === 1 ? 'player' : 'players'}
              </span>
            </h2>

            <div className="flex flex-col items-end gap-2">
              <button
                className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl bg-white text-green-900 text-2xl font-extrabold shadow-[0_8px_24px_-8px_rgba(2,44,22,0.55)] transition-[transform,background-color] hover:bg-green-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/80 disabled:shadow-none"
                onClick={onClickStartGame}
                disabled={!canStart}
              >
                {isStarting ? 'Starting…' : 'Start game'}
                {!isStarting && (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
              {startError && (
                <p role="alert" className="text-sm font-semibold bg-red-600 text-white rounded-lg px-3 py-1.5">
                  {startError}
                </p>
              )}
            </div>
          </div>

          {playerCount === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center mt-8 rounded-3xl border-2 border-dashed border-green-500/70 px-6 py-16">
              <div className="flex gap-2" aria-hidden="true">
                {['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-400'].map((color, i) => (
                  <span
                    key={color}
                    className={`w-4 h-4 rounded ${color} motion-safe:animate-breathe`}
                    style={{ animationDelay: `${i * 180}ms` }}
                  />
                ))}
              </div>
              <p className="mt-5 text-3xl font-bold">Waiting for players…</p>
              <p className="mt-2 text-lg text-green-100">
                Names will appear here as people join.
              </p>
            </div>
          ) : (
            <ul
              aria-live="polite"
              className="mt-8 flex flex-wrap content-start gap-3"
            >
              {participants.map((participant) => (
                <li
                  key={participant.id}
                  className="motion-safe:animate-pop-in rounded-xl bg-white text-green-950 px-5 py-3 text-2xl font-bold shadow-[0_4px_12px_-4px_rgba(2,44,22,0.45)] max-w-full break-words"
                >
                  {participant.nickname}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
