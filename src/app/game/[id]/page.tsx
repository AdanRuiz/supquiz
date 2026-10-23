'use client'

import React, { FormEvent, useEffect, useRef, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Choice, Game, Participant, Question, supabase } from '@/types/types'
import Lobby from './lobby'
import Quiz from './quiz'
import BrandMark from '@/app/host/brand-mark'
import { KITTEN_IMAGES, KittenProvider, useKitten } from '@/lib/kitten'

enum Screens {
  lobby = 'lobby',
  quiz = 'quiz',
  results = 'result',
}

export default function Home({
  params: { id: gameId },
}: {
  params: { id: string }
}) {
  const onRegisterCompleted = (participant: Participant) => {
    setParticipant(participant)
    getGame()
  }

  const stateRef = useRef<Participant | null>()

  const [participant, setParticipant] = useState<Participant | null>()

  stateRef.current = participant

  const [currentScreen, setCurrentScreen] = useState(Screens.lobby)

  const [questions, setQuestions] = useState<Question[]>()

  const [currentQuestionSequence, setCurrentQuestionSequence] = useState(0)
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  // Hidden Kitten mode, switched on by the host for this game
  const [isKitten, setIsKitten] = useState(false)

  const getGame = async () => {
    const { data: game } = await supabase
      .from('games')
      .select()
      .eq('id', gameId)
      .single()
    if (!game) return
    setIsKitten(game.kitten_mode)
    setCurrentScreen(game.phase as Screens)
    if (game.phase == Screens.quiz) {
      setCurrentQuestionSequence(game.current_question_sequence)
      setIsAnswerRevealed(game.is_answer_revealed)
    }

    getQuestions(game.quiz_set_id)
  }

  const getQuestions = async (quizSetId: string, retries = 5) => {
    const { data, error } = await supabase
      .from('questions')
      .select(`*, choices(*)`)
      .eq('quiz_set_id', quizSetId)
      .order('order', { ascending: true })
      .order('order', { ascending: true, referencedTable: 'choices' })
    if (error) {
      // Back off instead of retrying in a tight loop
      if (retries > 0) {
        setTimeout(() => getQuestions(quizSetId, retries - 1), 1000 * (6 - retries))
      }
      return
    }
    setQuestions(data)
  }

  useEffect(() => {
    const setGameListner = (): RealtimeChannel => {
      return supabase
        .channel('game_participant')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`,
          },
          (payload) => {
            if (!stateRef.current) return

            const game = payload.new as Game
            setIsKitten(game.kitten_mode)

            // Other updates in the lobby (like Kitten mode) don't start the game
            if (game.phase == 'result') {
              setCurrentScreen(Screens.results)
            } else if (game.phase == 'quiz') {
              setCurrentScreen(Screens.quiz)
              setCurrentQuestionSequence(game.current_question_sequence)
              setIsAnswerRevealed(game.is_answer_revealed)
            }
          }
        )
        .subscribe()
    }

    const gameChannel = setGameListner()

    // Read the mode right away so even the join screen shows it
    supabase
      .from('games')
      .select('kitten_mode')
      .eq('id', gameId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsKitten(data.kitten_mode)
      })

    return () => {
      supabase.removeChannel(gameChannel)
    }
  }, [gameId])

  return (
    <KittenProvider enabled={isKitten}>
    <main className="bg-green-700 min-h-dvh">
      {currentScreen == Screens.lobby && (
        <Lobby
          onRegisterCompleted={onRegisterCompleted}
          gameId={gameId}
        ></Lobby>
      )}
      {currentScreen == Screens.quiz && questions && (
        <Quiz
          question={questions![currentQuestionSequence]}
          questionCount={questions!.length}
          participantId={participant!.id}
          isAnswerRevealed={isAnswerRevealed}
        ></Quiz>
      )}
      {currentScreen == Screens.results && (
        <Results participant={participant!} gameId={gameId}></Results>
      )}
    </main>
    </KittenProvider>
  )
}

const ordinal = (n: number) => {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

function Results({
  participant,
  gameId,
}: {
  participant: Participant
  gameId: string
}) {
  const [standing, setStanding] = useState<{
    rank: number
    total: number
    score: number
  } | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const getStanding = async () => {
      const { data, error } = await supabase
        .from('game_results')
        .select()
        .eq('game_id', gameId)
        .order('total_score', { ascending: false })
      if (error || !data) {
        console.error(error)
        setHasError(true)
        return
      }
      const index = data.findIndex(
        (result) => result.participant_id === participant.id
      )
      setStanding({
        rank: index + 1,
        total: data.length,
        score: index >= 0 ? data[index].total_score ?? 0 : 0,
      })
    }
    getStanding()
  }, [gameId, participant.id])

  const isPodium = standing !== null && standing.rank >= 1 && standing.rank <= 3
  const { enabled: isKitten } = useKitten()

  return (
    <div className="min-h-dvh bg-green-700 text-white flex flex-col px-4 py-6">
      <div className="flex items-center justify-center gap-2 font-bold text-lg tracking-tight">
        <BrandMark className="w-6 h-6" />
        SupQuiz
      </div>

      <div className="flex-grow flex flex-col items-center justify-center text-center py-8 max-w-sm w-full mx-auto">
        <p className="text-lg font-semibold text-green-100 break-words">
          Nice game, {participant.nickname}!
        </p>

        {!standing && !hasError && (
          <p className="mt-10 text-xl text-green-100 motion-safe:animate-breathe">
            Counting points…
          </p>
        )}

        {standing && standing.rank > 0 && (
          <>
            <div
              className={`mt-6 w-44 h-44 rounded-[2.5rem] flex flex-col items-center justify-center motion-safe:animate-pop-in shadow-[0_24px_48px_-16px_rgba(2,44,22,0.6)] ${
                isPodium ? 'bg-white text-green-800' : 'bg-green-950 text-white'
              }`}
            >
              <span className="text-6xl font-extrabold tabular-nums leading-none">
                {ordinal(standing.rank)}
              </span>
              <span className={`mt-2 text-sm font-semibold ${isPodium ? 'text-green-700' : 'text-green-300'}`}>
                of {standing.total} {standing.total === 1 ? 'player' : 'players'}
              </span>
            </div>
            <p className="mt-6 text-4xl font-extrabold tabular-nums">
              {standing.score.toLocaleString()} pts
            </p>
            <p className="mt-2 text-green-100">
              {standing.rank === 1
                ? 'You won! Take a bow.'
                : isPodium
                ? 'You made the podium.'
                : 'Check the big screen for the podium.'}
            </p>
          </>
        )}

        {(hasError || (standing && standing.rank === 0)) && (
          <p className="mt-6 text-lg text-green-50">
            Check the big screen for the final results.
          </p>
        )}

        {isKitten && standing?.rank === 1 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={KITTEN_IMAGES.winner}
            alt="Science kitten celebrating your win"
            className="mt-8 w-48 h-auto motion-safe:animate-pop-in"
          />
        )}

        <p className="mt-12 text-2xl font-bold">Thanks for playing!</p>
      </div>
    </div>
  )
}
