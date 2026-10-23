'use client'

import {
  Answer,
  Choice,
  Game,
  Participant,
  Question,
  QuizSet,
  supabase,
} from '@/types/types'
import { useCallback, useEffect, useState } from 'react'
import { KittenProvider, writeKittenPreference } from '@/lib/kitten'
import Lobby from './lobby'
import Quiz from './quiz'
import Results from './results'

enum AdminScreens {
  lobby = 'lobby',
  quiz = 'quiz',
  result = 'result',
}

export default function Home({
  params: { id: gameId },
}: {
  params: { id: string }
}) {
  const [currentScreen, setCurrentScreen] = useState<AdminScreens>(
    AdminScreens.lobby
  )

  const [participants, setParticipants] = useState<Participant[]>([])

  const [quizSet, setQuizSet] = useState<QuizSet>()

  useEffect(() => {
    const getQuestions = async () => {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('id', gameId)
        .single()
      if (gameError) {
        console.error(gameError.message)
        alert('Error getting game data')
        return
      }
      const { data, error } = await supabase
        .from('quiz_sets')
        .select(`*, questions(*, choices(*))`)
        .eq('id', gameData.quiz_set_id)
        .order('order', {
          ascending: true,
          referencedTable: 'questions',
        })
        .order('order', {
          ascending: true,
          referencedTable: 'questions.choices',
        })
        .single()
      if (error) {
        console.error(error.message)
        getQuestions()
        return
      }
      setQuizSet(data)
    }

    // Subscribe first (synchronously) so the effect can clean it up and no
    // join is missed between loading the list and listening for new ones.
    const channel = supabase
      .channel(`game-host-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const joined = payload.new as Participant
          setParticipants((currentParticipants) =>
            currentParticipants.some((p) => p.id === joined.id)
              ? currentParticipants
              : [...currentParticipants, joined]
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          // start the quiz game
          const game = payload.new as Game
          setIsKitten(game.kitten_mode)
          setCurrentQuestionSequence(game.current_question_sequence)
          setCurrentScreen(game.phase as AdminScreens)
        }
      )
      .subscribe()

    const loadGame = async () => {
      const { data } = await supabase
        .from('participants')
        .select()
        .eq('game_id', gameId)
        .order('created_at')
      if (data) {
        // Keep anyone who joined while the list was loading
        setParticipants((current) => [
          ...data,
          ...current.filter((p) => !data.some((d) => d.id === p.id)),
        ])
      }

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('id', gameId)
        .single()

      if (gameError) {
        alert(gameError.message)
        console.error(gameError)
        return
      }

      setIsKitten(gameData.kitten_mode)
      setGameCode(gameData.code)
      setCurrentQuestionSequence(gameData.current_question_sequence)
      setCurrentScreen(gameData.phase as AdminScreens)
    }

    getQuestions()
    loadGame()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  const [currentQuestionSequence, setCurrentQuestionSequence] = useState(0)

  // Hidden Kitten mode lives on the game so every player's phone follows it
  const [isKitten, setIsKitten] = useState(false)
  const [gameCode, setGameCode] = useState<string>()
  const toggleKitten = useCallback(async () => {
    const next = !isKitten
    setIsKitten(next)
    writeKittenPreference(next)
    const { error } = await supabase
      .from('games')
      .update({ kitten_mode: next })
      .eq('id', gameId)
    if (error) {
      console.error(error)
      setIsKitten(!next)
    }
  }, [isKitten, gameId])

  return (
    <KittenProvider enabled={isKitten} onToggle={toggleKitten}>
    <main className="bg-green-700 min-h-dvh">
      {currentScreen == AdminScreens.lobby && (
        <Lobby
          participants={participants}
          gameId={gameId}
          gameCode={gameCode}
          quizName={quizSet?.name}
        ></Lobby>
      )}
      {currentScreen != AdminScreens.lobby && !quizSet && (
        <div className="min-h-dvh flex items-center justify-center text-2xl font-semibold text-green-100">
          Loading questions…
        </div>
      )}
      {currentScreen == AdminScreens.quiz && quizSet && (
        <Quiz
          question={quizSet.questions[currentQuestionSequence]}
          questionCount={quizSet.questions.length}
          gameId={gameId}
          participants={participants}
        ></Quiz>
      )}
      {currentScreen == AdminScreens.result && quizSet && (
        <Results
          participants={participants!}
          quizSet={quizSet}
          gameId={gameId}
        ></Results>
      )}
    </main>
    </KittenProvider>
  )
}
