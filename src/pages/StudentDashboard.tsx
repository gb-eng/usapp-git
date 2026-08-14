import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import ConfirmModal from '../components/ConfirmModal'
import { supabase } from '../lib/supabaseClient'
import '../styles/DashboardEmpty.css'
import './StudentDashboard.css'

type ClassRow = {
  id: string
  grade_strand: string
  section: string
  class_code: string
}

type Lesson = { id: string; title: string; order_index: number }
type QuizAttempt = { id: string; lesson_id: string; score: number; answers: unknown[] }
type WordAttempt = { id: string; lesson_id: string; score: number; answers: unknown[] }
type StorySet = { id: string; lesson_id: string; title: string }
type StorySubmission = { id: string; lesson_id: string; storytelling_set_id: string; rating: number | null; status: 'for_checking' | 'reviewed' }
type Prompt = { id: string; lesson_id: string; title: string }
type DiscussionResponseRow = { id: string; lesson_id: string; prompt_id: string; rating: number | null; status: 'for_checking' | 'reviewed' }
type OpinionResponseRow = { id: string; lesson_id: string; prompt_id: string; rating: number | null; status: 'for_checking' | 'reviewed' }

type Tab = 'lessons' | 'scores'

// Discussion Hub / Opinion Sharing / Storytelling are graded on a 1-3 rating,
// converted to a percentage -- a different grading model from Quiz/Word's raw score.
function ratingToPct(rating: number) {
  return Math.round((rating / 3) * 100)
}

export default function StudentDashboard() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null)
  const [joinedClass, setJoinedClass] = useState<ClassRow | null>(null)

  // Join form
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // Dashboard data
  const [tab, setTab] = useState<Tab>('lessons')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([])
  const [wordAttempts, setWordAttempts] = useState<WordAttempt[]>([])
  const [discussionItems, setDiscussionItems] = useState<DiscussionResponseRow[]>([])
  const [discussionPrompts, setDiscussionPrompts] = useState<Prompt[]>([])
  const [opinionItems, setOpinionItems] = useState<OpinionResponseRow[]>([])
  const [opinionPrompts, setOpinionPrompts] = useState<Prompt[]>([])
  const [storyItems, setStoryItems] = useState<StorySubmission[]>([])
  const [storySets, setStorySets] = useState<StorySet[]>([])
  const [rank, setRank] = useState<{ rank: number; total_students: number } | null>(null)

  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function loadClassData(classRow: ClassRow, userId: string) {
    setJoinedClass(classRow)

    const [lessonsRes, quizRes, wordRes, discussionPromptsRes, discussionRes, opinionPromptsRes, opinionRes, storySetsRes, storyRes, rankRes] = await Promise.all([
      supabase.from('lessons').select('id, title, order_index').eq('class_id', classRow.id).order('order_index'),
      supabase.from('quiz_attempts').select('id, lesson_id, score, answers').eq('student_id', userId),
      supabase.from('word_attempts').select('id, lesson_id, score, answers').eq('student_id', userId),
      supabase.from('discussion_prompts').select('id, lesson_id, title'),
      supabase.from('discussion_responses').select('id, lesson_id, prompt_id, rating, status').eq('student_id', userId),
      supabase.from('opinion_prompts').select('id, lesson_id, title'),
      supabase.from('opinion_responses').select('id, lesson_id, prompt_id, rating, status').eq('student_id', userId),
      supabase.from('storytelling_sets').select('id, lesson_id, title'),
      supabase.from('storytelling_submissions').select('id, lesson_id, storytelling_set_id, rating, status').eq('student_id', userId),
      supabase.rpc('get_my_class_rank'),
    ])

    setLessons(lessonsRes.data ?? [])
    setQuizAttempts(quizRes.data ?? [])
    setWordAttempts(wordRes.data ?? [])
    setDiscussionPrompts(discussionPromptsRes.data ?? [])
    setDiscussionItems(discussionRes.data ?? [])
    setOpinionPrompts(opinionPromptsRes.data ?? [])
    setOpinionItems(opinionRes.data ?? [])
    setStorySets(storySetsRes.data ?? [])
    setStoryItems(storyRes.data ?? [])
    if (rankRes.data && rankRes.data[0]) setRank(rankRes.data[0])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('full_name, class_id')
        .eq('id', user.id)
        .maybeSingle()

      setProfile(profileRow ?? null)

      if (profileRow?.class_id) {
        const { data: classRow } = await supabase
          .from('classes')
          .select('id, grade_strand, section, class_code')
          .eq('id', profileRow.class_id)
          .maybeSingle()

        if (classRow) {
          await loadClassData(classRow, user.id)
        }
      }

      setLoading(false)
    }
    load()
  }, [navigate])

  async function handleJoinClass(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null)

    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) {
      setJoinError('Please enter a class code.')
      return
    }
    setJoining(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
      return
    }

    const { data: classRow, error: joinRpcError } = await supabase
      .rpc('join_class_by_code', { code: trimmedCode })
      .single()

    if (joinRpcError || !classRow) {
      setJoining(false)
      setJoinError('No class found with that code. Please check with your teacher.')
      return
    }

    await loadClassData(classRow as ClassRow, user.id)
    setJoining(false)
  }

  async function handleLeaveClass() {
    setLeaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ class_id: null }).eq('id', user.id)
    }
    setLeaving(false)
    setShowLeaveModal(false)
    setJoinedClass(null)
    setLessons([])
  }

  if (loading) {
    return (
      <div>
        <Header showLogin={false} showLogout />
        <main className="dashboard-empty"><p>Loading...</p></main>
      </div>
    )
  }

  // No class yet -- join form
  if (!joinedClass) {
    return (
      <div>
        <Header showLogin={false} showLogout />
        <main className="dashboard-empty">
          <span className="dashboard-empty-icon" aria-hidden="true">👥</span>
          <h1>Welcome, mag-aaral!</h1>
          <h2>No classes found.</h2>
          <p>
            It seems you haven't joined a class yet.
            <br />
            Enter a class code provided by your teacher to continue.
          </p>

          <form className="join-class-form" onSubmit={handleJoinClass}>
            <input
              type="text"
              placeholder="ABCDEFG"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
            {joinError && <p className="dashboard-error">{joinError}</p>}
            <button type="submit" className="btn btn-blue btn-lg" disabled={joining}>
              {joining ? 'Joining...' : 'Join Class'}
            </button>
          </form>
        </main>
        <footer className="footer">© 2026 — Usapp</footer>
      </div>
    )
  }

  const initials = (profile?.full_name ?? 'Student')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const findQuiz = (lessonId: string) => quizAttempts.find((a) => a.lesson_id === lessonId)
  const findWord = (lessonId: string) => wordAttempts.find((a) => a.lesson_id === lessonId)

  const isLessonComplete = (lesson: Lesson) =>
    Boolean(findQuiz(lesson.id)) &&
    Boolean(findWord(lesson.id)) &&
    (() => {
      const lessonPrompts = discussionPrompts.filter((p) => p.lesson_id === lesson.id)
      return lessonPrompts.length > 0 && lessonPrompts.every((p) => discussionItems.some((r) => r.prompt_id === p.id))
    })() &&
    (() => {
      const lessonPrompts = opinionPrompts.filter((p) => p.lesson_id === lesson.id)
      return lessonPrompts.length > 0 && lessonPrompts.every((p) => opinionItems.some((r) => r.prompt_id === p.id))
    })() &&
    (() => {
      const lessonSets = storySets.filter((s) => s.lesson_id === lesson.id)
      return lessonSets.length > 0 && lessonSets.every((s) => storyItems.some((sub) => sub.storytelling_set_id === s.id))
    })()

  const pct = (score: number, total: number) => (total > 0 ? Math.round((score / total) * 100) : 0)

  const quizLessons = lessons.filter((l) => findQuiz(l.id))
  const quizAvg = quizLessons.length
    ? Math.round(quizLessons.reduce((sum, l) => sum + pct(findQuiz(l.id)!.score, findQuiz(l.id)!.answers.length), 0) / quizLessons.length)
    : 0

  const wordLessons = lessons.filter((l) => findWord(l.id))
  const wordAvg = wordLessons.length
    ? Math.round(wordLessons.reduce((sum, l) => sum + pct(findWord(l.id)!.score, findWord(l.id)!.answers.length), 0) / wordLessons.length)
    : 0

  function ratedSummary(items: { rating: number | null }[]) {
    const rated = items.filter((i) => i.rating != null)
    const avg = rated.length ? Math.round(rated.reduce((sum, i) => sum + ratingToPct(i.rating!), 0) / rated.length) : 0
    return { avg, ratedCount: rated.length, total: items.length }
  }

  const discussionSummary = ratedSummary(discussionItems)
  const opinionSummary = ratedSummary(opinionItems)
  const storySummary = ratedSummary(storyItems)

  return (
    <div>
      <Header showLogin={false} showLogout showLeaderboards showMyProfile profileHref="/student" />
      <main className="student-dashboard">
        <div className="dashboard-header-card">
          <div className="dashboard-header-left">
            <span className="avatar-circle" aria-hidden="true">{initials}</span>
            <div>
              <h1>{profile?.full_name ?? 'Student'}</h1>
              <p>{joinedClass.grade_strand}</p>
              <p>Section {joinedClass.section}</p>
            </div>
          </div>
          <button type="button" className="btn btn-leave" onClick={() => setShowLeaveModal(true)}>
            Leave Class
          </button>
        </div>

        <div className="tab-toggle">
          <button
            type="button"
            className={tab === 'lessons' ? 'tab-btn tab-btn-active-blue' : 'tab-btn'}
            onClick={() => setTab('lessons')}
          >
            Lessons
          </button>
          <button
            type="button"
            className={tab === 'scores' ? 'tab-btn tab-btn-active-yellow' : 'tab-btn'}
            onClick={() => setTab('scores')}
          >
            Scores
          </button>
        </div>

        {tab === 'lessons' && (
          <section>
            <h2 className="section-title">Class: {joinedClass.grade_strand}</h2>
            {lessons.length === 0 && <p className="dashboard-muted">No lessons posted yet.</p>}
            {lessons.map((lesson) => (
              <Link key={lesson.id} to={`/lesson/${lesson.id}`} className="lesson-row lesson-row-link">
                <span>{lesson.title}</span>
                {isLessonComplete(lesson) ? (
                  <span className="pill pill-green">Completed</span>
                ) : (
                  <span className="chevron" aria-hidden="true">→</span>
                )}
              </Link>
            ))}
          </section>
        )}

        {tab === 'scores' && (
          <section>
            <h2 className="section-title">Class: {joinedClass.grade_strand}</h2>

            <ScoreRow label="Quick Recall Quiz" summary={`${quizAvg}% avg (${quizLessons.length} lessons)`}>
              {quizLessons.map((l) => (
                <ScoreDetail key={l.id} label={l.title} value={`${findQuiz(l.id)!.score}/${findQuiz(l.id)!.answers.length}`} href={`/lesson/${l.id}/quick-recall`} />
              ))}
            </ScoreRow>

            <ScoreRow label="Word Matching" summary={`${wordAvg}% avg (${wordLessons.length} lessons)`}>
              {wordLessons.map((l) => (
                <ScoreDetail key={l.id} label={l.title} value={`${findWord(l.id)!.score}/${findWord(l.id)!.answers.length}`} href={`/lesson/${l.id}/word-matching`} />
              ))}
            </ScoreRow>

            <ScoreRow label="Discussion Hub" summary={`${discussionSummary.avg}% avg (${discussionSummary.ratedCount}/${discussionSummary.total} rated)`}>
              {discussionItems.map((item) => {
                const prompt = discussionPrompts.find((p) => p.id === item.prompt_id)
                return (
                  <ScoreDetail
                    key={item.id}
                    label={prompt?.title ?? 'Discussion Hub'}
                    value={item.rating != null ? `${ratingToPct(item.rating)}%` : 'Pending'}
                    href={`/lesson/${item.lesson_id}/discussion/${item.prompt_id}`}
                  />
                )
              })}
            </ScoreRow>

            <ScoreRow label="Opinion Sharing" summary={`${opinionSummary.avg}% avg (${opinionSummary.ratedCount}/${opinionSummary.total} rated)`}>
              {opinionItems.map((item) => {
                const prompt = opinionPrompts.find((p) => p.id === item.prompt_id)
                return (
                  <ScoreDetail
                    key={item.id}
                    label={prompt?.title ?? 'Opinion Sharing'}
                    value={item.rating != null ? `${ratingToPct(item.rating)}%` : 'Pending'}
                    href={`/lesson/${item.lesson_id}/opinion/${item.prompt_id}`}
                  />
                )
              })}
            </ScoreRow>

            <ScoreRow label="Storytelling" summary={`${storySummary.avg}% avg (${storySummary.ratedCount}/${storySummary.total} rated)`}>
              {storyItems.map((item) => {
                const set = storySets.find((s) => s.id === item.storytelling_set_id)
                return (
                  <ScoreDetail
                    key={item.id}
                    label={set?.title ?? 'Storytelling'}
                    value={item.rating != null ? `${ratingToPct(item.rating)}%` : 'Pending'}
                    href={`/lesson/${item.lesson_id}/storytelling/${item.storytelling_set_id}`}
                  />
                )
              })}
            </ScoreRow>

            {rank && (
              <Link to="/leaderboards" className="rank-banner">
                <span>Your class rank: <strong>#{rank.rank} of {rank.total_students}</strong></span>
                <span>View Leaderboard →</span>
              </Link>
            )}
          </section>
        )}
      </main>
      <footer className="footer">© 2026 — Usapp</footer>

      {showLeaveModal && (
        <ConfirmModal
          icon="🚪"
          title="Leave Class?"
          message="If you leave a class, you will lose all progress and scores."
          confirmLabel="Leave Class"
          onClose={() => setShowLeaveModal(false)}
          onConfirm={handleLeaveClass}
          loading={leaving}
        />
      )}
    </div>
  )
}


function ScoreRow({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="score-row">
      <summary>
        <span>{label}</span>
        <span className="score-summary">{summary}</span>
      </summary>
      <div className="score-detail-list">{children}</div>
    </details>
  )
}

function ScoreDetail({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="score-detail-row">
      <span>{label}</span>
      <span>
        {value} <Link to={href} aria-label={`Open ${label}`}>↗</Link>
      </span>
    </div>
  )
}