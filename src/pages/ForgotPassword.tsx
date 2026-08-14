import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Login.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // redirectTo must be a URL your Supabase project's Auth settings
    // (Authentication -> URL Configuration -> Redirect URLs) allows.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div>
      <Header showLogin={false} />
      <main className="login-main">
        <h1 className="login-logo">Usapp</h1>
        <div className="login-card">
          {sent ? (
            <>
              <p>
                If an account exists for <strong>{email}</strong>, we've sent a password
                reset link. Check your inbox (and spam folder).
              </p>
              <button
                type="button"
                className="btn btn-outline btn-lg"
                onClick={() => navigate('/login')}
              >
                Back to Log In
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="yourmail@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="btn btn-blue btn-lg">
                Send reset link
              </button>
              <button
                type="button"
                className="forgot-link"
                onClick={() => navigate('/login')}
              >
                Back to Log In
              </button>
            </form>
          )}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}
