import type { LucideIcon } from 'lucide-react'
import './Modal.css'

interface ConfirmModalProps {
  icon: LucideIcon
  title: string
  message: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  /** 'red' for destructive actions (Remove Class), 'blue' for neutral ones (Leave Class). */
  variant?: 'blue' | 'red'
}

export default function ConfirmModal({
  icon: Icon,
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
  loading = false,
  variant = 'blue',
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <Icon size={40} className="modal-icon" aria-hidden="true" />
        <h2>{title}</h2>
        <p>{message}</p>
        <button
          type="button"
          className={variant === 'red' ? 'btn btn-leave btn-lg' : 'btn btn-blue btn-lg'}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Please wait...' : confirmLabel}
        </button>
      </div>
    </div>
  )
}
