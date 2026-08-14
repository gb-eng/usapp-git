import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Login.css'

// Supabase's reset-password email link logs the user into a temporary
// session and redirects here. That session is enough to call updateUser
// directly -- no old password needed.
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
  }

  return (
    <div>
      <Header showLogin={false} />
      <main className="login-main">
        <h1 className="login-logo">Usapp</h1>
        <div className="login-card">
          {done ? (
            <>
              <p>Your password has been updated.</p>
              <button
                type="button"
                className="btn btn-blue btn-lg"
                onClick={() => navigate('/login')}
              >
                Log In
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <label htmlFor="confirm">Confirm new password</label>
              <input
                id="confirm"
                type="password"
                placeholder="••••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="btn btn-blue btn-lg">
                Update password
              </button>
            </form>
          )}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}
