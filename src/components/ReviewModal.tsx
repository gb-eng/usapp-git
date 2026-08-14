import { useState } from 'react'
import './Modal.css'
import './ReviewModal.css'

type ReviewType = 'discussion' | 'opinion' | 'storytelling'

interface ReviewModalProps {
  type: ReviewType
  studentName: string
  studentInitials: string
  lessonTitle: string
  prompt: string
  // discussion
  audioUrl?: string
  // opinion
  responseText?: string
  // storytelling
  storyTitle?: string
  photoUrls?: string[]
  videoUrl?: string
  onClose: () => void
  onConfirm: (rating: 1 | 2 | 3, comment: string) => void
  loading?: boolean
}

const TYPE_LABEL: Record<ReviewType, string> = {
  discussion: 'Discussion Hub',
  opinion: 'Opinion Sharing',
  storytelling: 'Storytelling',
}

const RATINGS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: 'Needs Work' },
  { value: 2, label: 'Good' },
  { value: 3, label: 'Excellent' },
]

export default function ReviewModal({
  type,
  studentName,
  studentInitials,
  lessonTitle,
  prompt,
  audioUrl,
  responseText,
  storyTitle,
  photoUrls = [],
  videoUrl,
  onClose,
  onConfirm,
  loading = false,
}: ReviewModalProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null)
  const [comment, setComment] = useState('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="review-header">
          <span className="review-avatar" aria-hidden="true">{studentInitials}</span>
          <div>
            <h2>{studentName} — {TYPE_LABEL[type]}</h2>
            <p>{lessonTitle}</p>
          </div>
        </div>

        {type === 'storytelling' && storyTitle && (
          <div className="review-prompt-box">
            <p>"{storyTitle}"</p>
            {photoUrls.length > 0 && (
              <div className="review-photo-row">
                {photoUrls.map((url) => (
                  <img key={url} src={url} alt="" className="review-photo" />
                ))}
              </div>
            )}
          </div>
        )}

        {type !== 'storytelling' && (
          <div className="review-prompt-box">
            <p>"{prompt}"</p>
          </div>
        )}

        <label className="review-label">Student's response</label>

        {type === 'discussion' && (
          <div className="review-response-box review-audio-box">
            {audioUrl ? (
              <audio controls src={audioUrl} className="review-audio" />
            ) : (
              <p className="dashboard-muted">No audio submitted.</p>
            )}
          </div>
        )}

        {type === 'opinion' && (
          <div className="review-response-box">
            <p>{responseText || <span className="dashboard-muted">No response submitted.</span>}</p>
          </div>
        )}

        {type === 'storytelling' && (
          <div className="review-response-box review-drive-box">
            {videoUrl ? (
              <>
                <span className="review-drive-icon" aria-hidden="true">📁</span>
                <p>Video submitted via Google Drive</p>
                <a href={videoUrl} target="_blank" rel="noreferrer" className="btn btn-blue">
                  Open in Drive ↗
                </a>
              </>
            ) : (
              <p className="dashboard-muted">No video submitted.</p>
            )}
          </div>
        )}

        <label className="review-label">Comments (optional)</label>
        <textarea
          rows={3}
          placeholder="Note how well they used English/code-switching..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="review-rating-section">
          <p className="review-label review-rating-label">Rate this submission</p>
          <div className="review-rating-options">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                className={rating === r.value ? 'rating-btn rating-btn-active' : 'rating-btn'}
                onClick={() => setRating(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="review-confirm-row">
          <button
            type="button"
            className="btn btn-blue btn-lg"
            disabled={!rating || loading}
            onClick={() => rating && onConfirm(rating, comment)}
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
