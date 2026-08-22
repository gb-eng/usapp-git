import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import ActivityHeader from '../components/ActivityHeader'
import AudioBar from '../components/AudioBar'
import { supabase } from '../lib/supabaseClient'
import './ActivityShell.css'
import './DiscussionHubActivity.css'

type Lesson = { id: string; title: string }
type Prompt = { id: string; lesson_id: string; title: string }
type ClassResponse = { id: string; student_id: string; display_name: string; audio_url: string; created_at: string }
type MySubmission = { audio_url: string; rating: number | null; comment: string | null; status: string }

const PAGE_SIZE = 3
const MAX_RECORDING_SECONDS = 180
const MAX_RECORDING_BYTES = 5 * 1024 * 1024

export default function DiscussionHubActivity() {
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
  const [error, setError] = useState<string | null>(null)

  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

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
        supabase.from('discussion_prompts').select('id, lesson_id, title').eq('id', promptId).maybeSingle(),
        supabase.from('discussion_responses').select('audio_url, rating, comment, status').eq('prompt_id', promptId).eq('student_id', user.id).maybeSingle(),
        supabase.rpc('get_discussion_responses', { target_prompt_id: promptId }),
      ])

      if (!lessonRes.data || !promptRes.data) {
        setError('This discussion could not be found.')
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())

        if (blob.size > MAX_RECORDING_BYTES) {
          setError('That recording is over 5MB — please record a shorter response and try again.')
          setRecordState('idle')
          setElapsedSeconds(0)
          return
        }

        setRecordedBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        setRecordState('recorded')
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecordState('recording')
      setElapsedSeconds(0)

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1
          if (next >= MAX_RECORDING_SECONDS) {
            mediaRecorderRef.current?.stop()
          }
          return next
        })
      }, 1000)
    } catch {
      setError('Could not access your microphone. Please check your browser permissions.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  function retryRecording() {
    setElapsedSeconds(0)
    setRecordedBlob(null)
    setPreviewUrl(null)
    setRecordState('idle')
    setError(null)
  }

  async function handleSubmit() {
    if (!recordedBlob || !lessonId || !promptId) return
    setSubmitting(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    const path = `${promptId}/${user.id}-${Date.now()}.webm`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('discussion-audio')
      .upload(path, recordedBlob)

    if (uploadError || !uploadData) {
      setError(uploadError?.message ?? 'Could not upload your recording. Please try again.')
      setSubmitting(false)
      return
    }

    const audioUrl = supabase.storage.from('discussion-audio').getPublicUrl(uploadData.path).data.publicUrl

    const { error: insertError } = await supabase.from('discussion_responses').insert({
      lesson_id: lessonId,
      prompt_id: promptId,
      student_id: user.id,
      audio_url: audioUrl,
      response_type: 'audio',
      status: 'for_checking',
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setMySubmission({ audio_url: audioUrl, rating: null, comment: null, status: 'for_checking' })
    setClassResponses((prev) => [...prev, { id: `me-${Date.now()}`, student_id: user.id, display_name: 'You', audio_url: audioUrl, created_at: new Date().toISOString() }])
    setRecordState('idle')
    setRecordedBlob(null)
    setPreviewUrl(null)
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
        <ActivityHeader unitLabel="Introduction to Code-switching" lessonTitle={lesson.title} activityLabel="Discussion Hub" backHref={backHref} />
        <div className="activity-body">
          <div className="dh-prompt">
            <span className="dh-prompt-icon" aria-hidden="true">🗣️</span>
            <div>
              <h2>"{prompt.title}"</h2>
              <p className="dh-instructions">Ang iyong sagot ay dapat hindi hihigit sa tatlong minuto at nasa wikang Ingles.</p>
            </div>
          </div>

          {isTeacher ? (
            <p className="dashboard-muted" style={{ marginBottom: 16 }}>Viewing as teacher — read only.</p>
          ) : mySubmission ? (
            <div className="dh-record-box">
              <p className="dh-submitted-label">Your response</p>
              <AudioBar src={mySubmission.audio_url} />
              <label className="os-response-card-header"><span>Teacher comments</span></label>
              <textarea rows={3} readOnly placeholder="Comments here..." value={mySubmission.comment ?? ''} />
              {mySubmission.status === 'reviewed' && mySubmission.rating != null ? (
                <span className="story-rating-pill">{{ 1: 'Needs Work', 2: 'Good', 3: 'Excellent' }[mySubmission.rating]}</span>
              ) : (
                <p className="dashboard-muted">Awaiting teacher review.</p>
              )}
            </div>
          ) : (
            <div className="dh-record-box">
              {recordState === 'idle' && (
                <>
                  <button type="button" className="dh-mic-btn" onClick={startRecording} aria-label="Start recording">🎤</button>
                  <p>Tap to record your response.</p>
                </>
              )}

              {recordState === 'recording' && (
                <>
                  <button type="button" className="dh-mic-btn dh-mic-recording" onClick={stopRecording} aria-label="Stop recording">⏹</button>
                  <p>Recording... tap to stop. ({Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')} / 3:00)</p>
                </>
              )}

              {recordState === 'recorded' && previewUrl && (
                <>
                  <p className="dh-playing-label">PLAYING: Your recording ...</p>
                  <AudioBar src={previewUrl} />
                  <div className="dh-recorded-actions">
                    <button type="button" className="btn btn-yellow" onClick={retryRecording} disabled={submitting}>Retry</button>
                    <button type="button" className="btn btn-blue" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </>
              )}

              {error && <p className="dashboard-error">{error}</p>}
            </div>
          )}

          <p className="dh-class-responses-label">CLASS RESPONSES</p>
          <div className="dh-class-responses">
            {visibleResponses.length === 0 && <p className="dashboard-muted">No responses yet.</p>}
            {visibleResponses.map((r) => (
              <AudioBar key={r.id} src={r.audio_url} label={r.student_id === myUserId ? 'You' : r.display_name} />
            ))}
          </div>
          {classResponses.length > visibleCount && (
            <button type="button" className="dh-load-more" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              •••
            </button>
          )}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}
