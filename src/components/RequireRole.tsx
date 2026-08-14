import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface RequireRoleProps {
  role: 'student' | 'teacher'
  children: React.ReactNode
}

// Wrap any role-specific page with this. Checks the account's real
// profiles.role (not a UI toggle, not the URL) and redirects to the
// correct dashboard if it doesn't match -- so a student can't land on
// /teacher (or vice versa) and see the wrong page's empty/broken state.
export default function RequireRole({ role, children }: RequireRoleProps) {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        navigate('/complete-profile')
        return
      }

      if (profile.role !== role) {
        navigate(profile.role === 'teacher' ? '/teacher' : '/student')
        return
      }

      setChecked(true)
    }
    check()
  }, [role, navigate])

  if (!checked) return null
  return <>{children}</>
}
