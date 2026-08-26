import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, FileText, Brain, Puzzle, Clapperboard, MessagesSquare, MessageCircle } from 'lucide-react'
import Header from '../components/Header'
import EditClassModal from '../components/EditClassModal'
import ReviewModal from '../components/ReviewModal'
import { supabase } from '../lib/supabaseClient'
import { generateClassCode } from '../lib/classCode'
import '../styles/DashboardEmpty.css'
import './TeacherDashboard.css'

const STRAND_OPTIONS = [
  'Grade 12 - STEM',
  'Grade 12 - ABM',
  'Grade 12 - HUMSS',
  'Grade 12 - GAS',
  'Grade 12 - TVL',
]

type ClassRow = { id: string; grade_strand: string; section: string; class_code: string }
type Lesson = { id: string; title: string; intro: string | null; body: string | null; order_index: number }
type Profile = { full_name: string | null }
type WithProfile<T> = T & { profiles: Profile | null }

type QuizAttempt = WithProfile<{ id: string; lesson_id: string; student_id: string; score: number; answers: unknown[] }>
type WordAttempt = WithProfile<{ id: string; lesson_id: string; student_id: string; score: number; answers: unknown[] }>
type Prompt = { id: string; lesson_id: string; title: string }
type StorySet = { id: string; lesson_id: string; title: string; photo_urls: string[] }
type DiscussionResponse = WithProfile<{ id: string; lesson_id: string; prompt_id: string; student_id: string; rating: number | null; comment: string | null; audio_url: string | null }>
type OpinionResponse = WithProfile<{ id: string; lesson_id: string; prompt_id: string; student_id: string; rating: number | null; comment: string | null; content_text: string | null}>
type StorySubmission = WithProfile<{ id: string; lesson_id: string; storytelling_set_id: string; student_id: string; rating: number | null; comment: string | null; drive_link: string | null }>

type Tab = 'lessons' | 'reviews' | 'scores'

function abbreviate(fullName: string | null | undefined) {
  if (!fullName) return 'Student'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

function initialsOf(fullName: string | null | undefined) {
  if (!fullName) return '??'
  return fullName.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export default function TeacherDashboard() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [existingClass, setExistingClass] = useState<ClassRow | null>(null)
  const [createdClass, setCreatedClass] = useState<ClassRow | null>(null)
  const [teacherName, setTeacherName] = useState<string | null>(null)

  const [gradeStrand, setGradeStrand] = useState(STRAND_OPTIONS[0])
  const [section, setSection] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('lessons')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([])
  const [wordAttempts, setWordAttempts] = useState<WordAttempt[]>([])
  const [discussionPrompts, setDiscussionPrompts] = useState<Prompt[]>([])
  const [opinionPrompts, setOpinionPrompts] = useState<Prompt[]>([])
  const [storySets, setStorySets] = useState<StorySet[]>([])
  const [discussionResponses, setDiscussionResponses] = useState<DiscussionResponse[]>([])
  const [opinionResponses, setOpinionResponses] = useState<OpinionResponse[]>([])
  const [storySubmissions, setStorySubmissions] = useState<StorySubmission[]>([])
  const [classScores, setClassScores] = useState<{ student_id: string; display_name: string; points: number }[]>([])
  const [expandedScoreRow, setExpandedScoreRow] = useState<string | null>(null)
  const [scorePage, setScorePage] = useState(0)
  const [showClassCode, setShowClassCode] = useState(false)

  const [showEditClass, setShowEditClass] = useState(false)
  const [activeReview, setActiveReview] = useState<
    | { type: 'discussion'; item: DiscussionResponse; prompt: string; lessonTitle: string }
    | { type: 'opinion'; item: OpinionResponse; prompt: string; lessonTitle: string }
    | { type: 'storytelling'; item: StorySubmission; storySet: StorySet | undefined; lessonTitle: string }
    | null
  >(null)
  const [savingReview, setSavingReview] = useState(false)

  useEffect(() => {
    loadClass()
  }, [])

  async function loadClass() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
      return
    }

    const [{ data, error: fetchError }, { data: profileRow }] = await Promise.all([
      supabase.from('classes').select('id, grade_strand, section, class_code').eq('teacher_id', user.id).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ])

    setTeacherName(profileRow?.full_name ?? null)

    if (!fetchError && data) {
      setExistingClass(data)
      await loadDashboardData(data.id)
    }
    setLoading(false)
  }

  async function loadDashboardData(classId: string) {
    const { data: lessonRows } = await supabase
      .from('lessons')
      .select('id, title, intro, body, order_index')
      .eq('class_id', classId)
      .order('order_index')

    const lessonIds = (lessonRows ?? []).map((l) => l.id)
    setLessons(lessonRows ?? [])
    if (lessonIds.length === 0) return

    const [quizRes, wordRes, discPromptRes, opPromptRes, storySetRes, discRes, opRes, storyRes, scoresRes] = await Promise.all([
      supabase.from('quiz_attempts').select('id, lesson_id, student_id, score, answers, profiles(full_name)').in('lesson_id', lessonIds),
      supabase.from('word_attempts').select('id, lesson_id, student_id, score, answers, profiles(full_name)').in('lesson_id', lessonIds),
      supabase.from('discussion_prompts').select('id, lesson_id, title').in('lesson_id', lessonIds),
      supabase.from('opinion_prompts').select('id, lesson_id, title').in('lesson_id', lessonIds),
      supabase.from('storytelling_sets').select('id, lesson_id, title, photo_urls').in('lesson_id', lessonIds),
      supabase.from('discussion_responses').select('id, lesson_id, prompt_id, student_id, rating, comment, audio_url, profiles(full_name)').in('lesson_id', lessonIds),
      supabase.from('opinion_responses').select('id, lesson_id, prompt_id, student_id, rating, comment, content_text, profiles(full_name)').in('lesson_id', lessonIds),
      supabase.from('storytelling_submissions').select('id, lesson_id, storytelling_set_id, student_id, rating, comment, drive_link, profiles(full_name)').in('lesson_id', lessonIds),
      supabase.rpc('get_teacher_class_scores'),
    ])

    setQuizAttempts((quizRes.data as unknown as QuizAttempt[]) ?? [])
    setWordAttempts((wordRes.data as unknown as WordAttempt[]) ?? [])
    setDiscussionPrompts(discPromptRes.data ?? [])
    setOpinionPrompts(opPromptRes.data ?? [])
    setStorySets(storySetRes.data ?? [])
    setDiscussionResponses((discRes.data as unknown as DiscussionResponse[]) ?? [])
    setOpinionResponses((opRes.data as unknown as OpinionResponse[]) ?? [])
    setStorySubmissions((storyRes.data as unknown as StorySubmission[]) ?? [])
    setClassScores(scoresRes.data ?? [])
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!section.trim()) {
      setCreateError('Please enter a section name.')
      return
    }
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
      return
    }

    let inserted: ClassRow | null = null
    let attempt = 0
    while (attempt < 5 && !inserted) {
      const code = generateClassCode()
      const { data, error: insertError } = await supabase
        .from('classes')
        .insert({ teacher_id: user.id, grade_strand: gradeStrand, section: section.trim(), class_code: code })
        .select('id, grade_strand, section, class_code')
        .single()
      if (!insertError && data) inserted = data
      else if (insertError && insertError.code !== '23505') {
        setCreateError(insertError.message)
        break
      }
      attempt += 1
    }

    setCreating(false)
    if (inserted) setCreatedClass(inserted)
    else if (!createError) setCreateError('Could not generate a unique class code. Please try again.')
  }

  function openReview(kind: 'discussion' | 'opinion' | 'storytelling', item: any) {
    if (kind === 'discussion') {
      const prompt = discussionPrompts.find((p) => p.id === item.prompt_id)
      const lesson = lessons.find((l) => l.id === item.lesson_id)
      setActiveReview({ type: 'discussion', item, prompt: prompt?.title ?? '', lessonTitle: lesson?.title ?? '' })
    } else if (kind === 'opinion') {
      const prompt = opinionPrompts.find((p) => p.id === item.prompt_id)
      const lesson = lessons.find((l) => l.id === item.lesson_id)
      setActiveReview({ type: 'opinion', item, prompt: prompt?.title ?? '', lessonTitle: lesson?.title ?? '' })
    } else {
      const storySet = storySets.find((s) => s.id === item.storytelling_set_id)
      const lesson = lessons.find((l) => l.id === item.lesson_id)
      setActiveReview({ type: 'storytelling', item, storySet, lessonTitle: lesson?.title ?? '' })
    }
  }

  async function handleConfirmReview(rating: 1 | 2 | 3, comment: string) {
    if (!activeReview) return
    setSavingReview(true)
    const table =
      activeReview.type === 'discussion' ? 'discussion_responses' :
      activeReview.type === 'opinion' ? 'opinion_responses' : 'storytelling_submissions'

    const { error } = await supabase.from(table).update({ rating, comment, status: 'reviewed' }).eq('id', activeReview.item.id)
    setSavingReview(false)
    if (!error && existingClass) {
      setActiveReview(null)
      await loadDashboardData(existingClass.id)
    }
  }

  const activeClass = createdClass ?? existingClass

  const pendingDiscussion = discussionResponses.filter((r) => r.rating == null)
  const pendingOpinion = opinionResponses.filter((r) => r.rating == null)
  const pendingStorytelling = storySubmissions.filter((r) => r.rating == null)

  const scorePageEntries = classScores.slice(scorePage * 10, scorePage * 10 + 10)

  if (loading) {
    return (
      <div>
        <Header showLogin={false} showLogout />
        <main className="dashboard-empty"><p>Loading...</p></main>
      </div>
    )
  }

  if (createdClass) {
    return (
      <div>
        <Header showLogin={false} showLogout />
        <main className="dashboard-empty">
          <GraduationCap className="dashboard-empty-icon" size={48} aria-hidden="true" />
          <h1>Maligayang pagdating, teacher!</h1>
          <h2>No classes found.</h2>
          <p>Create one to start adding lessons and inviting students.</p>
          <div className="create-class-fields">
            <div className="field">
              <label>Grade & Strand</label>
              <div className="field-readonly">{createdClass.grade_strand}</div>
            </div>
            <div className="field">
              <label>Section</label>
              <div className="field-readonly">{createdClass.section}</div>
            </div>
          </div>
          <div className="class-code-box">
            <p>Your class code:</p>
            <p className="class-code">{createdClass.class_code}</p>
            <p>Share this with your students to join</p>
          </div>
          <button
            type="button"
            className="btn btn-blue btn-lg"
            onClick={() => { setExistingClass(createdClass); setCreatedClass(null) }}
          >
            Proceed to Class Dashboard
          </button>
        </main>
        <footer className="footer">© 2026 — Usapp</footer>
      </div>
    )
  }

  if (!activeClass) {
    return (
      <div>
        <Header showLogin={false} showLogout />
        <main className="dashboard-empty">
          <GraduationCap className="dashboard-empty-icon" size={48} aria-hidden="true" />
          <h1>Maligayang pagdating, teacher!</h1>
          <h2>No classes found.</h2>
          <p>Create one to start adding lessons and inviting students.</p>
          <form className="create-class-form" onSubmit={handleCreateClass}>
            <div className="create-class-fields">
              <div className="field">
                <label htmlFor="gradeStrand">Grade & Strand</label>
                <select id="gradeStrand" value={gradeStrand} onChange={(e) => setGradeStrand(e.target.value)}>
                  {STRAND_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="section">Section</label>
                <input id="section" type="text" placeholder="Section A" value={section} onChange={(e) => setSection(e.target.value)} />
              </div>
            </div>
            {createError && <p className="dashboard-error">{createError}</p>}
            <button type="submit" className="btn btn-blue btn-lg" disabled={creating}>
              {creating ? 'Creating...' : 'Create Class'}
            </button>
          </form>
        </main>
        <footer className="footer">© 2026 — Usapp</footer>
      </div>
    )
  }

  return (
    <div>
      <Header showLogin={false} showLogout showLeaderboards showMyProfile profileHref="/teacher" />
      <main className="teacher-dashboard">
        <div className="dashboard-header-card">
          <div className="ambient-glow dashboard-header-glow" aria-hidden="true" />
          <div className="dashboard-header-left">
            <span className="avatar-circle avatar-circle-blue" aria-hidden="true">{initialsOf(teacherName)}</span>
            <div>
              <h1>{teacherName ?? 'Teacher'}</h1>
              <p>{activeClass.grade_strand}</p>
              <p>Section {activeClass.section}</p>
            </div>
          </div>
          {showClassCode ? (
            <div className="class-code-box">
              <p>Class code</p>
              <p className="class-code">{activeClass.class_code}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowClassCode(false)}>Hide</button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => setShowClassCode(true)}>
              Show Class Code
            </button>
          )}
        </div>

        <div className="teacher-tab-row">
          <div className="tab-toggle">
            <button type="button" className={tab === 'lessons' ? 'tab-btn tab-btn-active-blue' : 'tab-btn'} onClick={() => setTab('lessons')}>Lessons</button>
            <button type="button" className={tab === 'reviews' ? 'tab-btn tab-btn-active-blue' : 'tab-btn'} onClick={() => setTab('reviews')}>
              Reviews {pendingDiscussion.length + pendingOpinion.length + pendingStorytelling.length > 0 && (
                <span className="tab-badge">{pendingDiscussion.length + pendingOpinion.length + pendingStorytelling.length}</span>
              )}
            </button>
            <button type="button" className={tab === 'scores' ? 'tab-btn tab-btn-active-blue' : 'tab-btn'} onClick={() => setTab('scores')}>Scores</button>
          </div>
        </div>

        {tab === 'lessons' && (
          <section>
            <div className="section-title-row">
              <h2 className="section-title">Class: {activeClass.grade_strand}</h2>
              <button type="button" className="btn btn-blue" onClick={() => setShowEditClass(true)}>Edit Class</button>
            </div>

            {lessons.length === 0 && <p className="dashboard-muted">No lessons yet — use Edit Class to add one.</p>}

            {lessons.map((lesson) => {
              const lessonQuiz = quizAttempts.filter((a) => a.lesson_id === lesson.id)
              const lessonWord = wordAttempts.filter((a) => a.lesson_id === lesson.id)
              const lessonStorySets = storySets.filter((s) => s.lesson_id === lesson.id)
              const lessonDiscPrompts = discussionPrompts.filter((p) => p.lesson_id === lesson.id)
              const lessonOpPrompts = opinionPrompts.filter((p) => p.lesson_id === lesson.id)

              return (
                <details key={lesson.id} className="lesson-row">
                  <summary><span>{lesson.title}</span><span className="chevron" aria-hidden="true">⌄</span></summary>
                  <div className="activity-list">
                    <details className="topic-row">
                      <summary>
                        <span className="teacher-summary-label"><FileText size={16} aria-hidden="true" /> {lesson.title}</span>
                        <span className="chevron" aria-hidden="true">⌄</span>
                      </summary>
                      <div className="topic-body">
                        <button
                          type="button"
                          className="teacher-more-link"
                          onClick={() => navigate(`/lesson/${lesson.id}`)}
                        >
                          View Lesson Page →
                        </button>
                        <StudentListActivity icon={<Brain size={16} aria-hidden="true" />} label="Quick Recall Quiz" attempts={lessonQuiz} />
                        <StudentListActivity icon={<Puzzle size={16} aria-hidden="true" />} label="Word Matching" attempts={lessonWord} />
                        {lessonStorySets.map((set) => (
                          <AggregateActivity
                            key={set.id}
                            icon={<Clapperboard size={16} aria-hidden="true" />}
                            label="Storytelling"
                            title={set.title}
                            totalStudents={classScores.length}
                            items={storySubmissions
                              .filter((s) => s.storytelling_set_id === set.id)
                              .map((s) => ({ id: s.id, display_name: abbreviate(s.profiles?.full_name), rating: s.rating }))}
                          />
                        ))}
                        {lessonDiscPrompts.map((p) => (
                          <AggregateActivity
                            key={p.id}
                            icon={<MessagesSquare size={16} aria-hidden="true" />}
                            label="Discussion Hub"
                            title={p.title}
                            totalStudents={classScores.length}
                            items={discussionResponses
                              .filter((r) => r.prompt_id === p.id)
                              .map((r) => ({ id: r.id, display_name: abbreviate(r.profiles?.full_name), rating: r.rating }))}
                          />
                        ))}
                        {lessonOpPrompts.map((p) => (
                          <AggregateActivity
                            key={p.id}
                            icon={<MessageCircle size={16} aria-hidden="true" />}
                            label="Opinion Sharing"
                            title={p.title}
                            totalStudents={classScores.length}
                            items={opinionResponses
                              .filter((r) => r.prompt_id === p.id)
                              .map((r) => ({ id: r.id, display_name: abbreviate(r.profiles?.full_name), rating: r.rating }))}
                          />
                        ))}
                      </div>
                    </details>
                  </div>
                </details>
              )
            })}
          </section>
        )}

        {tab === 'reviews' && (
          <section>
            <h2 className="section-title">Class: {activeClass.grade_strand}</h2>

            <ReviewGroup label="Storytelling" count={pendingStorytelling.length}>
              {storySets.map((set) => {
                const pending = pendingStorytelling.filter((s) => s.storytelling_set_id === set.id)
                if (pending.length === 0) return null
                return (
                  <details key={set.id} className="review-subgroup" open>
                    <summary>
                      <span className="teacher-summary-label"><Clapperboard size={16} aria-hidden="true" /> {set.title}</span>
                      <span className="chevron" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="review-subgroup-list">
                      {pending.map((s) => (
                        <div className="review-subgroup-row" key={s.id}>
                          <span>{abbreviate(s.profiles?.full_name)}</span>
                          <button type="button" onClick={() => openReview('storytelling', s)}>Review</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })}
            </ReviewGroup>

            <ReviewGroup label="Discussion Hub" count={pendingDiscussion.length}>
              {discussionPrompts.map((p) => {
                const pending = pendingDiscussion.filter((r) => r.prompt_id === p.id)
                if (pending.length === 0) return null
                return (
                  <details key={p.id} className="review-subgroup" open>
                    <summary>
                      <span className="teacher-summary-label"><MessagesSquare size={16} aria-hidden="true" /> "{p.title}"</span>
                      <span className="chevron" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="review-subgroup-list">
                      {pending.map((r) => (
                        <div className="review-subgroup-row" key={r.id}>
                          <span>{abbreviate(r.profiles?.full_name)}</span>
                          <button type="button" onClick={() => openReview('discussion', r)}>Review</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })}
            </ReviewGroup>

            <ReviewGroup label="Opinion Sharing" count={pendingOpinion.length}>
              {opinionPrompts.map((p) => {
                const pending = pendingOpinion.filter((r) => r.prompt_id === p.id)
                if (pending.length === 0) return null
                return (
                  <details key={p.id} className="review-subgroup" open>
                    <summary>
                      <span className="teacher-summary-label"><MessageCircle size={16} aria-hidden="true" /> "{p.title}"</span>
                      <span className="chevron" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="review-subgroup-list">
                      {pending.map((r) => (
                        <div className="review-subgroup-row" key={r.id}>
                          <span>{abbreviate(r.profiles?.full_name)}</span>
                          <button type="button" onClick={() => openReview('opinion', r)}>Review</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })}
            </ReviewGroup>
          </section>
        )}

        {tab === 'scores' && (
          <section>
            <h2 className="section-title">Class: {activeClass.grade_strand}</h2>
            {scorePageEntries.map((entry, i) => {
              const rank = scorePage * 10 + i + 1
              const studentQuiz = quizAttempts.filter((a) => a.student_id === entry.student_id)
              const studentWord = wordAttempts.filter((a) => a.student_id === entry.student_id)
              const studentDisc = discussionResponses.filter((r) => r.student_id === entry.student_id)
              const studentOp = opinionResponses.filter((r) => r.student_id === entry.student_id)
              const studentStory = storySubmissions.filter((r) => r.student_id === entry.student_id)
              const isOpen = expandedScoreRow === entry.student_id

              return (
                <div key={entry.student_id} className="score-row-teacher">
                  <button
                    type="button"
                    className="score-row-teacher-summary"
                    onClick={() => setExpandedScoreRow(isOpen ? null : entry.student_id)}
                  >
                    <span>{rank}. {entry.display_name}</span>
                    <span>{entry.points} pts <span className="chevron" aria-hidden="true">⌄</span></span>
                  </button>
                  {isOpen && (
                    <div className="score-row-teacher-detail">
                      <div><span>Quick Recall Quiz</span><span>{studentQuiz.length ? `${studentQuiz.length} attempted` : '—'}</span></div>
                      <div><span>Word Matching</span><span>{studentWord.length ? `${studentWord.length} attempted` : '—'}</span></div>
                      <div><span>Discussion Hub</span><span>{studentDisc.length}/{discussionPrompts.length} submitted</span></div>
                      <div><span>Opinion Sharing</span><span>{studentOp.length}/{opinionPrompts.length} submitted</span></div>
                      <div><span>Storytelling</span><span>{studentStory.length}/{storySets.length} submitted</span></div>
                    </div>
                  )}
                </div>
              )
            })}

            {classScores.length > 10 && (
              <div className="rank-pagination">
                <button type="button" onClick={() => setScorePage((p) => p - 1)} disabled={scorePage === 0}>‹</button>
                <span>Showing top {Math.min((scorePage + 1) * 10, classScores.length)} of {classScores.length} students</span>
                <button type="button" onClick={() => setScorePage((p) => p + 1)} disabled={(scorePage + 1) * 10 >= classScores.length}>›</button>
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="footer">© 2026 — Usapp</footer>

      {showEditClass && (
        <EditClassModal
          classId={activeClass.id}
          className="Introduction to Code-switching"
          onClose={() => setShowEditClass(false)}
          onLessonsChanged={() => loadDashboardData(activeClass.id)}
          onClassRemoved={() => { setShowEditClass(false); setExistingClass(null); setLessons([]) }}
        />
      )}

      {activeReview && activeReview.type === 'discussion' && (
        <ReviewModal
          type="discussion"
          studentName={abbreviate(activeReview.item.profiles?.full_name)}
          studentInitials={initialsOf(activeReview.item.profiles?.full_name)}
          lessonTitle={activeReview.lessonTitle}
          prompt={activeReview.prompt}
          audioUrl={activeReview.item.audio_url ?? undefined}
          onClose={() => setActiveReview(null)}
          onConfirm={handleConfirmReview}
          loading={savingReview}
        />
      )}
      {activeReview && activeReview.type === 'opinion' && (
        <ReviewModal
          type="opinion"
          studentName={abbreviate(activeReview.item.profiles?.full_name)}
          studentInitials={initialsOf(activeReview.item.profiles?.full_name)}
          lessonTitle={activeReview.lessonTitle}
          prompt={activeReview.prompt}
          responseText={activeReview.item.content_text ?? undefined}
          onClose={() => setActiveReview(null)}
          onConfirm={handleConfirmReview}
          loading={savingReview}
        />
      )}
      {activeReview && activeReview.type === 'storytelling' && (
        <ReviewModal
          type="storytelling"
          studentName={abbreviate(activeReview.item.profiles?.full_name)}
          studentInitials={initialsOf(activeReview.item.profiles?.full_name)}
          lessonTitle={activeReview.lessonTitle}
          prompt=""
          storyTitle={activeReview.storySet?.title}
          photoUrls={activeReview.storySet?.photo_urls ?? []}
          videoUrl={activeReview.item.drive_link ?? undefined}
          onClose={() => setActiveReview(null)}
          onConfirm={handleConfirmReview}
          loading={savingReview}
        />
      )}
    </div>
  )
}

function StudentListActivity({ icon, label, attempts }: { icon: React.ReactNode; label: string; attempts: (QuizAttempt | WordAttempt)[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? attempts : attempts.slice(0, 2)
  return (
    <details className="teacher-activity-row" open>
      <summary>
        <span className="teacher-summary-label">{icon} {label}</span>
        <span className="chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="teacher-activity-body">
        {attempts.length === 0 && <p className="dashboard-muted">No attempts yet.</p>}
        {visible.map((a) => (
          <div className="teacher-activity-student-row" key={a.id}>
            <span>{abbreviate(a.profiles?.full_name)}</span>
            <span>{a.score}/{a.answers.length}</span>
          </div>
        ))}
        {attempts.length > 2 && !expanded && (
          <button type="button" className="teacher-more-link" onClick={() => setExpanded(true)}>
            + {attempts.length - 2} more students
          </button>
        )}
      </div>
    </details>
  )
}

function AggregateActivity({
  icon,
  label,
  title,
  items,
  totalStudents,
}: {
  icon: React.ReactNode
  label: string
  title: string
  items: { id: string; display_name: string; rating: number | null }[]
  totalStudents: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 2)
  const ratingLabel: Record<number, string> = { 1: 'Needs Work', 2: 'Good', 3: 'Excellent' }
  return (
    <details className="teacher-activity-row" open>
      <summary>
        <span className="teacher-summary-label">{icon} {label}</span>
        <span className="chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="teacher-activity-body">
        <div className="teacher-activity-student-row">
          <span>"{title}"</span>
          <span>{items.length}/{totalStudents} submitted</span>
        </div>
        {items.length === 0 && <p className="dashboard-muted">No submissions yet.</p>}
        {visible.map((it) => (
          <div className="teacher-activity-student-row" key={it.id}>
            <span>{it.display_name}</span>
            <span>{it.rating != null ? ratingLabel[it.rating] : 'Pending'}</span>
          </div>
        ))}
        {items.length > 2 && !expanded && (
          <button type="button" className="teacher-more-link" onClick={() => setExpanded(true)}>
            + {items.length - 2} more students
          </button>
        )}
      </div>
    </details>
  )
}

function ReviewGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <details className="lesson-row" open={count > 0}>
      <summary>
        <span>{label}</span>
        {count > 0 ? <span className="tab-badge">{count}</span> : <span className="dashboard-muted">Nothing pending</span>}
      </summary>
      <div className="activity-list">{children}</div>
    </details>
  )
}
