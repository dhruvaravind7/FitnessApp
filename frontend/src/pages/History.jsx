import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, History as HistoryIcon, X } from 'lucide-react'
import * as sessionsApi from '../api/sessions'
import { errorMessage } from '../api/client'
import { useSession } from '../context/SessionContext'
import { useUnit } from '../context/UnitContext'
import { useToast } from '../context/ToastContext'
import SessionCard from '../components/SessionCard'
import { ConfirmDialog, EmptyState, PageLoader } from '../components/ui'
import { EditEntryModal, EditSessionModal } from '../components/EditModals'
import { formatDate, pluralize } from '../lib/format'
import './History.css'

const PAGE = 30

function groupByMonth(sessions) {
  const groups = new Map()
  for (const s of sessions) {
    const key = s.date.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  return [...groups.entries()]
}

export default function History() {
  const toast = useToast()
  const unit = useUnit()
  const { active, refresh } = useSession()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [range, setRange] = useState({ from: '', to: '' })
  const [editEntry, setEditEntry] = useState(null)
  const [editSession, setEditSession] = useState(null)
  const [confirm, setConfirm] = useState(null) // {type:'session'|'entry', target}
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (offset = 0) => {
    const params = { limit: PAGE, offset }
    if (range.from) params.from = range.from
    if (range.to) params.to = range.to
    const data = await sessionsApi.listSessions(params)
    setHasMore(data.length === PAGE)
    return data
  }, [range])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load(0).then((d) => { if (!cancelled) setSessions(d) }).catch((e) => toast.error(errorMessage(e))).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, active?.id, active?.exercise_count])

  async function loadMore() {
    try {
      const more = await load(sessions.length)
      setSessions((s) => [...s, ...more])
    } catch (e) { toast.error(errorMessage(e)) }
  }

  const replaceSession = (updated) => setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)))

  async function saveEntry(body) {
    setBusy(true)
    try {
      await sessionsApi.updateExercise(editEntry.session_id, editEntry.id, body)
      replaceSession(await sessionsApi.getSession(editEntry.session_id))
      setEditEntry(null)
      toast.success('Entry updated')
      refresh()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  async function saveSession(body) {
    setBusy(true)
    try {
      replaceSession(await sessionsApi.updateSession(editSession.id, body))
      setEditSession(null)
      toast.success('Session updated')
      refresh()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  async function doDelete() {
    setBusy(true)
    try {
      if (confirm.type === 'session') {
        await sessionsApi.deleteSession(confirm.target.id)
        setSessions((list) => list.filter((s) => s.id !== confirm.target.id))
        toast.success('Session deleted')
      } else {
        await sessionsApi.deleteExercise(confirm.target.session_id, confirm.target.id)
        replaceSession(await sessionsApi.getSession(confirm.target.session_id))
        toast.success('Entry removed')
      }
      setConfirm(null)
      refresh()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  const totals = useMemo(() => ({
    sessions: sessions.length,
    volume: sessions.reduce((a, s) => a + (s.total_volume || 0), 0),
    entries: sessions.reduce((a, s) => a + (s.exercise_count || 0), 0),
  }), [sessions])
  const groups = useMemo(() => groupByMonth(sessions), [sessions])

  return (
    <div className="page history-page">
      <div className="page-header">
        <div>
          <h1>History</h1>
          <p className="subtitle">{loading ? 'Loading…' : `${pluralize(totals.sessions, 'session')} · ${pluralize(totals.entries, 'exercise')} · ${unit.volume(totals.volume)}${hasMore ? ' shown' : ''}`}</p>
        </div>
        <div className="range-picker">
          <CalendarRange size={16} className="muted" />
          <input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From date" />
          <span className="muted">to</span>
          <input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To date" />
          {(range.from || range.to) && <button className="btn btn-ghost btn-icon" onClick={() => setRange({ from: '', to: '' })} aria-label="Clear dates"><X size={16} /></button>}
        </div>
      </div>

      {loading ? <PageLoader /> : sessions.length === 0 ? (
        <EmptyState icon={HistoryIcon} title={range.from || range.to ? 'Nothing in this date range' : 'No workouts logged yet'}
          action={<Link className="btn btn-primary" to="/search">Find an exercise</Link>}>
          {range.from || range.to ? 'Try widening the range.' : 'Log your first exercise from the library and it will show up here.'}
        </EmptyState>
      ) : (
        <>
          {groups.map(([month, list]) => (
            <section key={month} className="month-group">
              <h2 className="month-title">{formatDate(`${month}-01`, 'MMMM yyyy')}<span className="muted small"> · {pluralize(list.length, 'session')}</span></h2>
              <div className="stack" style={{ gap: 10 }}>
                {list.map((s) => (
                  <SessionCard key={s.id} session={s}
                    onEditSession={setEditSession} onDeleteSession={(t) => setConfirm({ type: 'session', target: t })}
                    onEditEntry={setEditEntry} onDeleteEntry={(t) => setConfirm({ type: 'entry', target: t })} />
                ))}
              </div>
            </section>
          ))}
          {hasMore && <div className="center"><button className="btn" onClick={loadMore}>Load older sessions</button></div>}
        </>
      )}

      <EditEntryModal key={`entry-${editEntry?.id ?? 'none'}`} entry={editEntry} onClose={() => setEditEntry(null)} onSave={saveEntry} busy={busy} />
      <EditSessionModal key={`session-${editSession?.id ?? 'none'}`} session={editSession} onClose={() => setEditSession(null)} onSave={saveSession} busy={busy} />
      <ConfirmDialog open={Boolean(confirm)} busy={busy} onClose={() => setConfirm(null)} onConfirm={doDelete}
        title={confirm?.type === 'session' ? 'Delete this session?' : 'Remove this exercise?'}
        message={confirm?.type === 'session' ? `“${confirm.target.name || 'Workout'}” and its ${pluralize(confirm.target.exercise_count, 'exercise')} will be permanently deleted.` : `${confirm?.target?.exercise_name} will be removed from the session.`} />
    </div>
  )
}
