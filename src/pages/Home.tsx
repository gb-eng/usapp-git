import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, MessagesSquare, Puzzle, Clapperboard } from 'lucide-react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Home.css'

const features = [
  { Icon: Brain, tint: 'blue', title: 'Quick Recall', desc: "Engage in a short quiz after every lesson to check what you've learned." },
  { Icon: MessagesSquare, tint: 'red', title: 'Class Participation', desc: 'Share your voice or write your thoughts on class discussions.' },
  { Icon: Puzzle, tint: 'yellow', title: 'Word Matching', desc: 'Practice vocabulary through matching words, meanings, and examples.' },
  { Icon: Clapperboard, tint: 'blue', title: 'Storytelling', desc: 'Tell a story from a picture sequence and share it with your teacher.' },
]

export default function Home() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setChecking(false)
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile) {
        navigate(profile.role === 'teacher' ? '/teacher' : '/student')
        return
      }
      navigate('/complete-profile')
    }
    checkAuth()
  }, [navigate])

  if (checking) return null

  return (
    <div className="home-page">
      <div className="home-hero-glow" aria-hidden="true" />
      <Header />
      <main className="home-main">
        <h1 className="home-title">
          Practice English, with a little Filipino support along the way
        </h1>
        <p className="home-subtitle">
          Built for Grade 12 students to build confidence through code-switching.
        </p>
        <div className="home-cta">
          <Link to="/login" className="btn btn-blue btn-lg" style={{ width: 'auto', padding: '14px 32px' }}>Log In</Link>
          <Link to="/login?guest=true" className="btn btn-yellow btn-lg" style={{ width: 'auto', padding: '14px 32px' }}>Continue as Guest</Link>
        </div>
        <div className="home-features">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className={`feature-icon feature-icon-${f.tint}`} aria-hidden="true">
                <f.Icon size={24} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}