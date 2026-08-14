import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { GUEST_DEMO_LESSON_ID } from '../lib/guestConstants'
import './GuestDashboard.css'

const GUEST_ACTIVITIES = [
  {
    key: 'quiz',
    title: 'Quick Recall',
    description: 'Engage in a short quiz consisting of educational questions about code-switching.',
    route: `/lesson/${GUEST_DEMO_LESSON_ID}/quick-recall`,
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.5 2a3.5 3.5 0 0 0-3.5 3.5v.14A3.5 3.5 0 0 0 4 9v1a3 3 0 0 0 .4 1.5A3.5 3.5 0 0 0 4 15v.5A3.5 3.5 0 0 0 7.5 19H9a3 3 0 0 0 3-3V5.5A3.5 3.5 0 0 0 9.5 2Z" />
        <path d="M14.5 2a3.5 3.5 0 0 1 3.5 3.5v.14A3.5 3.5 0 0 1 20 9v1a3 3 0 0 1-.4 1.5A3.5 3.5 0 0 1 20 15v.5a3.5 3.5 0 0 1-3.5 3.5H15a3 3 0 0 1-3-3V5.5A3.5 3.5 0 0 1 14.5 2Z" />
      </svg>
    ),
  },
  {
    key: 'word-matching',
    title: 'Word Matching',
    description: 'Practice vocabulary through matching Filipino & English words, meanings, and examples.',
    route: `/lesson/${GUEST_DEMO_LESSON_ID}/word-matching`,
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h7v7H4z" />
        <path d="M6.5 6.5v2M5.2 8.5h2.6" />
        <path d="M13 20l3.5-9L20 20" />
        <path d="M14 17h5" />
      </svg>
    ),
  },
]

export default function GuestDashboard() {
  const navigate = useNavigate()

  return (
    <div>
      <Header showHelp showLogin={false} showLogout showMyProfile homeHref="/guest" />
      <main className="guest-main">
        <div className="guest-card">
          <div className="guest-card-header">
            <span className="guest-avatar" aria-hidden="true">👤</span>
            <h2>Guest</h2>
          </div>
          <div className="guest-signup-banner" role="status">
            <span aria-hidden="true">⚠️</span>{' '}
            You're browsing as a <strong>Guest</strong> — progress won't be saved.
          </div>
          <div className="guest-body">
            <p className="guest-intro">
              Practice your English skills through code-switching by engaging with these activities!
              <br />
              To access more activities, please{' '}
              <a href="/login">Log In</a> or <a href="/signup">Sign Up</a> as a student.
            </p>
            <div className="guest-activities">
              {GUEST_ACTIVITIES.map((activity) => (
                <button
                  key={activity.key}
                  type="button"
                  className="guest-activity-card"
                  onClick={() => navigate(activity.route)}
                >
                  <span className="guest-activity-icon">{activity.icon}</span>
                  <h3>{activity.title}</h3>
                  <p>{activity.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}