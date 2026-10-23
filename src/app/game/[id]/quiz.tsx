import { QUESTION_ANSWER_TIME, TIME_TIL_CHOICE_REVEAL } from '@/constants'
import { Choice, Question, supabase } from '@/types/types'
import { useState, useEffect } from 'react'
import { pickRandom, WRONG_PHRASES } from '@/lib/feedback-phrases'
import { KITTEN_IMAGES, randomWrongKitten, useKitten } from '@/lib/kitten'
import { ColorFormat, CountdownCircleTimer } from 'react-countdown-circle-timer'

export default function Quiz({
  question: question,
  questionCount: questionCount,
  participantId: playerId,
  isAnswerRevealed,
}: {
  question: Question
  questionCount: number
  participantId: string
  isAnswerRevealed: boolean
}) {
  const [chosenChoice, setChosenChoice] = useState<Choice | null>(null)

  const [hasShownChoices, setHasShownChoices] = useState(false)

  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  useEffect(() => {
    setChosenChoice(null)
    setHasShownChoices(false)
  }, [question.id])

  // Pick a fresh line each time an answer is revealed
  const [feedbackPhrase, setFeedbackPhrase] = useState('')
  const [wrongKitten, setWrongKitten] = useState(KITTEN_IMAGES.wrong[0])
  const { enabled: isKitten } = useKitten()
  useEffect(() => {
    if (!isAnswerRevealed) return
    setFeedbackPhrase(
      // "Sup?" lines are only shown for wrong answers in Kitten mode
      pickRandom(WRONG_PHRASES)
    )
    setWrongKitten(randomWrongKitten())
    // chosenChoice can't change once the answer is revealed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnswerRevealed, question.id])

  const answer = async (choice: Choice) => {
    setChosenChoice(choice)

    const now = Date.now()
    const score = !choice.is_correct
      ? 0
      : 1000 -
        Math.round(
          Math.max(
            0,
            Math.min((now - questionStartTime) / QUESTION_ANSWER_TIME, 1)
          ) * 1000
        )

    const { error } = await supabase.from('answers').insert({
      participant_id: playerId,
      question_id: question.id,
      choice_id: choice.id,
      score,
    })
    if (error) {
      setChosenChoice(null)
      alert(error.message)
    }
  }

  return (
    <div className="h-dvh flex flex-col items-stretch bg-slate-900 relative overflow-y-auto">
      <div className="text-center">
        <h2 className="pb-4 text-2xl bg-white font-bold mx-4 my-6 md:my-12 p-4 rounded inline-block md:text-3xl md:px-24">
          {question.body}
        </h2>
      </div>

      {!isAnswerRevealed && chosenChoice && (
        <div className="flex-grow flex justify-center items-center">
          <div className="text-white text-2xl text-center p-4">
            Wait for others to answer...
          </div>
        </div>
      )}

      {!hasShownChoices && !isAnswerRevealed && (
        <div className="flex-grow text-transparent flex justify-center">
          <CountdownCircleTimer
            onComplete={() => {
              setHasShownChoices(true)
              setQuestionStartTime(Date.now())
            }}
            isPlaying
            duration={TIME_TIL_CHOICE_REVEAL / 1000}
            size={120}
            colors={['#fff', '#fff', '#fff', '#fff']}
            trailColor={'transparent' as ColorFormat}
            colorsTime={[7, 5, 2, 0]}
          >
            {({ remainingTime }) => remainingTime}
          </CountdownCircleTimer>
        </div>
      )}

      {hasShownChoices && !isAnswerRevealed && !chosenChoice && (
        <div className="flex-grow flex flex-col items-stretch">
          <div className="flex-grow"></div>
          <div className="flex justify-between flex-wrap p-4">
            {question.choices.map((choice, index) => (
              <div key={choice.id} className="w-1/2 p-1">
                <button
                  onClick={() => answer(choice)}
                  disabled={chosenChoice !== null || isAnswerRevealed}
                  className={`px-4 py-6 w-full text-xl rounded text-white flex justify-between md:text-2xl md:font-bold
              ${
                index === 0
                  ? 'bg-red-500'
                  : index === 1
                  ? 'bg-blue-500'
                  : index === 2
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }
              ${isAnswerRevealed && !choice.is_correct ? 'opacity-60' : ''}
             `}
                >
                  <div>{choice.body}</div>
                  {isAnswerRevealed && (
                    <div>
                      {choice.is_correct && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={5}
                          stroke="currentColor"
                          className="w-6 h-6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                      )}
                      {!choice.is_correct && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={5}
                          stroke="currentColor"
                          className="w-6 h-6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                    </div>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAnswerRevealed && isKitten && (
        <div className="flex-grow flex justify-center items-center flex-col px-6 py-4 text-center min-h-0">
          {chosenChoice?.is_correct ? (
            // Right answer in Kitten mode: just the happy kitten
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={KITTEN_IMAGES.happy}
              alt="Happy kitten: correct!"
              className="w-72 max-w-full h-auto shrink-0 rounded-3xl bg-white p-4 motion-safe:animate-pop-in"
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wrongKitten}
                alt="Kitten reacting to a wrong answer"
                className="w-64 max-w-full h-auto shrink-0 rounded-3xl bg-white p-4 motion-safe:animate-pop-in"
              />
              <h2 className="mt-3 text-white text-4xl font-extrabold tracking-tight">Sup?</h2>
              <p className="mt-1 text-xl text-white/85">{feedbackPhrase}</p>
            </>
          )}
        </div>
      )}

      {isAnswerRevealed && !isKitten && (
        <div className="flex-grow flex justify-center items-center flex-col px-6 text-center">
          <div
            className={`text-white rounded-full p-4 motion-safe:animate-pop-in ${
              chosenChoice?.is_correct ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {chosenChoice?.is_correct && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            )}
            {!chosenChoice?.is_correct && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            )}
          </div>
          <h2 className="mt-4 text-white text-5xl font-extrabold tracking-tight">
            {chosenChoice?.is_correct ? 'Correct' : 'Incorrect'}
          </h2>
        </div>
      )}

      <div className="flex text-white py-2 px-4 items-center bg-black">
        <div className="text-2xl">
          {question.order + 1}/{questionCount}
        </div>
      </div>
    </div>
  )
}
