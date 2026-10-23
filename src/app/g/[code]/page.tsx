'use client'

import BrandMark from '@/app/host/brand-mark'
import { isValidGameCode, normalizeGameCode } from '@/lib/game-code'
import { supabase } from '@/types/types'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PlayerGame from '../../game/[id]/page'

type State = { status: 'loading' } | { status: 'found'; gameId: string } | { status: 'not-found' }

/** Short join link: /g/K7M3QX → the player screen for that game. */
export default function JoinByCode({ params }: { params: { code: string } }) {
  const code = normalizeGameCode(decodeURIComponent(params.code))
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!isValidGameCode(code)) {
      setState({ status: 'not-found' })
      return
    }
    supabase
      .from('games')
      .select('id')
      .eq('code', code)
      .maybeSingle()
      .then(({ data }) => setState(data ? { status: 'found', gameId: data.id } : { status: 'not-found' }))
  }, [code])

  if (state.status === 'found') return <PlayerGame params={{ id: state.gameId }} />

  return (
    <main className="min-h-dvh bg-green-700 text-white flex flex-col px-4 py-6">
      <div className="flex items-center justify-center gap-2 font-bold text-lg tracking-tight">
        <BrandMark className="w-6 h-6" />
        SupQuiz
      </div>
      <div className="flex-grow flex items-center justify-center text-center">
        {state.status === 'loading' ? (
          <p className="text-lg text-green-100 motion-safe:animate-breathe">Finding your game…</p>
        ) : (
          <div className="max-w-sm">
            <h1 className="text-3xl font-extrabold tracking-tight">Game not found</h1>
            <p className="mt-2 text-green-100">
              Check the code on the big screen. It has 6 letters and numbers, like{' '}
              <span className="font-mono font-bold">K7M3QX</span>.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center h-12 px-6 rounded-xl bg-white text-green-900 font-bold hover:bg-green-50"
            >
              Enter the code again
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
