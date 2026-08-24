import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import ActivityHeader from '../components/ActivityHeader'
import ReviewModal from '../components/ReviewModal'
import { supabase } from '../lib/supabaseClient'
import './ActivityShell.css'
import './StorytellingActivity.css'

type Lesson = { id: string; title: string }
type StorySet = { id: string; lesson_id: string; title: string; photo_urls: string[] }
type Submission = { id: string; drive_link: string | null; rating: number | null; comment: string | null; status: 'for_checking' | 'reviewed' }
type ClassSubmission = {
  id: string
  student_id: string
  display_name: string
  drive_link: string | null
  rating: number | null
  comment: string | null
  status: 'for_checking' | 'reviewed'
  created_at: string
}

const RATING_LABEL: Record<number, string> = { 1: 'Needs Work', 2: 'Good', 3: 'Excellent' }

function isDriveUrl(url: string) {
  return /^https?:\/\//.test(url.trim())
}

function initialsOf(displayName: string) {
  const parts = displayName.trim().split(/\s+/)
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export default function StorytellingActivity() {
  const { lessonId, setId } = useParams<{ lessonId: string; setId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [storySet, setStorySet] = useState<StorySet | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [classSubmissions, setClassSubmissions] = useState<ClassSubmission[]>([])
  const [activeSubmission, setActiveSubmission] = useState<ClassSubmission | null>(null)
  const [savingReview, setSavingReview] = useState(false)

  async function loadClassSubmissions(targetSetId: string) {
    const { data } = await supabase.rpc('get_storytelling_submissions', { target_story_set_id: targetSetId })
    setClassSubmissions(data ?? [])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const teacher = profile?.role === 'teacher'
      setIsTeacher(teacher)

      if (!lessonId || !setId) return

      const [lessonRes, setRes, subRes] = await Promise.all([
        supabase.from('lessons').select('id, title').eq('id', lessonId).maybeSingle(),
        supabase.from('storytelling_sets').select('id, lesson_id, title, photo_urls').eq('id', setId).maybeSingle(),
        teacher
          ? Promise.resolve({ data: null })
          : supabase
              .from('storytelling_submissions')
              .select('id, drive_link, rating, comment, status')
              .eq('storytelling_set_id', setId)
              .eq('student_id', user.id)
              .maybeSingle(),
      ])

      if (!lessonRes.data || !setRes.data) {
        setError('This storytelling activity could not be found.')
        setLoading(false)
        return
      }

      setLesson(lessonRes.data)
      setStorySet(setRes.data)
      setSubmission(subRes.data ?? null)

      if (teacher) {
        await loadClassSubmissions(setId)
      }

      setLoading(false)
    }
    load()
  }, [lessonId, setId, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!videoUrl.trim() || !isDriveUrl(videoUrl)) {
      setError('Please paste a valid link (starting with http:// or https://).')
      return
    }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !lessonId || !setId) {
      setSubmitting(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('storytelling_submissions')
      .insert({
        lesson_id: lessonId,
        storytelling_set_id: setId,
        student_id: user.id,
        drive_link: videoUrl.trim(),
        status: 'for_checking',
      })
      .select('id, drive_link, rating, comment, status')
      .single()

    setSubmitting(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not submit your response. Please try again.')
      return
    }
    setSubmission(data)
  }

  async function handleConfirmReview(rating: 1 | 2 | 3, comment: string) {
    if (!activeSubmission || !setId) return
    setSavingReview(true)
    const { error: updateError } = await supabase
      .from('storytelling_submissions')
      .update({ rating, comment, status: 'reviewed' })
      .eq('id', activeSubmission.id)

    setSavingReview(false)
    if (!updateError) {
      setActiveSubmission(null)
      await loadClassSubmissions(setId)
    }
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

  if (error && !storySet) {
    return (
      <div>
        <Header {...headerProps} />
        <main className="activity-main"><p className="dashboard-error">{error}</p></main>
      </div>
    )
  }

  if (!lesson || !storySet) return null

  const backHref = `/lesson/${lesson.id}`

  return (
    <div>
      <Header {...headerProps} />
      <main className="activity-main">
        <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Storytelling" backHref={backHref} />
        <div className="story-body">
          <div className="story-card">
            <p className="story-card-title">"{storySet.title}"</p>
            <div className="story-photo-row">
              {storySet.photo_urls.length > 0 ? (
                storySet.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt="" className="story-photo" />
                ))
              ) : (
                [0, 1, 2].map((i) => <div key={i} className="story-photo story-photo-placeholder" />)
              )}
            </div>
          </div>

          {isTeacher ? (
            <>
              <p className="story-teacher-label">CLASS RESPONSES</p>
              <div className="story-teacher-list">
                {classSubmissions.length === 0 && <p className="dashboard-muted">No submissions yet.</p>}
                {classSubmissions.map((s) => (
                  <div className="story-teacher-row" key={s.id}>
                    <div className="story-teacher-row-main">
                      <span>{s.display_name}</span>
                      {s.status === 'reviewed' && s.rating != null ? (
                        <span className="pill pill-green">{RATING_LABEL[s.rating]}</span>
                      ) : (
                        <span className="pill pill-yellow">Pending</span>
                      )}
                    </div>
                    <div className="story-teacher-row-actions">
                      {s.drive_link && (
                        <a href={s.drive_link} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                          Open in Drive ↗
                        </a>
                      )}
                      <button type="button" className="btn btn-blue btn-sm" onClick={() => setActiveSubmission(s)}>
                        {s.status === 'reviewed' ? 'Edit Review' : 'Review'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {!submission && (
                <>
                  <div className="story-hint">Read each picture first before you begin.</div>
                  <p className="story-instructions">
                    Look closely at the three pictures — they show a short story in order. When
                    you're ready, record yourself telling that story out loud in your own words,
                    mixing English and Filipino naturally (Taglish) the way you normally would.
                  </p>
                  <p className="story-instructions">
                    Then upload your recording to your own Google Drive, and paste the link below.
                    Video must be limited to only 1-2 minutes and less than 5MB.
                  </p>

                  <form onSubmit={handleSubmit}>
                    <label className="story-label">Your response:</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                    <p className="story-note">
                      <span aria-hidden="true">ⓘ</span> Make sure sharing is set to "Anyone with the link can view".
                    </p>

                    {error && <p className="dashboard-error">{error}</p>}

                    <button type="submit" className="btn btn-blue btn-lg" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </form>
                </>
              )}

              {submission && (
                <>
                  <label className="story-label">Your response</label>
                  <div className="story-response-row">
                    <input type="text" value={submission.drive_link ?? ''} readOnly />
                    {submission.drive_link && (
                      <a href={submission.drive_link} target="_blank" rel="noreferrer" className="btn btn-blue">
                        Open in Drive ↗
                      </a>
                    )}
                  </div>

                  <label className="story-label">Teacher comments</label>
                  <textarea
                    rows={4}
                    readOnly
                    placeholder="Comments here..."
                    value={submission.comment ?? ''}
                  />

                  {submission.status === 'reviewed' && submission.rating != null ? (
                    <span className="story-rating-pill">{RATING_LABEL[submission.rating]}</span>
                  ) : (
                    <p className="dashboard-muted">Awaiting teacher review.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>

      {activeSubmission && (
        <ReviewModal
          type="storytelling"
          studentName={activeSubmission.display_name}
          studentInitials={initialsOf(activeSubmission.display_name)}
          lessonTitle={lesson.title}
          prompt=""
          storyTitle={storySet.title}
          photoUrls={storySet.photo_urls}
          videoUrl={activeSubmission.drive_link ?? undefined}
          onClose={() => setActiveSubmission(null)}
          onConfirm={handleConfirmReview}
          loading={savingReview}
        />
      )}
    </div>
  )
}