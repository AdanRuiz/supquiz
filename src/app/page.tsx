'use client'

import BrandMark from '@/app/host/brand-mark'
import { GAME_CODE_LENGTH, isValidGameCode, normalizeGameCode } from '@/lib/game-code'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

/** Home: players type the game code shown on the big screen. */
export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeGameCode(code)
    if (!isValidGameCode(normalized)) {
      setError(`Game codes have ${GAME_CODE_LENGTH} letters and numbers.`)
      return
    }
    router.push(`/g/${normalized}`)
  }

  return (
    <main className="min-h-dvh bg-green-700 text-white flex flex-col px-4 py-6">
      <div className="flex items-center justify-center gap-2.5 font-extrabold text-xl tracking-tight">
        <BrandMark className="w-7 h-7" />
        SupQuiz
      </div>

      <div className="flex-grow flex items-center justify-center py-8">
        <form
          onSubmit={onSubmit}
          noValidate
          className="w-full max-w-sm rounded-3xl bg-green-950 p-6 shadow-[0_24px_48px_-16px_rgba(2,44,22,0.6)]"
        >
          <h1 className="text-3xl font-extrabold tracking-tight text-center">Join a game</h1>
          <p className="mt-2 text-center text-green-200">Enter the code on the big screen.</p>

          <label htmlFor="game-code" className="sr-only">
            Game code
          </label>
          <input
            id="game-code"
            value={code}
            onChange={(e) => {
              setError(null)
              setCode(e.currentTarget.value.toUpperCase())
            }}
            maxLength={GAME_CODE_LENGTH + 2}
            placeholder="K7M3QX"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'code-error' : undefined}
            className="mt-6 w-full h-16 px-4 rounded-xl bg-white text-green-950 text-center font-mono text-3xl font-extrabold tracking-[0.25em] placeholder:text-gray-300 outline-none focus:ring-4 focus:ring-green-400"
          />

          {error && (
            <p id="code-error" role="alert" className="mt-3 text-sm font-semibold text-red-200 text-center">
              {error}
            </p>
          )}

          <button
            disabled={!code.trim()}
            className="mt-5 w-full h-14 rounded-xl bg-green-400 text-green-950 text-xl font-extrabold transition-[transform,background-color] hover:bg-green-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-green-400/40 disabled:text-green-950/70"
          >
            Join
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-green-100">
        Hosting a class?{' '}
        <Link href="/host/login" className="font-semibold text-white underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </main>
  )
}
