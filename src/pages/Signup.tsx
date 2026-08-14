import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Login.css'

export default function SignUp() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [teacherCode, setTeacherCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)

    if (role === 'teacher') {
      const { data: valid, error: codeError } = await supabase.rpc('validate_teacher_code', {
        input_code: teacherCode.trim(),
      })
      if (codeError || !valid) {
        setError('Invalid teacher code. Check with your school admin.')
        setSubmitting(false)
        return
      }
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    if (!data.user) {
      setError('Something went wrong creating your account. Please try again.')
      setSubmitting(false)
      return
    }

    if (data.user.identities && data.user.identities.length === 0) {
      setError('An account with this email already exists. Try logging in instead.')
      setSubmitting(false)
      return
    }

    if (data.session) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, role, full_name: fullName })

      if (profileError) {
        setError(profileError.message)
        setSubmitting(false)
        return
      }

      navigate(role === 'teacher' ? '/teacher' : '/student')
      return
    }

    setNeedsEmailConfirm(true)
    setSubmitting(false)
  }

  return (
    <div>
      <Header showLogin={false} />
      <main className="login-main">
        <h1 className="login-logo">Usapp</h1>
        <div className="login-card">
          {needsEmailConfirm ? (
            <>
              <p>
                Check <strong>{email}</strong> for a confirmation link. Once confirmed,
                log in to finish setting up your account.
              </p>
              <button
                type="button"
                className="btn btn-blue btn-lg"
                onClick={() => navigate('/login')}
              >
                Go to Log In
              </button>
            </>
          ) : (
            <>
              <div className="role-toggle">
                <button
                  type="button"
                  className={role === 'student' ? 'btn btn-blue' : 'btn btn-outline'}
                  onClick={() => setRole('student')}
                >
                  Student
                </button>
                <button
                  type="button"
                  className={role === 'teacher' ? 'btn btn-blue' : 'btn btn-outline'}
                  onClick={() => setRole('teacher')}
                >
                  Teacher
                </button>
              </div>

              <form onSubmit={handleSignUp}>
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Juan Dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />

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

                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                {role === 'teacher' && (
                  <>
                    <label htmlFor="teacherCode">Teacher code</label>
                    <input
                      id="teacherCode"
                      type="text"
                      placeholder="Provided by your school"
                      value={teacherCode}
                      onChange={(e) => setTeacherCode(e.target.value)}
                      required
                    />
                  </>
                )}

                {error && <p className="login-error">{error}</p>}

                <button type="submit" className="btn btn-blue btn-lg" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Sign Up'}
                </button>
              </form>

              <p className="or-divider">or</p>
              <button
                type="button"
                className="btn btn-outline btn-lg"
                onClick={() => navigate('/login')}
              >
                Already have an account? Log In
              </button>
            </>
          )}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}