import { Participant, supabase } from '@/types/types'
import { FormEvent, useEffect, useState } from 'react'
import BrandMark from '@/app/host/brand-mark'

export default function Lobby({
  gameId,
  onRegisterCompleted,
}: {
  gameId: string
  onRegisterCompleted: (participant: Participant) => void
}) {
  const [participant, setParticipant] = useState<Participant | null>(null)
  // True while we check whether this device already joined this game
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const fetchParticipant = async () => {
      let userId: string | null = null

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionData.session) {
        userId = sessionData.session?.user.id ?? null
      } else {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) console.error(error)
        userId = data?.user?.id ?? null
      }

      if (!userId) {
        setIsChecking(false)
        return
      }

      const { data: participantData, error } = await supabase
        .from('participants')
        .select()
        .eq('game_id', gameId)
        .eq('user_id', userId)
        .maybeSingle()

      setIsChecking(false)

      if (error) {
        console.error(error)
        return
      }

      if (participantData) {
        setParticipant(participantData)
        onRegisterCompleted(participantData)
      }
    }

    fetchParticipant()
  }, [gameId, onRegisterCompleted])

  return (
    <div className="min-h-[100dvh] bg-green-700 text-white flex flex-col px-4 py-6">
      <div className="flex items-center justify-center gap-2 font-bold text-lg tracking-tight">
        <BrandMark className="w-6 h-6" />
        SupaQuiz
      </div>

      <div className="flex-grow flex items-center justify-center py-8">
        <div className="w-full max-w-sm">
          {isChecking && (
            <p className="text-center text-lg text-green-100 motion-safe:animate-breathe">
              Connecting…
            </p>
          )}

          {!isChecking && !participant && (
            <Register
              gameId={gameId}
              onRegisterCompleted={(participant) => {
                onRegisterCompleted(participant)
                setParticipant(participant)
              }}
            />
          )}

          {participant && (
            <div className="text-center">
              <div className="flex justify-center gap-2" aria-hidden="true">
                {['bg-red-500', 'bg-blue-500', 'bg-yellow-400', 'bg-green-400'].map((color, i) => (
                  <span
                    key={color}
                    className={`w-4 h-4 rounded ${color} motion-safe:animate-breathe`}
                    style={{ animationDelay: `${i * 180}ms` }}
                  />
                ))}
              </div>
              <p className="mt-6 text-lg font-semibold text-green-100">You’re in!</p>
              <h1 className="mt-1 text-5xl font-extrabold tracking-tight break-words">
                {participant.nickname}
              </h1>
              <p className="mt-6 text-lg text-green-50 leading-relaxed">
                Look for your name on the big screen. The game starts when the
                host is ready.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MAX_NICKNAME = 20

function Register({
  onRegisterCompleted,
  gameId,
}: {
  onRegisterCompleted: (player: Participant) => void
  gameId: string
}) {
  const [nickname, setNickname] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = nickname.trim()

  const onFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!trimmed || sending) return

    setSending(true)
    setError(null)

    const { data: participant, error } = await supabase
      .from('participants')
      .insert({ nickname: trimmed, game_id: gameId })
      .select()
      .single()

    if (error) {
      console.error(error)
      setSending(false)
      setError('Couldn’t join the game. Check your connection and try again.')
      return
    }

    onRegisterCompleted(participant)
  }

  return (
    <form
      onSubmit={onFormSubmit}
      className="rounded-3xl bg-green-950 p-6 shadow-[0_24px_48px_-16px_rgba(2,44,22,0.6)]"
    >
      <h1 className="text-3xl font-extrabold tracking-tight text-center">
        Join the game
      </h1>
      <p className="mt-2 text-center text-green-200">
        Pick the name everyone will see on the big screen.
      </p>

      <div className="mt-6 flex items-baseline justify-between">
        <label htmlFor="nickname" className="font-semibold">
          Nickname
        </label>
        <span className="text-sm text-green-300 tabular-nums" aria-hidden="true">
          {nickname.length}/{MAX_NICKNAME}
        </span>
      </div>
      <input
        id="nickname"
        className="mt-2 w-full h-14 px-4 rounded-xl bg-white text-green-950 text-xl font-semibold placeholder:text-gray-500 placeholder:font-normal outline-none focus:ring-4 focus:ring-green-400"
        type="text"
        value={nickname}
        onChange={(val) => setNickname(val.currentTarget.value)}
        placeholder="e.g. QuizWizard"
        maxLength={MAX_NICKNAME}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="go"
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'nickname-error' : undefined}
      />

      {error && (
        <p id="nickname-error" role="alert" className="mt-3 text-sm font-semibold text-red-200">
          {error}
        </p>
      )}

      <button
        disabled={sending || !trimmed}
        className="mt-5 w-full h-14 rounded-xl bg-green-400 text-green-950 text-xl font-extrabold transition-[transform,background-color] hover:bg-green-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-green-400/40 disabled:text-green-950/70"
      >
        {sending ? 'Joining…' : 'Join'}
      </button>
    </form>
  )
}
