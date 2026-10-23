import { QUESTION_ANSWER_TIME, TIME_TIL_CHOICE_REVEAL } from '@/constants'
import { Answer, Participant, Question, supabase } from '@/types/types'
import { useEffect, useRef, useState } from 'react'
import { CountdownCircleTimer } from 'react-countdown-circle-timer'
import BrandMark from '../../brand-mark'

// Same order as the players' phones: red, blue, yellow, green.
// Yellow carries dark text; white on yellow fails contrast.
const CHOICE_STYLES = [
  { tile: 'bg-red-500 text-white', bar: 'bg-red-500' },
  { tile: 'bg-blue-500 text-white', bar: 'bg-blue-500' },
  { tile: 'bg-yellow-400 text-yellow-950', bar: 'bg-yellow-400' },
  { tile: 'bg-green-500 text-green-950', bar: 'bg-green-500' },
]

const choiceStyle = (index: number) => CHOICE_STYLES[index % CHOICE_STYLES.length]

export default function Quiz({
  question: question,
  questionCount: questionCount,
  gameId,
  participants,
}: {
  question: Question
  questionCount: number
  gameId: string
  participants: Participant[]
}) {
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)

  const [hasShownChoices, setHasShownChoices] = useState(false)

  const [answers, setAnswers] = useState<Answer[]>([])

  const [isAdvancing, setIsAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)

  const answerStateRef = useRef<Answer[]>()

  answerStateRef.current = answers

  const isLastQuestion = questionCount == question.order + 1

  const getNextQuestion = async () => {
    setIsAdvancing(true)
    setAdvanceError(null)
    var updateData
    if (isLastQuestion) {
      updateData = { phase: 'result' }
    } else {
      updateData = {
        current_question_sequence: question.order + 1,
        is_answer_revealed: false,
      }
    }

    const { error } = await supabase
      .from('games')
      .update(updateData)
      .eq('id', gameId)
    setIsAdvancing(false)
    if (error) {
      console.error(error)
      setAdvanceError('Couldn’t move on. Try again.')
    }
  }

  const onTimeUp = async () => {
    setIsAnswerRevealed(true)
    await supabase
      .from('games')
      .update({
        is_answer_revealed: true,
      })
      .eq('id', gameId)
  }

  useEffect(() => {
    setIsAnswerRevealed(false)
    setHasShownChoices(false)
    setAnswers([])

    const revealTimer = setTimeout(() => {
      setHasShownChoices(true)
    }, TIME_TIL_CHOICE_REVEAL)

    const channel = supabase
      .channel('answers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answers',
          filter: `question_id=eq.${question.id}`,
        },
        (payload) => {
          setAnswers((currentAnswers) => {
            return [...currentAnswers, payload.new as Answer]
          })

          if (
            (answerStateRef.current?.length ?? 0) + 1 ===
            participants.length
          ) {
            onTimeUp()
          }
        }
      )
      .subscribe()

    return () => {
      clearTimeout(revealTimer)
      supabase.removeChannel(channel)
    }
  }, [question.id])

  const countFor = (choiceId: string) =>
    answers.filter((answer) => answer.choice_id === choiceId).length
  const maxCount = Math.max(1, ...question.choices.map((c) => countFor(c.id)))

  return (
    <div className="min-h-dvh flex flex-col bg-green-950 text-white">
      {/* Top bar: progress and the host's one action */}
      <header className="px-6 lg:px-10 pt-5">
        <div className="flex items-center justify-between gap-4 min-h-[3.5rem]">
          <div className="flex items-center gap-3">
            <BrandMark className="w-7 h-7" />
            <p className="text-xl font-semibold text-green-100 tabular-nums">
              Question {question.order + 1}
              <span className="text-green-300/80"> of {questionCount}</span>
            </p>
          </div>

          {isAnswerRevealed && (
            <div className="flex items-center gap-3">
              {advanceError && (
                <p role="alert" className="text-sm font-semibold bg-red-600 text-white rounded-lg px-3 py-1.5">
                  {advanceError}
                </p>
              )}
              <button
                className="inline-flex items-center gap-3 h-14 px-8 rounded-2xl bg-white text-green-900 text-xl font-extrabold shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-[transform,background-color] hover:bg-green-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
                onClick={getNextQuestion}
                disabled={isAdvancing}
                autoFocus
              >
                {isLastQuestion ? 'See results' : 'Next question'}
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* One segment per question */}
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {Array.from({ length: questionCount }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < question.order
                  ? 'bg-green-400'
                  : i === question.order
                  ? 'bg-white'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </header>

      <h1 className="px-6 lg:px-10 pt-10 text-center text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight [text-wrap:balance] max-w-6xl mx-auto">
        {question.body}
      </h1>

      {/* Middle stage: reading → answering → results */}
      <div className="flex-grow flex items-center justify-center px-6 lg:px-10 py-8">
        {!hasShownChoices && (
          <div className="w-full max-w-md text-center">
            <p className="text-2xl font-semibold text-green-100">Read the question…</p>
            <div className="mt-5 h-3 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white origin-left motion-safe:animate-drain"
                style={{ animationDuration: `${TIME_TIL_CHOICE_REVEAL}ms` }}
              />
            </div>
          </div>
        )}

        {hasShownChoices && !isAnswerRevealed && (
          <div className="w-full max-w-4xl flex items-center justify-between gap-10">
            <CountdownCircleTimer
              onComplete={() => {
                onTimeUp()
              }}
              isPlaying
              duration={QUESTION_ANSWER_TIME / 1000}
              size={168}
              strokeWidth={12}
              trailColor="#14532d"
              colors={['#ffffff', '#facc15', '#ef4444', '#ef4444']}
              colorsTime={[QUESTION_ANSWER_TIME / 1000, 7, 3, 0]}
            >
              {({ remainingTime }) => (
                <span className="text-6xl font-extrabold tabular-nums">
                  {remainingTime}
                </span>
              )}
            </CountdownCircleTimer>

            <div className="text-right" aria-live="polite">
              <p className="text-7xl font-extrabold tabular-nums leading-none">
                {answers.length}
                <span className="text-4xl text-green-300/80"> / {participants.length}</span>
              </p>
              <p className="mt-2 text-2xl font-semibold text-green-100">answered</p>
            </div>
          </div>
        )}

        {isAnswerRevealed && (
          <div className="flex items-end justify-center gap-4 lg:gap-6 h-56" aria-label="Answers per choice">
            {question.choices.map((choice, index) => {
              const count = countFor(choice.id)
              return (
                <div key={choice.id} className={`w-24 lg:w-28 h-full flex flex-col items-center justify-end ${choice.is_correct ? '' : 'opacity-40'}`}>
                  <span className="mb-2 text-3xl font-extrabold tabular-nums">{count}</span>
                  <div
                    className={`w-full rounded-t-xl origin-bottom motion-safe:animate-rise ${choiceStyle(index).bar}`}
                    style={{
                      height: `${Math.max(4, (count / maxCount) * 100)}%`,
                      animationDelay: `${index * 80}ms`,
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasShownChoices && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 px-6 lg:px-10 pb-8">
          {question.choices.map((choice, index) => {
            const dimmed = isAnswerRevealed && !choice.is_correct
            const highlighted = isAnswerRevealed && choice.is_correct
            return (
              <li
                key={choice.id}
                className={`flex items-center justify-between gap-4 min-h-[5.5rem] px-6 py-4 rounded-2xl text-2xl lg:text-3xl font-bold transition-[opacity,transform] duration-300 ${
                  choiceStyle(index).tile
                } ${dimmed ? 'opacity-40' : ''} ${
                  highlighted ? 'ring-4 ring-white ring-offset-4 ring-offset-green-950' : ''
                }`}
              >
                <span className="[text-wrap:balance]">{choice.body}</span>
                {isAnswerRevealed && (
                  <span className="shrink-0" aria-label={choice.is_correct ? 'Correct' : 'Incorrect'}>
                    {choice.is_correct ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-9 h-9">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
