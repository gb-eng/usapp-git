import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import './Leaderboards.css'

type Entry = { display_name: string; points: number }
type Activity = 'quiz' | 'word'
type ClassOption = { id: string; grade_strand: string; section: string }

const PAGE_SIZE = 10
const AVATAR_COLORS = ['var(--color-blue)', '#F5B942', '#E0729E', '#5DBB8E', '#9B7EDE']

export default function Leaderboards() {
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity>('quiz')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  // Role/class context — students always view their own active class (no
  // param needed, RPC falls back to it automatically). Teachers may own
  // multiple classes and need to pick which one's leaderboard to view.
  const [role, setRole] = useState<'student' | 'teacher' | null>(null)
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [activeClassId, setActiveClassId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role, active_teacher_class_id')
        .eq('id', user.id)
        .maybeSingle()
      if (!profileRow) return

      setRole(profileRow.role as 'student' | 'teacher')

      if (profileRow.role === 'teacher') {
        const { data: classRows } = await supabase
          .from('classes')
          .select('id, grade_strand, section')
          .eq('teacher_id', user.id)
          .order('created_at')
        const list = classRows ?? []
        setClasses(list)
        const initial =
          list.find((c) => c.id === (profileRow as { active_teacher_class_id?: string | null }).active_teacher_class_id)?.id
          ?? list[0]?.id
          ?? null
        setActiveClassId(initial)
        if (!initial) setLoading(false) // teacher has zero classes — nothing to load
      }
    }
    init()
  }, [navigate])

  useEffect(() => {
    if (role === null) return // still determining role
    if (role === 'teacher' && !activeClassId) return // no active class to load yet

    async function load() {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_class_leaderboard', {
        activity,
        ...(role === 'teacher' ? { target_class_id: activeClassId } : {}),
      })
      if (error) {
        console.error('get_class_leaderboard failed:', error)
      }
      setEntries((data ?? []).sort((a: Entry, b: Entry) => b.points - a.points))
      setLoading(false)
      setPage(0)
    }
    load()
  }, [activity, role, activeClassId])

  // Persists the switch the same way the dashboard switcher does, so
  // "active class" stays one consistent concept across the app rather than
  // this page silently diverging from what the dashboard shows.
  async function handleSwitchClass(classId: string) {
    if (classId === activeClassId) return
    setActiveClassId(classId)
    const { error } = await supabase.rpc('switch_active_teacher_class', { target_class_id: classId })
    if (error) console.error('switch_active_teacher_class (leaderboards) failed:', error)
  }

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

        {role === 'teacher' && classes.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            {classes.length > 1 ? (
              <select
                aria-label="Class"
                value={activeClassId ?? ''}
                onChange={(e) => handleSwitchClass(e.target.value)}
                style={{ maxWidth: 260 }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.grade_strand} — Section {c.section}</option>
                ))}
              </select>
            ) : (
              <p className="dashboard-muted">
                {classes[0].grade_strand} — Section {classes[0].section}
              </p>
            )}
          </div>
        )}

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

        {role === 'teacher' && classes.length === 0 && !loading && (
          <p className="dashboard-muted">No classes yet — create one from your dashboard first.</p>
        )}

        {loading && <p className="dashboard-muted">Loading...</p>}

        {!loading && !(role === 'teacher' && classes.length === 0) && (
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
      <div className="podium-block">{entry.points} pts</div>
    </div>
  )
}
