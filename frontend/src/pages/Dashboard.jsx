import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, CalendarCheck, Flame, MessageSquareHeart, Play, Search, Trophy, Weight } from 'lucide-react'
import * as statsApi from '../api/stats'
import * as sessionsApi from '../api/sessions'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useSession } from '../context/SessionContext'
import { useUnit } from '../context/UnitContext'
import { useToast } from '../context/ToastContext'
import { EmptyState, PageLoader, StatCard } from '../components/ui'
import SessionCard from '../components/SessionCard'
import VolumeChart from '../components/charts/VolumeChart'
import MuscleBreakdown from '../components/charts/MuscleBreakdown'
import { StartSessionModal } from '../components/EditModals'
import { compactNumber, friendlyDate, titleCase } from '../lib/format'
import './Dashboard.css'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night session' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const { active, start } = useSession()
  const unit = useUnit()
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [startOpen, setStartOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([statsApi.getOverview(), statsApi.getMuscles(30), sessionsApi.listSessions({ limit: 5 }), statsApi.getRecentExercises(6), statsApi.getRecords()])
      .then(([overview, muscles, sessions, recent, records]) => { if (!cancelled) setData({ overview, muscles, sessions: sessions.filter((s) => s.ended_at), recent, records }) })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)) })
    return () => { cancelled = true }
  }, [active?.id])

  async function handleStart(name) {
    setBusy(true)
    try {
      const s = await start(name ? { name } : {})
      setStartOpen(false)
      toast.success('Session started. Add exercises from the library.')
      navigate('/search', { state: { sessionId: s.id } })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data) return <div className="page"><PageLoader /></div>

  const { overview: o, muscles, sessions, recent, records } = data
  const isNew = o.total_sessions === 0 && !active

  return (
    <div className="page dashboard">
      <div className="page-header">
        <div>
          <p className="muted">{greeting()},</p>
          <h1>{user?.username}</h1>
        </div>
        <div className="row">
          {active ? (
            <Link className="btn btn-primary" to={`/sessions/${active.id}`}><Flame size={16} /> Continue “{active.name || 'session'}”</Link>
          ) : (
            <button className="btn btn-primary" onClick={() => setStartOpen(true)}><Play size={16} /> Start a session</button>
          )}
          <Link className="btn" to="/search"><Search size={16} /> Library</Link>
        </div>
      </div>

      {isNew ? (
        <EmptyState icon={Activity} title="Your training log is empty"
          action={<div className="row" style={{ justifyContent: 'center' }}><button className="btn btn-primary" onClick={() => setStartOpen(true)}><Play size={16} /> Start your first session</button><Link className="btn" to="/search">Browse exercises</Link></div>}>
          Start a session and add exercises from the library, or open any exercise and quick-log it. Your stats appear here as you go.
        </EmptyState>
      ) : (
        <>
          <div className="stats-grid">
            <StatCard label="This week" value={o.sessions_this_week} sub={`${o.sessions_this_month} this month`} icon={CalendarCheck} accent />
            <StatCard label="Volume this month" value={`${compactNumber(unit.display(o.volume_this_month, 0))} ${unit.unit}`} sub={`${compactNumber(unit.display(o.volume_this_week, 0))} ${unit.unit} this week`} icon={Weight} />
            <StatCard label="Streak" value={`${o.current_streak} day${o.current_streak === 1 ? '' : 's'}`} sub={`${o.training_days_last_30} training days in 30`} icon={Flame} />
            <StatCard label="Last workout" value={o.last_session ? friendlyDate(o.last_session.date) : '–'} sub={o.last_session ? `${o.last_session.name || 'Workout'} · ${o.last_session.exercise_count} exercises` : 'No sessions yet'} icon={Trophy} />
          </div>

          {/* Two independent columns, so a short card never leaves a gap under it. Below 1100px the
              columns dissolve (display: contents) and `order` restores the reading order. */}
          <div className="dash-cols">
            <div className="dash-col">
              <section className="card dash-volume">
                <div className="card-title"><h2>Weekly volume</h2><span className="muted small">last 8 weeks · {unit.unit}</span></div>
                <VolumeChart weeks={o.weekly_volume} />
              </section>
              <section className="card dash-recent">
                <div className="card-title"><h2>Recent sessions</h2><Link to="/history" className="btn btn-ghost btn-sm">All history <ArrowRight size={14} /></Link></div>
                <div className="stack" style={{ gap: 10 }}>
                  {sessions.length === 0 ? <p className="muted small">No finished sessions yet.</p> : sessions.map((s) => <SessionCard key={s.id} session={s} />)}
                </div>
              </section>
            </div>
            <div className="dash-col">
              <section className="card dash-muscles">
                <div className="card-title"><h2>Muscle balance</h2><span className="muted small">sets · 30 days</span></div>
                <MuscleBreakdown items={muscles.target_muscles} />
              </section>
              <section className="card dash-records">
                <div className="card-title"><h2>Personal records</h2></div>
                {records.length === 0 ? <p className="muted small">Records appear once you log weighted exercises.</p> : (
                  <div className="records">
                    {records.filter((r) => r.best_weight != null).slice(0, 5).map((r) => (
                      <Link key={r.exercise_id} to={`/exercise/${r.exercise_id}`} className="record-row">
                        <span className="record-name">{r.exercise_name}</span>
                        <span className="mono">{unit.weight(r.best_weight)} × {r.best_weight_reps}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
              <section className="card dash-again">
                <div className="card-title"><h2>Log again</h2></div>
                {recent.length === 0 ? <p className="muted small">Recently logged exercises show up here for quick access.</p> : (
                  <div className="tag-row">
                    {recent.map((r) => <Link key={r.exercise_id} to={`/exercise/${r.exercise_id}`} className="tag chip-link">{r.exercise_name}</Link>)}
                  </div>
                )}
              </section>
              <Link to="/coach" className="coach-cta card dash-coach">
                <MessageSquareHeart size={22} />
                <div>
                  <strong>Ask your coach</strong>
                  <p className="muted small">“What should I train today?” It reads your actual log{muscles.target_muscles[0] ? `, e.g. your ${titleCase(muscles.target_muscles[0].name).toLowerCase()} work` : ''}.</p>
                </div>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </>
      )}

      <StartSessionModal key={String(startOpen)} open={startOpen} onClose={() => setStartOpen(false)} onStart={handleStart} busy={busy} />
    </div>
  )
}
