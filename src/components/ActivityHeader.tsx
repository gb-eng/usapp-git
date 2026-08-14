import { Link } from 'react-router-dom'
import './ActivityHeader.css'

interface ActivityHeaderProps {
  unitLabel: string
  lessonTitle: string
  activityLabel: string
  backHref: string
  progress?: { current: number; total: number }
  onPrevious?: () => void
  showPrevious?: boolean
}

export default function ActivityHeader({
  unitLabel,
  lessonTitle,
  activityLabel,
  backHref,
  progress,
  onPrevious,
  showPrevious = false,
}: ActivityHeaderProps) {
  return (
    <div className="activity-header-card">
      <div className="activity-header-top">
        <div>
          <p className="activity-eyebrow">{unitLabel}</p>
          <h1>{lessonTitle}</h1>
          <Link to={backHref} className="activity-back">← Go back to lesson</Link>
        </div>
        <span className="activity-label">{activityLabel}</span>
      </div>

      {progress && (
        <div className="activity-progress-row">
          {showPrevious ? (
            <button type="button" className="activity-prev" onClick={onPrevious}>← Previous question</button>
          ) : <span />}
          <span className="activity-progress-count">Question {progress.current} of {progress.total}</span>
        </div>
      )}
      {progress && (
        <div className="activity-progress-bar">
          <div className="activity-progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
        </div>
      )}
    </div>
  )
}
