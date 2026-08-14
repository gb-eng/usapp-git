import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Login.css'

export default function CompleteProfile() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
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
      if (meta?.role === 'teacher' || meta?.role === 'student') setRole(meta.role)
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

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: user.id, role, full_name: fullName })

    if (profileError) {
      setError(profileError.message)
      setSubmitting(false)
      return
    }

    navigate(role === 'teacher' ? '/teacher' : '/student')
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