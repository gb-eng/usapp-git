import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import helpIllustration from '../assets/help.png'
import './Help.css'

export default function Help() {
  const [session, setSession] = useState<{ loggedIn: boolean; profileHref: string }>({ loggedIn: false, profileHref: '/student' })

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setSession({ loggedIn: true, profileHref: profile?.role === 'teacher' ? '/teacher' : '/student' })
    }
    checkAuth()
  }, [])

  return (
    <div>
      <Header
        showHelp={false}
        showLogin={!session.loggedIn}
        showLogout={session.loggedIn}
        showLeaderboards={session.loggedIn}
        showMyProfile={session.loggedIn}
        profileHref={session.profileHref}
      />
      <main className="help-main">
        <section className="help-intro">
          <div>
            <h2>What is Usapp?</h2>
            <p>
              Welcome to Usapp! Usapp is an interactive learning platform designed to help you
              confidently navigate and master Taglish — the natural blending of Tagalog and English.
              Built like a gamified learning management system (LMS), Usapp breaks down code-switching
              rules through practical exercises, engaging challenges, and structured lessons.
            </p>
            <p>
              Whether you are aiming to speak more naturally in everyday conversations or improve your
              language flexibility, Usapp makes learning seamless, fun, and tailored to your pace.
            </p>
          </div>
          <img src={helpIllustration} alt="" className="help-illustration" />
        </section>

        <section>
          <h2>What is code-switching?</h2>
          <p>
            Code-switching is naturally mixing two languages, like English and Filipino, in the same
            conversation. It's how many Filipinos speak everyday.
          </p>
        </section>

        <section>
          <h2>How Usapp helps</h2>
          <p>
            Usapp uses a bit of Filipino alongside English in lessons and activities, such as short
            quizzes and storytelling prompts where students can record themselves using code-switching,
            making things easier to understand while building confidence to communicate mainly in English.
          </p>
        </section>
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}