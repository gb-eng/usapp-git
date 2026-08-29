import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Login.css'

export default function CompleteProfile() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [registeredRole, setRegisteredRole] = useState<'student' | 'teacher' | null>(null)
  const [fullName, setFullName] = useState('')
  const [teacherCode, setTeacherCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function prefill() {
      const { data: { user } } = await supabase.auth.getUser()
      const meta = user?.user_metadata as { full_name?: string; role?: string } | undefined
      if (meta?.full_name) setFullName(meta.full_name)
      if (meta?.role === 'teacher' || meta?.role === 'student') {
        setRole(meta.role)
        setRegisteredRole(meta.role)
      }
    }
    prefill()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
      return
    }

    // Role is locked to whatever the user actually registered as (from auth
    // metadata), regardless of local toggle state — the toggle can't be used
    // to submit a different role than the one that was signed up for.
    const submitRole = registeredRole ?? role

    setSubmitting(true)

    if (submitRole === 'teacher') {
      const { error: rpcError } = await supabase.rpc('signup_as_teacher', {
        input_code: teacherCode.trim(),
        input_full_name: fullName,
      })
      if (rpcError) {
        setError(
          rpcError.message.toLowerCase().includes('code')
            ? 'Invalid teacher code. Check with your school admin.'
            : rpcError.message
        )
        setSubmitting(false)
        return
      }
    } else {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: user.id, role: 'student', full_name: fullName })

      if (profileError) {
        setError(profileError.message)
        setSubmitting(false)
        return
      }
    }

    navigate(submitRole === 'teacher' ? '/teacher' : '/student')
  }

  return (
    <div>
      <Header showLogin={false} />
      <main className="login-main">
        <h1 className="login-logo">Usapp</h1>
        <div className="login-card">
          <p style={{ marginBottom: 16 }}>
            Almost done — tell us a bit about your account to finish setting it up.
          </p>

          <div className="role-toggle">
            <button
              type="button"
              className={role === 'student' ? 'btn btn-blue' : 'btn btn-outline'}
              onClick={() => registeredRole === null && setRole('student')}
              disabled={registeredRole !== null && registeredRole !== 'student'}
              aria-disabled={registeredRole !== null && registeredRole !== 'student'}
            >
              Student
            </button>
            <button
              type="button"
              className={role === 'teacher' ? 'btn btn-blue' : 'btn btn-outline'}
              onClick={() => registeredRole === null && setRole('teacher')}
              disabled={registeredRole !== null && registeredRole !== 'teacher'}
              aria-disabled={registeredRole !== null && registeredRole !== 'teacher'}
            >
              Teacher
            </button>
          </div>
          {registeredRole && (
            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: -8, marginBottom: 16 }}>
              You signed up as a {registeredRole}. This can't be changed here.
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              placeholder="Juan Dela Cruz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
              {submitting ? 'Saving…' : 'Continue'}
            </button>
          </form>
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}
