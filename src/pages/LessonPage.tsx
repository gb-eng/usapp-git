import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import { Brain, Puzzle, Clapperboard, MessagesSquare, MessageCircle } from 'lucide-react'
import './LessonPage.css'

type Lesson = {
  id: string
  title: string
  intro: string | null
  body: string | null
}

type Prompt = { id: string; title: string }
type StorySet = { id: string; title: string }

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<'student' | 'teacher'>('student')

  const [hasQuiz, setHasQuiz] = useState(false)
  const [hasWordMatching, setHasWordMatching] = useState(false)
  const [discussionPrompts, setDiscussionPrompts] = useState<Prompt[]>([])
  const [opinionPrompts, setOpinionPrompts] = useState<Prompt[]>([])
  const [storySets, setStorySets] = useState<StorySet[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role === 'teacher') setRole('teacher')

      const { data, error: fetchError } = await supabase
        .from('lessons')
        .select('id, title, intro, body')
        .eq('id', lessonId)
        .maybeSingle()

      if (fetchError || !data) {
        setError('This lesson could not be found.')
        setLoading(false)
        return
      }
      setLesson(data)

      const [activityRes, discRes, opRes, storyRes] = await Promise.all([
      supabase
        .from('lesson_activity_sets')
        .select('activity_type')
        .eq('lesson_id', lessonId),

      supabase
        .from('discussion_prompts')
        .select('id, title')
        .eq('lesson_id', lessonId),

      supabase
        .from('opinion_prompts')
        .select('id, title')
        .eq('lesson_id', lessonId),

      supabase
        .from('storytelling_sets')
        .select('id, title')
        .eq('lesson_id', lessonId),
    ])

      setHasQuiz(
        activityRes.data?.some(
          (a) => a.activity_type === 'quick_recall'
        ) ?? false
      )

      setHasWordMatching(
        activityRes.data?.some(
          (a) => a.activity_type === 'word_matching'
        ) ?? false
      )
      setDiscussionPrompts(discRes.data ?? [])
      setOpinionPrompts(opRes.data ?? [])
      setStorySets(storyRes.data ?? [])
      setLoading(false)
    }
    if (lessonId) load()
  }, [lessonId, navigate])

  const backHref = role === 'teacher' ? '/teacher' : '/student'
  const noActivities =
    !hasQuiz && !hasWordMatching && discussionPrompts.length === 0 &&
    opinionPrompts.length === 0 && storySets.length === 0

  return (
    <div>
      <Header showLogin={false} showLogout showLeaderboards showMyProfile profileHref={backHref} />
      <main className="lesson-main">
        {loading && <p>Loading...</p>}
        {error && <p className="dashboard-error">{error}</p>}
        {lesson && (
          <>
            <div className="lesson-header">
              <p className="lesson-eyebrow">Introduction to Code-switching</p>
              <h1>{lesson.title}</h1>
              <Link to={backHref} className="lesson-back">← Go back to class</Link>
            </div>

            <div className="lesson-body">
              {lesson.intro && <h2>{lesson.intro}</h2>}
              {lesson.body && (
                <div className="lesson-content" dangerouslySetInnerHTML={{ __html: lesson.body }} />
              )}

              <h2>Activities</h2>
              {noActivities && <p className="dashboard-muted">No activities have been added to this lesson yet.</p>}
              <div className="lesson-activity-list">
                {hasQuiz && (
                  <button type="button" className="lesson-activity-btn" onClick={() => navigate(`/lesson/${lesson.id}/quick-recall`)}>
                    <Brain size={20} className="lesson-activity-icon" aria-hidden="true" /> Quick Recall Quiz
                  </button>
                )}
                {hasWordMatching && (
                  <button type="button" className="lesson-activity-btn" onClick={() => navigate(`/lesson/${lesson.id}/word-matching`)}>
                    <Puzzle size={20} className="lesson-activity-icon" aria-hidden="true" /> Word Matching
                  </button>
                )}
                {storySets.map((set) => (
                  <button key={set.id} type="button" className="lesson-activity-btn" onClick={() => navigate(`/lesson/${lesson.id}/storytelling/${set.id}`)}>
                    <Clapperboard size={20} className="lesson-activity-icon" aria-hidden="true" /> Storytelling — {set.title}
                  </button>
                ))}
                {discussionPrompts.map((p) => (
                  <button key={p.id} type="button" className="lesson-activity-btn" onClick={() => navigate(`/lesson/${lesson.id}/discussion/${p.id}`)}>
                    <MessagesSquare size={20} className="lesson-activity-icon" aria-hidden="true" /> Discussion Hub — {p.title}
                  </button>
                ))}
                {opinionPrompts.map((p) => (
                  <button key={p.id} type="button" className="lesson-activity-btn" onClick={() => navigate(`/lesson/${lesson.id}/opinion/${p.id}`)}>
                    <MessageCircle size={20} className="lesson-activity-icon" aria-hidden="true" /> Opinion Sharing — {p.title}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}
