import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import ActivityHeader from '../components/ActivityHeader'
import { supabase } from '../lib/supabaseClient'
import { GUEST_DEMO_LESSON_ID } from '../lib/guestConstants'
import './ActivityShell.css'
import './QuickRecallActivity.css'

type QuizItem = {
  id: string
  question: string
  hint: string | null
  choices: string[]
  correct_index: number
  explanation: string | null
  filipino: string | null
}

type Answer = { selectedIndex: number; isCorrect: boolean }
type Lesson = { id: string; title: string }

export default function QuickRecallActivity() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<'loading' | 'intro' | 'question' | 'results' | 'completed'>('loading')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [questions, setQuestions] = useState<QuizItem[]>([])
  const [pastScore, setPastScore] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [pendingSelection, setPendingSelection] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [isTeacherPreview, setIsTeacherPreview] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const guest = !user && lessonId === GUEST_DEMO_LESSON_ID
      if (!user && !guest) {
        navigate('/login')
        return
      }
      let teacherLocal = false
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (profile?.role === 'teacher') {
        setIsTeacherPreview(true)
        teacherLocal = true
      }
      }
      setIsGuest(guest)
      if (!lessonId) return

      const [lessonRes, activityRes] = await Promise.all([
  supabase
    .from('lessons')
    .select('id, title')
    .eq('id', lessonId)
    .maybeSingle(),

  supabase
    .from('lesson_activity_sets')
    .select('item_ids')
    .eq('lesson_id', lessonId)
    .eq('activity_type', 'quick_recall')
    .maybeSingle(),
])

console.log("ACTIVITY DEBUG", activityRes.data)

if (!lessonRes.data) {
  setError('This lesson could not be found.')
  return
}

if (!activityRes.data?.item_ids?.length) {
  setError('Quick Recall has not been generated for this lesson yet.')
  return
}

const { data: quizzes, error: quizzesError } = await supabase
  .from('quiz_bank')
  .select('id, question, hint, choices, correct_index, explanation, filipino')
  .in('id', activityRes.data.item_ids)

  
console.log("QUIZ FETCH DEBUG", {
  quizzes,
  quizzesError,
  requestedIds: activityRes.data.item_ids
})

if (quizzesError) {
  setError(quizzesError.message)
  return
}

const orderedQuestions: QuizItem[] = (activityRes.data.item_ids as string[])
  .map((id: string) => (quizzes ?? []).find((q: QuizItem) => q.id === id))
  .filter((q): q is QuizItem => Boolean(q))

if (user && !teacherLocal && !guest) {
  const { data: existingAttempts } = await supabase
    .from('quiz_attempts')
    .select('score')
    .eq('lesson_id', lessonId)
    .eq('student_id', user.id)
    .limit(1)

  if (existingAttempts && existingAttempts.length > 0) {
    setLesson(lessonRes.data)
    setQuestions(orderedQuestions)
    setPastScore(existingAttempts[0].score)
    setPhase('completed')
    return
  }
}

setLesson(lessonRes.data)
setQuestions(orderedQuestions)
setPhase('intro')
    }
    load()
  }, [lessonId, navigate])

  const headerProps = isGuest
    ? { showLogin: false, showLogout: false, showLeaderboards: false, showMyProfile: false, homeHref: '/guest' }
    : { showLogin: false, showLogout: true, showLeaderboards: true, showMyProfile: true, profileHref: '/student' }

  const current = questions[currentIndex]
  const currentAnswer = answers[currentIndex]

  function handleSelect(index: number) {
    if (isTeacherPreview) return
    if (currentAnswer) return
    setPendingSelection(index)
  }

  function handleSubmit() {
    if (pendingSelection == null || !current) return
    const isCorrect = pendingSelection === current.correct_index
    setAnswers((prev) => ({ ...prev, [currentIndex]: { selectedIndex: pendingSelection, isCorrect } }))
  }

  async function handleNext() {
  if (currentIndex < questions.length - 1) {
    setCurrentIndex((i) => i + 1)
    setPendingSelection(null)
    return
  }

  if (isTeacherPreview) {
    navigate(backHref)
    return
  }

  await finishAttempt()
}

  function handlePrevious() {
    if (currentIndex === 0) return
    setCurrentIndex((i) => i - 1)
    setPendingSelection(null)
  }

  async function finishAttempt() {
        if (isTeacherPreview) {
      setPhase('intro')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const score = Object.values(answers).filter((a) => a.isCorrect).length
    const answerPayload = questions.map((q, i) => ({
      question_id: q.id,
      question: q.question,
      selected_index: answers[i]?.selectedIndex ?? null,
      is_correct: answers[i]?.isCorrect ?? false,
    }))

    if (user && lessonId) {
      await supabase.from('quiz_attempts').insert({
        lesson_id: lessonId,
        student_id: user.id,
        score,
        answers: answerPayload,
      })
    }

    setSaving(false)
    setPhase('results')
  }

  if (phase === 'loading') {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main"><p>Loading...</p></main>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main"><p className="dashboard-error">{error ?? 'Something went wrong.'}</p></main>
      </div>
    )
  }

  const backHref = isGuest ? '/guest' : `/lesson/${lesson.id}`

  if (phase === 'completed') {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main">
          <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Quick Recall Quiz 1" backHref={backHref} />
          <div className="activity-body activity-results">
            <span className="activity-results-icon" aria-hidden="true">✅</span>
            <h2>You've already completed this quiz</h2>
            <p className="activity-results-score">{pastScore}/{questions.length}</p>
            <p>Each Quick Recall Quiz can only be taken once.</p>
            <button type="button" className="btn btn-blue btn-lg" onClick={() => navigate(backHref)}>
              ← Back
            </button>
          </div>
        </main>
        <footer className="footer">© 2026 — Usapp</footer>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main">
          <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Quick Recall Quiz 1" backHref={backHref} />
          <div className="activity-body activity-intro">
            <span className="activity-intro-icon" aria-hidden="true">🧠</span>
            <h2>Quick Recall Quiz</h2>
            <p>{questions.length} questions to check what you've learned from this lesson</p>
            <p className="activity-intro-filipino">Sagutin ang mga tanong sa pinakamahusay mong makakaya.</p>
            <button type="button" className="btn btn-blue btn-lg" onClick={() => setPhase('question')} disabled={questions.length === 0}>
              Start Quiz
            </button>
            {questions.length === 0 && <p className="dashboard-muted">No questions have been added to this lesson yet.</p>}
          </div>
        </main>
        <footer className="footer">© 2026 — Usapp</footer>
      </div>
    )
  }

  if (phase === 'question' && current) {
    const submitted = Boolean(currentAnswer)
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main">
          <ActivityHeader
            unitLabel="Introduction to Code-switching"
            lessonTitle={lesson.title}
            activityLabel="Quick Recall Quiz 1"
            backHref={backHref}
            progress={{ current: currentIndex + 1, total: questions.length }}
            showPrevious={currentIndex > 0}
            onPrevious={handlePrevious}
          />
          <div className="activity-body">
            <div className="qr-prompt">
              <span className="qr-prompt-icon" aria-hidden="true">🧠</span>
              <p>{current.question}</p>
            </div>

            {current.hint && (
              <div className="qr-hint">
                <span aria-hidden="true">💡</span> <strong>Hint:</strong> <em>{current.hint}</em>
              </div>
            )}

            <div className="qr-options">
              {current.choices.map((choice, i) => {
                const letter = String.fromCharCode(65 + i)
                let stateClass = ''
                if (isTeacherPreview) {
                if (i === current.correct_index) {
                  stateClass = 'qr-option-correct'
                }
              } else if (submitted) {
                if (i === current.correct_index) {
                  stateClass = 'qr-option-correct'
                } else if (i === currentAnswer.selectedIndex) {
                  stateClass = 'qr-option-incorrect'
                }
              } else if (pendingSelection === i) {
                stateClass = 'qr-option-selected'
              }
                return (
                  <button
                  key={i}
                  type="button"
                  className={`qr-option ${stateClass}`}
                  onClick={() => handleSelect(i)}
                  disabled={submitted || isTeacherPreview}
                >
                  {letter}. {choice}
                </button>
                )
              })}
            </div>

            {!submitted && !isTeacherPreview && (
            <button
              type="button"
              className="btn btn-blue btn-lg"
              disabled={pendingSelection == null}
              onClick={handleSubmit}
            >
              Submit
            </button>
          )}

            {isTeacherPreview && (
  <>
    <div className="qr-feedback qr-feedback-correct">
      <p className="qr-feedback-title">
        ✓ Correct Answer
      </p>
      <p>
        {current.explanation ?? 'This is the correct answer for this question.'}
      </p>
    </div>

    <button
      type="button"
      className="btn btn-blue btn-lg"
      onClick={handleNext}
      disabled={saving}
    >
      {currentIndex < questions.length - 1
        ? 'Next Question →'
        : 'Back to Lesson →'}
    </button>
  </>
)}

        {!isTeacherPreview && submitted && (
          <>
            <div className={currentAnswer.isCorrect ? 'qr-feedback qr-feedback-correct' : 'qr-feedback qr-feedback-incorrect'}>
              <p className="qr-feedback-title">
                {currentAnswer.isCorrect ? '✓ Correct!' : '✕ Not quite...'}
              </p>

              {currentAnswer.isCorrect ? (
                <p>
                  {current.explanation}
                </p>
              ) : (
                <p>
                  The correct answer is {String.fromCharCode(65 + current.correct_index)}, "{current.choices[current.correct_index]}"
                  {current.explanation ? ` — ${current.explanation}` : ''}
                  .
                </p>
              )}
            </div>

            <button
              type="button"
              className="btn btn-blue btn-lg"
              onClick={handleNext}
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : currentIndex < questions.length - 1
                  ? 'Next Question →'
                  : 'See Results →'}
            </button>
          </>
        )}
          </div>
        </main>
        <footer className="footer">© 2026 — Usapp</footer>
      </div>
    )
  }

  const score = Object.values(answers).filter((a) => a.isCorrect).length
  return (
    <div>
      <Header {...headerProps} />
      <main className="activity-main">
        <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Quick Recall Quiz 1" backHref={backHref} />
        <div className="activity-body activity-results">
          <span className="activity-results-icon" aria-hidden="true">🎉</span>
          <h2>Quiz complete!</h2>
          <p className="activity-results-score">{score}/{questions.length}</p>
          <p>Great effort! You can now review your answers below.</p>

          <div className="qr-review-list">
            {questions.map((q, i) => {
              const a = answers[i]
              const correct = a?.isCorrect
              return (
                <div key={q.id} className={correct ? 'qr-review-row qr-review-correct' : 'qr-review-row qr-review-incorrect'}>
                  <span className="qr-review-mark" aria-hidden="true">{correct ? '✓' : '✕'}</span>
                  <div>
                    <p className="qr-review-question">"{q.question}"</p>
                    {correct ? (
                      <p>Your answer: {String.fromCharCode(65 + a.selectedIndex)}. {q.choices[a.selectedIndex]}</p>
                    ) : (
                      <>
                        <p>Your answer: {a ? q.choices[a.selectedIndex] : 'No answer'}</p>
                        <p>Correct: {q.choices[q.correct_index]}</p>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <button type="button" className="btn btn-blue btn-lg" onClick={() => navigate(backHref)}>
            ← Back
          </button>
          {!isGuest && (
            <button type="button" className="activity-view-all-link" onClick={() => navigate('/student')}>
              View all lessons
            </button>
          )}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}