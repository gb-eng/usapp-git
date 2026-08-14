import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import ActivityHeader from '../components/ActivityHeader'
import { supabase } from '../lib/supabaseClient'
import './ActivityShell.css'
import './StorytellingActivity.css'

type Lesson = { id: string; title: string }
type StorySet = { id: string; lesson_id: string; title: string; photo_urls: string[] }
type Submission = { id: string; drive_link: string | null; rating: number | null; comment: string | null; status: 'for_checking' | 'reviewed' }

const RATING_LABEL: Record<number, string> = { 1: 'Needs Work', 2: 'Good', 3: 'Excellent' }

function isDriveUrl(url: string) {
  return /^https?:\/\//.test(url.trim())
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
            <div className="story-hint">
              <p>Individual student submissions for this activity aren't shown here.</p>
              <p>
                Review and rate them from the <Link to="/teacher">Reviews tab</Link> on your dashboard.
              </p>
            </div>
          ) : (
            <>
              {!submission && (
                <>
                  <div className="story-hint">Read each picture first before you begin.</div>
                  <p className="story-instructions">
                    Instructions: When you're ready, record yourself telling this story out loud in
                    English, upload it to your own Google Drive, and paste the link below. Video must
                    be limited to only 1-2 minutes and less than 5MB.
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
    </div>
  )
}