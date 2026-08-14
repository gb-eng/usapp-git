import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      return
    }
    if (!data.user) {
      setError('Something went wrong logging in. Please try again.')
      return
    }

    // Route by the account's actual stored role, not a UI toggle --
    // profiles.role is server-set/immutable per the signup trigger, so
    // this is the real source of truth.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      setError('Could not load your account. Please try again.')
      return
    }

    // Confirmed auth account, but no profiles row yet -- happens when
    // email confirmation is on and signup couldn't finish writing the
    // profile. Send them to finish setup instead of a dead-end error.
    if (!profile) {
      navigate('/complete-profile')
      return
    }

    navigate(profile.role === 'teacher' ? '/teacher' : '/student')
  }

  return (
    <div>
      <Header showLogin={false} />
      <main className="login-main">
        <h1 className="login-logo">Usapp</h1>
        <div className="login-card">
          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="yourmail@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className="forgot-link"
              onClick={() => navigate('/forgot-password')}
            >
              Forgot password?
            </button>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="btn btn-blue btn-lg">Log In</button>
          </form>

          <p className="or-divider">or</p>

          <button
            type="button"
            className="btn btn-outline btn-lg"
            onClick={() => navigate('/guest')}
          >
            Continue as Guest
          </button>
          <p className="guest-note">Guest access is for students only</p>

          <p className="or-divider">or</p>
          <button
            type="button"
            className="btn btn-blue btn-lg"
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </button>
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}

