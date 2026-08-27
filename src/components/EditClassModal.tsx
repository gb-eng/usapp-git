import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ConfirmModal from './ConfirmModal'
import SuccessModal from './SuccessModal'
import './Modal.css'
import './EditClassModal.css'

type Lesson = { id: string; title: string; intro: string | null; body: string | null }
type ActivityPrompt = { id: string; title: string }
type StorySet = { id: string; title: string; photo_urls: string[] }

type Step = 'choose' | 'form' | 'success' | 'deleteConfirm' | 'deleteSuccess' | 'removeConfirm'

const REQUIRED_PHOTOS = 3
const MAX_PHOTO_MB = 5
const ALLOWED_TYPES = ['image/jpeg']

interface EditClassModalProps {
  classId: string
  className: string
  onClose: () => void
  onLessonsChanged: () => void
  onClassRemoved: () => void
}

export default function EditClassModal({
  classId,
  className,
  onClose,
  onLessonsChanged,
  onClassRemoved,
}: EditClassModalProps) {
  const [step, setStep] = useState<Step>('choose')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState<string>('new')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Topic form
  const [topicTitle, setTopicTitle] = useState('')
  const [topicContent, setTopicContent] = useState('')
  const [topicSaved, setTopicSaved] = useState(false)

  // Activity forms
  const [discussionTitle, setDiscussionTitle] = useState('')
  const [opinionTitle, setOpinionTitle] = useState('')
  const [storyTitle, setStoryTitle] = useState('')
  const [storyPhotos, setStoryPhotos] = useState<{ file: File; previewUrl: string }[]>([])
  const [storyFileError, setStoryFileError] = useState<string | null>(null)
  const [storySaved, setStorySaved] = useState(false)

  // Existing activities for the lesson being edited, so Add has visible proof
  const [existingDiscussionPrompts, setExistingDiscussionPrompts] = useState<ActivityPrompt[]>([])
  const [existingOpinionPrompts, setExistingOpinionPrompts] = useState<ActivityPrompt[]>([])
  const [existingStorySets, setExistingStorySets] = useState<StorySet[]>([])

  const [savingLessonId, setSavingLessonId] = useState<string | null>(null)

  const [generatingActivity, setGeneratingActivity] = useState<'quick_recall' | 'word_matching' | null>(null)
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const [hasQuickRecall, setHasQuickRecall] = useState(false)
  const [hasWordMatching, setHasWordMatching] = useState(false)

  type PendingRemoval = {
    kind: 'discussion' | 'opinion' | 'storytelling' | 'quick_recall' | 'word_matching'
    id: string
    label: string
  }
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    loadLessons()
  }, [classId])

  async function loadLessons() {
    const data = await refreshLessons()
    if (data.length > 0) setSelectedLessonId(data[0].id)
  }

  // Refetches `lessons` only -- unlike loadLessons(), this never touches
  // selectedLessonId. Called after creating a new lesson mid-session so
  // that lessons.length (used for the *next* new lesson's order_index)
  // stays accurate, without yanking the open form back to a different
  // lesson the way a full loadLessons() call would.
  async function refreshLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('id, title, intro, body')
      .eq('class_id', classId)
      .order('order_index')
    const fresh = data ?? []
    setLessons(fresh)
    return fresh
  }

  async function loadActivitiesForLesson(lessonId: string) {
    const [{ data: discussion }, { data: opinion }, { data: story }, { data: activitySets }] = await Promise.all([
      supabase.from('discussion_prompts').select('id, title').eq('lesson_id', lessonId),
      supabase.from('opinion_prompts').select('id, title').eq('lesson_id', lessonId),
      supabase.from('storytelling_sets').select('id, title, photo_urls').eq('lesson_id', lessonId),
      supabase.from('lesson_activity_sets').select('activity_type').eq('lesson_id', lessonId),
    ])
    setExistingDiscussionPrompts(discussion ?? [])
    setExistingOpinionPrompts(opinion ?? [])
    setExistingStorySets(story ?? [])
    setHasQuickRecall((activitySets ?? []).some((a) => a.activity_type === 'quick_recall'))
    setHasWordMatching((activitySets ?? []).some((a) => a.activity_type === 'word_matching'))
  }

  function openFormFor(lessonId: string) {
    if (lessonId === 'new') {
      setSelectedLessonId('new')
      setTopicTitle('')
      setTopicContent('')
      setSavingLessonId(null)
      setExistingDiscussionPrompts([])
      setExistingOpinionPrompts([])
      setExistingStorySets([])
      setHasQuickRecall(false)
      setHasWordMatching(false)
    } else {
      const lesson = lessons.find((l) => l.id === lessonId)
      setSelectedLessonId(lessonId)
      setTopicTitle(lesson?.title ?? '')
      setTopicContent(lesson?.body ?? '')
      setSavingLessonId(lessonId)
      loadActivitiesForLesson(lessonId)
    }
    setDiscussionTitle('')
    setOpinionTitle('')
    setStoryTitle('')
    setStoryPhotos([])
    setStoryFileError(null)
    setTopicSaved(false)
    setError(null)
    setStep('form')
  }

  async function ensureLessonSaved(): Promise<string | null> {
  if (!topicTitle.trim() || !topicContent.trim()) {
    setError('Topic Title and Topic Content are required.')
    return null
  }

  setLoading(true)
  setError(null)

  let lessonId = savingLessonId ?? (selectedLessonId !== 'new' ? selectedLessonId : null)

  if (lessonId) {
    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        title: topicTitle.trim(),
        body: topicContent.trim(),
      })
      .eq('id', lessonId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return null
    }

  } else {
    const { data, error: insertError } = await supabase
      .from('lessons')
      .insert({
        class_id: classId,
        title: topicTitle.trim(),
        body: topicContent.trim(),
        order_index: lessons.length,
      })
      .select('id')
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not create the lesson.')
      setLoading(false)
      return null
    }

    lessonId = data.id
    setSavingLessonId(data.id)
    await refreshLessons()
  }

  setLoading(false)
  setTopicSaved(true)

  return lessonId
}

  async function handleAddTopic() {
    const lessonId = await ensureLessonSaved()
    if (lessonId) {
      onLessonsChanged()
    }
  }

  async function handleAddDiscussionPrompt() {
    if (!discussionTitle.trim()) return
    const lessonId = await ensureLessonSaved()
    if (!lessonId) return
    const { data, error: insertError } = await supabase
      .from('discussion_prompts')
      .insert({ lesson_id: lessonId, title: discussionTitle.trim() })
      .select('id, title')
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    if (data) setExistingDiscussionPrompts((prev) => [...prev, data])
    setDiscussionTitle('')
    onLessonsChanged()
  }

  async function handleAddOpinionPrompt() {
    if (!opinionTitle.trim()) return
    const lessonId = await ensureLessonSaved()
    if (!lessonId) return
    const { data, error: insertError } = await supabase
      .from('opinion_prompts')
      .insert({ lesson_id: lessonId, title: opinionTitle.trim() })
      .select('id, title')
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    if (data) setExistingOpinionPrompts((prev) => [...prev, data])
    setOpinionTitle('')
    onLessonsChanged()
  }

  function handleStoryFileChange(fileList: FileList | null) {
  setStoryFileError(null)
  setStorySaved(false)

  if (!fileList || fileList.length === 0) return

  const incoming = Array.from(fileList)

  const badType = incoming.find((f) => !ALLOWED_TYPES.includes(f.type))
  if (badType) {
    setStoryFileError(
      `"${badType.name}" isn't a .jpeg file. Only .jpeg photos are allowed.`
    )
    return
  }

  const tooBig = incoming.find(
    (f) => f.size > MAX_PHOTO_MB * 1024 * 1024
  )

  if (tooBig) {
    setStoryFileError(
      `"${tooBig.name}" is ${(tooBig.size / (1024 * 1024)).toFixed(1)}MB — max is ${MAX_PHOTO_MB}MB.`
    )
    return
  }

  setStoryPhotos((prev) => {
    const existingKeys = new Set(
      prev.map((p) => `${p.file.name}-${p.file.size}`)
    )

    const deduped = incoming.filter(
      (f) => !existingKeys.has(`${f.name}-${f.size}`)
    )

    const newTotal = prev.length + deduped.length

    // Do not add anything if this selection would exceed 3 photos.
    if (newTotal > REQUIRED_PHOTOS) {
      setStoryFileError(
        `You can only upload ${REQUIRED_PHOTOS} photos. You currently have ${prev.length}.`
      )
      return prev
    }

    return [
      ...prev,
      ...deduped.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]
  })
}

  function removeStoryPhoto(index: number) {
    setStoryFileError(null)
    setStorySaved(false)
    setStoryPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleAddStorytellingSet() {
    if (!storyTitle.trim()) return
    if (storyPhotos.length !== REQUIRED_PHOTOS) {
      setStoryFileError(`Exactly ${REQUIRED_PHOTOS} photos are required — you currently have ${storyPhotos.length}.`)
      return
    }
    const lessonId = await ensureLessonSaved()
    if (!lessonId) return

    setLoading(true)
    const uploads = await Promise.all(
      storyPhotos.map(async ({ file }, i) => {
        const path = `${lessonId}/${Date.now()}-${i}-${file.name}`
        const { data, error: uploadError } = await supabase.storage
          .from('storytelling-photos')
          .upload(path, file)
        if (uploadError || !data) return null
        return supabase.storage.from('storytelling-photos').getPublicUrl(data.path).data.publicUrl
      })
    )
    const photoUrls = uploads.filter((u): u is string => Boolean(u))
    setLoading(false)

    if (photoUrls.length < REQUIRED_PHOTOS) {
      setStoryFileError(`Only ${photoUrls.length} of ${REQUIRED_PHOTOS} photos uploaded successfully. Please try again before adding.`)
      return
    }

    const { data, error: insertError } = await supabase
      .from('storytelling_sets')
      .insert({
        lesson_id: lessonId,
        title: storyTitle.trim(),
        photo_urls: photoUrls,
        pictures: photoUrls
      })
      .select('id, title, photo_urls, pictures')
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    if (data) setExistingStorySets((prev) => [...prev, data])
    storyPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setStoryTitle('')
    setStoryPhotos([])
    setStorySaved(true)
    onLessonsChanged()
  }

  async function generateActivitySet(activityType: 'quick_recall' | 'word_matching') {
  const lessonId = await ensureLessonSaved()
  if (!lessonId) return

  setGeneratingActivity(activityType)
  setGenerationMessage(null)
  setGenerationError(null)

  const table = activityType === 'quick_recall' ? 'quiz_bank' : 'word_bank'

const { data: bankItems, error: bankError } = await supabase
  .from(table)
  .select('id')
  .limit(100)

  if (bankError) {
    setGenerationError(bankError.message)
    setGeneratingActivity(null)
    return
  }

  if (!bankItems || bankItems.length < 10) {
    setGenerationError(
      `Not enough ${activityType === 'quick_recall' ? 'Quick Recall questions' : 'Word Matching words'} available for this lesson. At least 10 are required.`
    )
    setGeneratingActivity(null)
    return
  }

  function shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  const shuffled = shuffle(bankItems)
  const selectedIds = shuffled.slice(0, 10).map((item) => item.id)

  const { error: saveError } = await supabase
    .from('lesson_activity_sets')
    .upsert(
      {
        lesson_id: lessonId,
        activity_type: activityType,
        item_ids: selectedIds,
      },
      {
        onConflict: 'lesson_id,activity_type',
      }
    )

  if (saveError) {
    setGenerationError(saveError.message)
    setGeneratingActivity(null)
    return
  }

  setGenerationMessage(
    activityType === 'quick_recall'
      ? '✓ 10 Quick Recall questions generated for this lesson.'
      : '✓ 10 Word Matching words generated for this lesson.'
  )

  setGeneratingActivity(null)
  }

  function finishAndShowSuccess() {
    onLessonsChanged()
    setStep('success')
  }

  async function handleConfirmRemoval() {
    if (!pendingRemoval) return
    setRemoving(true)
    setError(null)

    const lessonId = savingLessonId ?? (selectedLessonId !== 'new' ? selectedLessonId : null)

    if (pendingRemoval.kind === 'discussion') {
      await supabase.from('discussion_responses').delete().eq('prompt_id', pendingRemoval.id)
      const { error: delError } = await supabase.from('discussion_prompts').delete().eq('id', pendingRemoval.id)
      if (delError) {
        setError(delError.message)
        setRemoving(false)
        return
      }
      setExistingDiscussionPrompts((prev) => prev.filter((p) => p.id !== pendingRemoval.id))
    } else if (pendingRemoval.kind === 'opinion') {
      await supabase.from('opinion_responses').delete().eq('prompt_id', pendingRemoval.id)
      const { error: delError } = await supabase.from('opinion_prompts').delete().eq('id', pendingRemoval.id)
      if (delError) {
        setError(delError.message)
        setRemoving(false)
        return
      }
      setExistingOpinionPrompts((prev) => prev.filter((p) => p.id !== pendingRemoval.id))
    } else if (pendingRemoval.kind === 'storytelling') {
      const set = existingStorySets.find((s) => s.id === pendingRemoval.id)
      await supabase.from('storytelling_submissions').delete().eq('storytelling_set_id', pendingRemoval.id)
      const { error: delError } = await supabase.from('storytelling_sets').delete().eq('id', pendingRemoval.id)
      if (delError) {
        setError(delError.message)
        setRemoving(false)
        return
      }
      // Best-effort storage cleanup -- don't block the removal on this failing.
      if (set?.photo_urls?.length) {
        const paths = set.photo_urls
          .map((url) => url.split('/storytelling-photos/')[1])
          .filter((p): p is string => Boolean(p))
        if (paths.length) {
          await supabase.storage.from('storytelling-photos').remove(paths)
        }
      }
      setExistingStorySets((prev) => prev.filter((s) => s.id !== pendingRemoval.id))
    } else if (pendingRemoval.kind === 'quick_recall' && lessonId) {
      await supabase.from('quiz_attempts').delete().eq('lesson_id', lessonId)
      const { error: delError } = await supabase
        .from('lesson_activity_sets')
        .delete()
        .eq('lesson_id', lessonId)
        .eq('activity_type', 'quick_recall')
      if (delError) {
        setError(delError.message)
        setRemoving(false)
        return
      }
      setHasQuickRecall(false)
    } else if (pendingRemoval.kind === 'word_matching' && lessonId) {
      await supabase.from('word_attempts').delete().eq('lesson_id', lessonId)
      const { error: delError } = await supabase
        .from('lesson_activity_sets')
        .delete()
        .eq('lesson_id', lessonId)
        .eq('activity_type', 'word_matching')
      if (delError) {
        setError(delError.message)
        setRemoving(false)
        return
      }
      setHasWordMatching(false)
    }

    setRemoving(false)
    setPendingRemoval(null)
    onLessonsChanged()
  }

  async function handleDeleteLesson() {
    if (selectedLessonId === 'new') return
    setLoading(true)
    const { error: deleteError } = await supabase.from('lessons').delete().eq('id', selectedLessonId)
    setLoading(false)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    onLessonsChanged()
    setStep('deleteSuccess')
  }

  async function handleRemoveClass() {
    setLoading(true)
    const { error: deleteError } = await supabase.from('classes').delete().eq('id', classId)
    setLoading(false)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    onClassRemoved()
  }

  if (pendingRemoval) {
    return (
      <ConfirmModal
        icon="🗑️"
        title={`Remove "${pendingRemoval.label}"?`}
        message="This deletes the activity and any student responses/scores tied to it. This can't be undone."
        confirmLabel="Remove"
        variant="red"
        loading={removing}
        onClose={() => setPendingRemoval(null)}
        onConfirm={handleConfirmRemoval}
      />
    )
  }

  if (step === 'removeConfirm') {
    return (
      <ConfirmModal
        icon="🗑️"
        title="Remove Class?"
        message="Removing the class will erase all progress."
        confirmLabel="Remove Class"
        variant="red"
        loading={loading}
        onClose={() => setStep('choose')}
        onConfirm={handleRemoveClass}
      />
    )
  }

  if (step === 'deleteConfirm') {
    return (
      <ConfirmModal
        icon="🗑️"
        title="Delete this lesson?"
        message="Deleting a lesson also removes its activities and any student progress on it."
        confirmLabel="Delete"
        variant="red"
        loading={loading}
        onClose={() => setStep('choose')}
        onConfirm={handleDeleteLesson}
      />
    )
  }

  if (step === 'deleteSuccess') {
    return (
      <SuccessModal
        title="Lesson deleted"
        message="The lesson and its activities have been removed."
        ctaLabel="Class Dashboard"
        onClose={onClose}
        onCta={onClose}
      />
    )
  }

  if (step === 'success') {
    return (
      <SuccessModal
        title="New Content added!"
        message="Check your edits in the dashboard."
        ctaLabel="Class Dashboard"
        onClose={onClose}
        onCta={onClose}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="edit-class-header">
          <span aria-hidden="true">✏️</span>
          <div>
            <h2>Edit Class</h2>
            <p>{className}</p>
          </div>
        </div>

        {step === 'choose' && (
          <div className="edit-class-panel">
            <h3>Choose a Lesson</h3>
            <p>Select a lesson from the dropdown selection to edit its content or delete it.</p>

            <select value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)}>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>

            <div className="edit-class-actions">
              <button
                type="button"
                className="btn btn-danger-light"
                disabled={lessons.length === 0}
                onClick={() => setStep('deleteConfirm')}
              >
                Delete
              </button>
              <button type="button" className="btn btn-blue" onClick={() => openFormFor(selectedLessonId)}>
                Edit
              </button>
            </div>

            <div className="edit-class-footer-actions">
              <button type="button" className="btn btn-blue btn-lg" onClick={() => openFormFor('new')}>
                + Add New Lesson
              </button>
              <button type="button" className="btn btn-danger-light btn-lg" onClick={() => setStep('removeConfirm')}>
                Remove Class
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="edit-class-panel">
            <h3>{savingLessonId ? 'Edit This Topic' : 'Create a Topic'}</h3>
            <p>Fill up the form below and press the Add button to create a new topic to the selected lesson.</p>
            {savingLessonId && !topicSaved && <p className="edit-class-existing-label">Editing existing topic — update the fields and click Add to save changes.</p>}

            <label>Topic Title *</label>
            <input
              type="text"
              placeholder="Lesson title here..."
              value={topicTitle}
              onChange={(e) => { setTopicTitle(e.target.value); setTopicSaved(false) }}
            />

            <label>Topic Content *</label>
            <textarea
              rows={4}
              placeholder="Lesson content here..."
              value={topicContent}
              onChange={(e) => { setTopicContent(e.target.value); setTopicSaved(false) }}
            />

            {error && <p className="dashboard-error">{error}</p>}
            {topicSaved && (
              <div className="edit-class-topic-saved">
                <p className="edit-class-success">✓ Topic saved. Editing this field again will UPDATE this same lesson.</p>
                <button type="button" className="btn btn-outline" onClick={() => openFormFor('new')}>
                  + This is a different lesson — start a new one
                </button>
              </div>
            )}

            <div className="edit-class-add-row">
              <button type="button" className="btn btn-add" disabled={loading} onClick={handleAddTopic}>Add</button>
            </div>

            <hr />

            <h3>Create Activities <span className="edit-class-optional">(optional)</span></h3>

            <label>Discussion Hub Prompt Title *</label>
            {existingDiscussionPrompts.length > 0 && (
              <>
                <p className="edit-class-existing-label">Existing Discussion Prompts</p>
                <ul className="edit-class-existing-list">
                  {existingDiscussionPrompts.map((p) => (
                    <li key={p.id} className="edit-class-staged-photo">
                      <span>✓ {p.title}</span>
                      <button
                        type="button"
                        className="edit-class-remove-photo"
                        onClick={() => setPendingRemoval({ kind: 'discussion', id: p.id, label: p.title })}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <textarea
              rows={2}
              placeholder='ex: "Do you think everyone should code-switch more?"'
              value={discussionTitle}
              onChange={(e) => setDiscussionTitle(e.target.value)}
            />
            <div className="edit-class-add-row">
              <button type="button" className="btn btn-add" disabled={loading} onClick={handleAddDiscussionPrompt}>Add</button>
            </div>

            <label>Opinion Sharing Prompt Title</label>
            {existingOpinionPrompts.length > 0 && (
              <>
                <p className="edit-class-existing-label">Existing Opinion Prompts</p>
                <ul className="edit-class-existing-list">
                  {existingOpinionPrompts.map((p) => (
                    <li key={p.id} className="edit-class-staged-photo">
                      <span>✓ {p.title}</span>
                      <button
                        type="button"
                        className="edit-class-remove-photo"
                        onClick={() => setPendingRemoval({ kind: 'opinion', id: p.id, label: p.title })}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <textarea
              rows={2}
              placeholder='ex: "What is your experience with code-switching?"'
              value={opinionTitle}
              onChange={(e) => setOpinionTitle(e.target.value)}
            />
            <div className="edit-class-add-row">
              <button type="button" className="btn btn-add" disabled={loading} onClick={handleAddOpinionPrompt}>Add</button>
            </div>

            <label>Storytelling Title</label>
            {existingStorySets.length > 0 && (
              <>
                <p className="edit-class-existing-label">Existing Storytelling Sets</p>
                <ul className="edit-class-existing-list">
                  {existingStorySets.map((s) => (
                    <li key={s.id} className="edit-class-staged-photo">
                      <span>✓ {s.title} ({s.photo_urls?.length ?? 0} photo{s.photo_urls?.length === 1 ? '' : 's'})</span>
                      <button
                        type="button"
                        className="edit-class-remove-photo"
                        onClick={() => setPendingRemoval({ kind: 'storytelling', id: s.id, label: s.title })}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <input
              type="text"
              placeholder="Storytelling Title"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
            />
            <label className="edit-class-file-label">
              Add exactly {REQUIRED_PHOTOS} photos (.jpeg, max {MAX_PHOTO_MB}MB each)
              <input
                type="file"
                accept="image/jpeg"
                multiple
                onChange={(e) => { handleStoryFileChange(e.target.files); e.target.value = '' }}
              />
            </label>
            {storyFileError && (
              <p className="story-file-error" role="alert">
                {storyFileError}
              </p>
            )}
            {storySaved && <p className="edit-class-success">✓ Storytelling set saved.</p>}
            {storyPhotos.length > 0 && (
              <div className="edit-class-photo-grid">
                {storyPhotos.map((p, i) => (
                  <div key={`${p.file.name}-${p.file.size}`} className="edit-class-photo-thumb">
                    <img src={p.previewUrl} alt={p.file.name} />
                  <span className="edit-class-photo-size">
                    {p.file.size < 1024 * 1024
                      ? `${(p.file.size / 1024).toFixed(1)}KB`
                      : `${(p.file.size / (1024 * 1024)).toFixed(1)}MB`}
                  </span>
                    <button type="button" onClick={() => removeStoryPhoto(i)} className="edit-class-remove-photo">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="edit-class-add-row">
            <button
              type="button"
              className="btn btn-add"
              disabled={loading}
              onClick={handleAddStorytellingSet}
            >
              Add
            </button>
            </div>

            <hr />

            <h3>Quick Recall & Word Matching</h3>
            <p>
              Generate 10 random items from the existing question banks for this lesson.
              The selected items will be saved for students to use.
            </p>

            {generationError && (
              <div className="edit-class-generation-error" role="alert">
                ⚠️ {generationError}
              </div>
            )}

            {generationMessage && (
              <div className="edit-class-generation-success">
                {generationMessage}
              </div>
            )}

            <div className="edit-class-generation-section">
              <h4>Quick Recall</h4>
              <p>
                Randomly select 10 questions from the existing Quick Recall question bank.
              </p>

              <button
                type="button"
                className="btn btn-add"
                disabled={loading || generatingActivity !== null}
                onClick={() => generateActivitySet('quick_recall')}
              >
                {generatingActivity === 'quick_recall'
                  ? 'Generating...'
                  : hasQuickRecall ? 'Regenerate Quick Recall' : 'Generate Quick Recall'}
              </button>
              {hasQuickRecall && (
                <button
                  type="button"
                  className="btn btn-danger-light btn-sm"
                  disabled={loading || generatingActivity !== null}
                  onClick={() => setPendingRemoval({ kind: 'quick_recall', id: selectedLessonId, label: 'Quick Recall' })}
                >
                  Remove Quick Recall
                </button>
              )}
            </div>

                <div className="edit-class-generation-section">
      <h4>Word Matching</h4>
      <p>
        Randomly select 10 words from the existing Word Matching question bank.
      </p>

      <button
        type="button"
        className="btn btn-add"
        disabled={loading || generatingActivity !== null}
        onClick={() => generateActivitySet('word_matching')}
      >
        {generatingActivity === 'word_matching'
          ? 'Generating...'
          : hasWordMatching ? 'Regenerate Word Matching' : 'Generate Word Matching'}
      </button>
      {hasWordMatching && (
        <button
          type="button"
          className="btn btn-danger-light btn-sm"
          disabled={loading || generatingActivity !== null}
          onClick={() => setPendingRemoval({ kind: 'word_matching', id: selectedLessonId, label: 'Word Matching' })}
        >
          Remove Word Matching
        </button>
      )}
    </div>

    {/* PUT IT HERE */}
    <div className="edit-class-footer-actions">
      <button
        type="button"
        className="btn btn-outline btn-lg"
        onClick={() => setStep('choose')}
      >
        Back
      </button>

      <button
        type="button"
        className="btn btn-blue btn-lg"
        onClick={finishAndShowSuccess}
      >
        Done
      </button>
    </div>
          </div>
        )}
      </div>
    </div>
  )
}