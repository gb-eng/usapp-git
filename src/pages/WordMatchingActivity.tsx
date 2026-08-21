import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import ActivityHeader from '../components/ActivityHeader'
import { supabase } from '../lib/supabaseClient'
import { GUEST_DEMO_LESSON_ID } from '../lib/guestConstants'
import './ActivityShell.css'
import './WordMatchingActivity.css'

type WordItem = {
  id: string
  word: string
  choices: string[]
  correct_index: number
  explanation: string | null
  filipino: string | null
}

type Answer = { selectedIndex: number; isCorrect: boolean }

type Lesson = { id: string; title: string }

export default function WordMatchingActivity() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<'loading' | 'intro' | 'question' | 'results'>('loading')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [questions, setQuestions] = useState<WordItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [pendingSelection, setPendingSelection] = useState<number | null>(null)
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
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (profile?.role === 'teacher') {
        setIsTeacherPreview(true)
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
    .eq('activity_type', 'word_matching')
    .maybeSingle(),
])

if (!lessonRes.data) {
  setError('This lesson could not be found.')
  return
}

if (!activityRes.data?.item_ids?.length) {
  setError('Word Matching has not been generated for this lesson yet.')
  return
}

const { data: words, error: wordsError } = await supabase
  .from('word_bank')
  .select('id, word, choices, correct_index, explanation, filipino')
  .in('id', activityRes.data.item_ids)

if (wordsError) {
  setError(wordsError.message)
  return
}

setLesson(lessonRes.data)
setQuestions((words ?? []) as WordItem[])
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

  const { data: { user } } = await supabase.auth.getUser()

  const score = Object.values(answers).filter((a) => a.isCorrect).length

  const answerPayload = questions.map((q, i) => ({
    word_id: q.id,
    word: q.word,
    selected_index: answers[i]?.selectedIndex ?? null,
    is_correct: answers[i]?.isCorrect ?? false,
  }))

  if (user && lessonId) {
    await supabase.from('word_attempts').insert({
      lesson_id: lessonId,
      student_id: user.id,
      score,
      answers: answerPayload,
    })
  }

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

  if (phase === 'intro') {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main">
          <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Word Matching" backHref={backHref} />
          <div className="activity-body activity-intro">
            <span className="activity-intro-icon" aria-hidden="true">🔤</span>
            <h2>Word Matching</h2>
            <p>{questions.length} words to check your vocabulary from this lesson</p>
            <p className="activity-intro-filipino">Piliin ang tamang kahulugan ng bawat salita.</p>
            <button type="button" className="btn btn-blue btn-lg" onClick={() => setPhase('question')} disabled={questions.length === 0}>
              Start Activity
            </button>
            {questions.length === 0 && <p className="dashboard-muted">No words have been added to this lesson yet.</p>}
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
            activityLabel="Word Matching"
            backHref={backHref}
            progress={{ current: currentIndex + 1, total: questions.length }}
            showPrevious={currentIndex > 0}
            onPrevious={handlePrevious}
          />
          <div className="activity-body">
            <div className="wm-prompt">
              <span className="wm-prompt-icon" aria-hidden="true">🔤</span>
              <div>
                <p>Match this word to its meaning:</p>
                <h2>{current.word}</h2>
              </div>
            </div>

            <div className="wm-options">
              {current.choices.map((choice, i) => {
                const letter = String.fromCharCode(65 + i)
                let stateClass = ''
                if (isTeacherPreview) {
                  if (i === current.correct_index) {
                    stateClass = 'wm-option-correct'
                  }
                } else if (submitted) {
                  if (i === current.correct_index) {
                    stateClass = 'wm-option-correct'
                  } else if (i === currentAnswer.selectedIndex) {
                    stateClass = 'wm-option-incorrect'
                  }
                } else if (pendingSelection === i) {
                  stateClass = 'wm-option-selected'
                }
                return (
                  <button
                    key={i}
                    type="button"
                    className={`wm-option ${stateClass}`}
                    onClick={() => handleSelect(i)}
                    disabled={submitted || isTeacherPreview}
                  >
                    {letter}. {choice}
                  </button>
                )
              })}
            </div>

            {!submitted && !isTeacherPreview && (
              <button type="button" className="btn btn-blue btn-lg" disabled={pendingSelection == null} onClick={handleSubmit}>
                Submit
              </button>
            )}

            {isTeacherPreview && (
              <>
                <div className="wm-feedback wm-feedback-correct">
                  <p className="wm-feedback-title">
                    ✓ Correct Answer
                  </p>

                  <p>
                    {current.explanation ?? 'This is the correct answer for this word.'}
                    {current.filipino ? ` Filipino: ${current.filipino}.` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-blue btn-lg"
                  onClick={() => {
                    if (currentIndex < questions.length - 1) {
                      handleNext()
                    } else {
                      navigate(backHref)
                    }
                  }}
                >
                  {currentIndex < questions.length - 1
                    ? 'Next Word →'
                    : 'Back to Lesson →'}
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
        <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Word Matching" backHref={backHref} />
        <div className="activity-body activity-results">
          <span className="activity-results-icon" aria-hidden="true">🎉</span>
          <h2>Word Matching complete!</h2>
          <p className="activity-results-score">{score}/{questions.length}</p>
          <p>Great effort! You can now review your answers below.</p>

          <div className="wm-review-list">
            {questions.map((q, i) => {
              const a = answers[i]
              const correct = a?.isCorrect
              return (
                <div key={q.id} className={correct ? 'wm-review-row wm-review-correct' : 'wm-review-row wm-review-incorrect'}>
                  <span className="wm-review-mark" aria-hidden="true">{correct ? '✓' : '✕'}</span>
                  <div>
                    <p className="wm-review-word">{q.word}</p>
                    {correct ? (
                      <p>Your answer: {q.choices[a.selectedIndex]}</p>
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