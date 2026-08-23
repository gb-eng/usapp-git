import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessagesSquare } from 'lucide-react'
import Header from '../components/Header'
import ActivityHeader from '../components/ActivityHeader'
import { supabase } from '../lib/supabaseClient'
import './ActivityShell.css'
import './OpinionSharingActivity.css'

type Lesson = { id: string; title: string }
type Prompt = { id: string; lesson_id: string; title: string }
type MySubmission = { content_text: string; created_at: string; rating: number | null; comment: string | null; status: string }
type ClassResponse = { id: string; student_id: string; display_name: string; response_text: string; created_at: string }

const PAGE_SIZE = 3

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `${time}   ${date}`
}

export default function OpinionSharingActivity() {
  const { lessonId, promptId } = useParams<{ lessonId: string; promptId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [mySubmission, setMySubmission] = useState<MySubmission | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [classResponses, setClassResponses] = useState<ClassResponse[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMyUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setIsTeacher(profile?.role === 'teacher')

      if (!lessonId || !promptId) return

      const [lessonRes, promptRes, myRes, classRes] = await Promise.all([
        supabase.from('lessons').select('id, title').eq('id', lessonId).maybeSingle(),
        supabase.from('opinion_prompts').select('id, lesson_id, title').eq('id', promptId).maybeSingle(),
        supabase.from('opinion_responses').select('content_text, created_at, rating, comment, status').eq('prompt_id', promptId).eq('student_id', user.id).maybeSingle(),
        supabase.rpc('get_opinion_responses', { target_prompt_id: promptId }),
      ])

      if (!lessonRes.data || !promptRes.data) {
        setError('This activity could not be found.')
        setLoading(false)
        return
      }

      setLesson(lessonRes.data)
      setPrompt(promptRes.data)
      setMySubmission(myRes.data ?? null)
      setClassResponses(classRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [lessonId, promptId, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!draft.trim()) {
      setError('Please write your opinion before submitting.')
      return
    }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !lessonId || !promptId) {
      setSubmitting(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('opinion_responses')
      .insert({
        lesson_id: lessonId,
        prompt_id: promptId,
        student_id: user.id,
        content_text: draft.trim(),
        status: 'for_checking',
      })
      .select('content_text, created_at, rating, comment, status')
      .single()

    setSubmitting(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not submit your response. Please try again.')
      return
    }

    setMySubmission(data)
    setClassResponses((prev) => [
      ...prev,
      { id: `me-${Date.now()}`, student_id: user.id, display_name: 'You', response_text: data.content_text, created_at: data.created_at },
    ])
  }

  const headerProps = isTeacher
    ? { showLogin: false, showLogout: true, showLeaderboards: true, showMyProfile: true, profileHref: '/teacher' }
    : { showLogin: false, showLogout: true, showLeaderboards: true, showMyProfile: true, profileHref: '/student' }

  if (loading) {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main"><p>Loading...</p></main>
      </div>
    )
  }

  if (error && !prompt) {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main"><p className="dashboard-error">{error}</p></main>
      </div>
    )
  }

  if (!lesson || !prompt) return null

  const backHref = `/lesson/${lesson.id}`
  const visibleResponses = classResponses.slice(0, visibleCount)

  return (
    <div>
      <Header {...headerProps} />
      <main className="activity-main">
        <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Opinion Sharing" backHref={backHref} />
        <div className="activity-body">
          <div className="os-prompt">
            <MessagesSquare className="os-prompt-icon" size={28} aria-hidden="true" />
            <div>
              <h2>"{prompt.title}"</h2>
              <p className="os-instructions">Ang iyong sagot ay dapat binubuo ng hindi bababa sa 3 hanggang 5 pangungusap.</p>
            </div>
          </div>

          {isTeacher ? (
            <p className="dashboard-muted" style={{ marginBottom: 16 }}>Viewing as teacher — read only.</p>
          ) : mySubmission ? (
            <div className="os-response-card">
              <div className="os-response-card-header">
                <span>Your response:</span>
                <span>{formatDateTime(mySubmission.created_at)}</span>
              </div>
              <p>{mySubmission.content_text}</p>
              {mySubmission.comment?.trim() && (
                <>
                  <label className="os-response-card-header"><span>Teacher comments</span></label>
                  <textarea rows={3} readOnly value={mySubmission.comment} />
                </>
              )}
              <div style={{ textAlign: 'left' }}>
                {mySubmission.status === 'reviewed' && mySubmission.rating != null ? (
                  <span className="story-rating-pill">{{ 1: 'Needs Work', 2: 'Good', 3: 'Excellent' }[mySubmission.rating]}</span>
                ) : (
                  <p className="dashboard-muted">Awaiting teacher review.</p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="os-editor">
                <textarea
                  rows={8}
                  placeholder="Type your opinion here."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>

              {error && <p className="dashboard-error">{error}</p>}

              <div className="os-submit-row">
                <button type="submit" className="btn btn-blue btn-lg" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          )}

          <p className="os-class-responses-label">CLASS RESPONSES</p>
          <div className="os-class-responses">
            {visibleResponses.length === 0 && <p className="dashboard-muted">No responses yet.</p>}
            {visibleResponses.map((r) => (
              <div className="os-response-card" key={r.id}>
                <div className="os-response-card-header">
                  <span>{r.student_id === myUserId ? 'You' : r.display_name}</span>
                  <span>{formatDateTime(r.created_at)}</span>
                </div>
                <p>{r.response_text}</p>
              </div>
            ))}
          </div>
          {classResponses.length > visibleCount && (
            <button type="button" className="os-load-more" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              •••
            </button>
          )}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}