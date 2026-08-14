import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './Header.css'

interface HeaderProps {
  showHelp?: boolean
  showLogin?: boolean
  showLogout?: boolean
  showMyProfile?: boolean
  showLeaderboards?: boolean
  homeHref?: string
  profileHref?: string
}

export default function Header({
  showHelp = true,
  showLogin = true,
  showLogout = false,
  showMyProfile = false,
  showLeaderboards = false,
  homeHref = '/',
  profileHref = '/student',
}: HeaderProps) {
  <Link to={homeHref} className="header-logo"></Link>
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        <span className="header-logo-mark" aria-hidden="true">⌘</span>
        <h3>Usapp</h3>
      </Link>
      <nav className="header-nav">
        {showHelp && <Link to="/help">Help</Link>}
        {showLeaderboards && <Link to="/leaderboards">Leaderboards</Link>}
        {showMyProfile && <Link to={profileHref}>My Profile</Link>}
        {showLogin && (
          <Link to="/login" className="btn btn-blue btn-sm">Log In</Link>
        )}
        {showLogout && (
          <button type="button" className="btn btn-yellow btn-sm" onClick={handleLogout}>
            Log Out
          </button>
        )}
      </nav>
    </header>
  )
}
