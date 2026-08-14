import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Leaderboards.css'

type Entry = { display_name: string; points: number }
type Activity = 'quiz' | 'word'

const PAGE_SIZE = 10
const AVATAR_COLORS = ['var(--color-blue)', '#F5B942', '#E0729E', '#5DBB8E', '#9B7EDE']

export default function Leaderboards() {
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity>('quiz')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setLoading(true)
      const { data, error } = await supabase.rpc('get_class_leaderboard', { activity })
      if (error) {
        console.error('get_class_leaderboard failed:', error)
      }
      setEntries((data ?? []).sort((a: Entry, b: Entry) => b.points - a.points))
      setLoading(false)
      setPage(0)
    }
    load()
  }, [activity, navigate])

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)
  const pageStart = page * PAGE_SIZE
  const pageEntries = rest.slice(pageStart, pageStart + PAGE_SIZE)
  const hasPrev = page > 0
  const hasNext = pageStart + PAGE_SIZE < rest.length

  function initialsFor(name: string) {
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div>
      <Header showLogin={false} showLogout showLeaderboards showMyProfile />
      <main className="leaderboards-main">
        <h1 className="leaderboards-title">LEADERBOARDS</h1>

        <div className="leaderboard-tabs">
          <button
            type="button"
            className={activity === 'quiz' ? 'lb-tab lb-tab-active-blue' : 'lb-tab'}
            onClick={() => setActivity('quiz')}
          >
            Quick Recall
          </button>
          <button
            type="button"
            className={activity === 'word' ? 'lb-tab lb-tab-active-yellow' : 'lb-tab'}
            onClick={() => setActivity('word')}
          >
            Word Matching
          </button>
        </div>

        {loading && <p className="dashboard-muted">Loading...</p>}

        {!loading && (
          <>
            <div className="podium">
              {podium[1] && (
                <PodiumSpot rank={2} entry={podium[1]} initials={initialsFor(podium[1].display_name)} color={AVATAR_COLORS[1]} variant="silver" />
              )}
              {podium[0] && (
                <PodiumSpot rank={1} entry={podium[0]} initials={initialsFor(podium[0].display_name)} color={AVATAR_COLORS[0]} variant="gold" />
              )}
              {podium[2] && (
                <PodiumSpot rank={3} entry={podium[2]} initials={initialsFor(podium[2].display_name)} color={AVATAR_COLORS[2]} variant="bronze" />
              )}
            </div>

            <div className="rank-list">
              {pageEntries.map((entry, i) => (
                <details key={entry.display_name + i} className="rank-list-row">
                  <summary>
                    <span>{pageStart + i + 4}. {entry.display_name}</span>
                    <span className="rank-points">{entry.points} pts</span>
                  </summary>
                </details>
              ))}
            </div>

            {rest.length > PAGE_SIZE && (
              <div className="rank-pagination">
                <button type="button" onClick={() => setPage((p) => p - 1)} disabled={!hasPrev}>‹</button>
                <span>Showing top {Math.min(pageStart + PAGE_SIZE, rest.length) + 3} of {entries.length} students</span>
                <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!hasNext}>›</button>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="footer">© 2026 — Usapp</footer>
    </div>
  )
}

function PodiumSpot({
  entry,
  initials,
  color,
  variant,
}: {
  rank: number
  entry: Entry
  initials: string
  color: string
  variant: 'gold' | 'silver' | 'bronze'
}) {
  const medal = variant === 'gold' ? '🥇' : variant === 'silver' ? '🥈' : '🥉'
  return (
    <div className={`podium-spot podium-${variant}`}>
      <span className="podium-medal" aria-hidden="true">{medal}</span>
      <span className="podium-avatar" style={{ background: color }}>{initials}</span>
      <span className="podium-name">{entry.display_name}</span>
      <div className="podium-block">{entry.points}</div>
    </div>
  )
}
