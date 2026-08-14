import './Modal.css'

interface SuccessModalProps {
  title: string
  message: string
  ctaLabel: string
  onClose: () => void
  onCta: () => void
}

export default function SuccessModal({ title, message, ctaLabel, onClose, onCta }: SuccessModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="modal-icon modal-icon-success" aria-hidden="true">✓</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" className="btn btn-blue btn-lg" onClick={onCta}>{ctaLabel}</button>
      </div>
    </div>
  )
}
