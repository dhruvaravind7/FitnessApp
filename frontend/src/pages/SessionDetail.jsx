import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, Dumbbell, Pencil, Plus, Trash2, Weight } from 'lucide-react'
import * as sessionsApi from '../api/sessions'
import { errorMessage } from '../api/client'
import { useSession } from '../context/SessionContext'
import { useUnit } from '../context/UnitContext'
import { useToast } from '../context/ToastContext'
import { EntryRow } from '../components/SessionCard'
import { ConfirmDialog, EmptyState, PageLoader, StatCard } from '../components/ui'
import { EditEntryModal, EditSessionModal } from '../components/EditModals'
import { formatDate, formatDuration, pluralize, titleCase } from '../lib/format'
import './SessionDetail.css'

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const unit = useUnit()
  const { active, refresh, finish } = useSession()
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [editEntry, setEditEntry] = useState(null)
  const [editSession, setEditSession] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => sessionsApi.getSession(id).then(setSession).catch((e) => setError(errorMessage(e, 'Session not found'))), [id])
  useEffect(() => { load() }, [load, active?.exercise_count])

  const isActive = session && !session.ended_at

  async function handleFinish() {
    if (session.exercise_count === 0 && !window.confirm('This session has no exercises. Finish it anyway?')) return
    setBusy(true)
    try {
      await (active?.id === session.id ? finish() : sessionsApi.finishSession(session.id))
      toast.success('Session finished. Nice work!')
      await load(); refresh()
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  async function saveEntry(body) {
    setBusy(true)
    try { await sessionsApi.updateExercise(session.id, editEntry.id, body); setEditEntry(null); await load(); refresh(); toast.success('Entry updated') }
    catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  async function saveSession(body) {
    setBusy(true)
    try { setSession(await sessionsApi.updateSession(session.id, body)); setEditSession(false); refresh(); toast.success('Session updated') }
    catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  async function doDelete() {
    setBusy(true)
    try {
      if (confirm.type === 'session') {
        await sessionsApi.deleteSession(session.id); toast.success('Session deleted'); refresh(); navigate('/history')
      } else {
        await sessionsApi.deleteExercise(session.id, confirm.target.id); setConfirm(null); await load(); refresh(); toast.success('Entry removed')
      }
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  if (error) return <div className="page"><EmptyState icon={Dumbbell} title="Session not found" action={<Link className="btn" to="/history">Back to history</Link>}>{error}</EmptyState></div>
  if (!session) return <div className="page"><PageLoader /></div>

  const muscles = [...new Set(session.exercises.flatMap((e) => e.target_muscles || []))]

  return (
    <div className="page session-page">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(isActive ? '/' : '/history')}><ArrowLeft size={16} /> {isActive ? 'Dashboard' : 'History'}</button>

      <div className="page-header">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            {isActive ? <span className="tag accent">In progress</span> : <span className="tag">Completed</span>}
            <span className="muted small">{formatDate(session.date, 'EEEE, MMM d, yyyy')}</span>
          </div>
          <h1>{session.name || 'Workout'}</h1>
          {session.notes && <p className="subtitle">{session.notes}</p>}
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => setEditSession(true)}><Pencil size={15} /> Edit</button>
          <button className="btn btn-danger" onClick={() => setConfirm({ type: 'session' })}><Trash2 size={15} /> Delete</button>
          {isActive && (
            <>
              <Link className="btn" to="/search"><Plus size={15} /> Add exercise</Link>
              <button className="btn btn-primary" onClick={handleFinish} disabled={busy}><CheckCircle2 size={15} /> Finish session</button>
            </>
          )}
        </div>
      </div>

      <div className="session-stats">
        <StatCard label="Exercises" value={session.exercise_count} icon={Dumbbell} />
        <StatCard label="Volume" value={unit.volume(session.total_volume)} icon={Weight} />
        <StatCard label="Duration" value={formatDuration(session.started_at, session.ended_at) || (isActive ? '< 1 min' : 'Quick log')} sub={isActive ? 'and counting' : undefined} icon={Clock} />
        <StatCard label="Muscles hit" value={muscles.length} sub={muscles.slice(0, 2).map(titleCase).join(', ') || '–'} />
      </div>

      <section className="card">
        <div className="card-title"><h2>{pluralize(session.exercise_count, 'Exercise')}</h2></div>
        {session.exercises.length === 0 ? (
          <EmptyState icon={Dumbbell} title="Nothing logged yet" action={isActive ? <Link className="btn btn-primary" to="/search"><Plus size={15} /> Add your first exercise</Link> : null}>
            {isActive ? 'Pick an exercise from the library and add it to this session.' : 'This session has no exercises.'}
          </EmptyState>
        ) : (
          <div>
            {session.exercises.map((e) => <EntryRow key={e.id} entry={e} onEdit={setEditEntry} onDelete={(t) => setConfirm({ type: 'entry', target: t })} />)}
          </div>
        )}
      </section>

      <EditEntryModal key={`entry-${editEntry?.id ?? 'none'}`} entry={editEntry} onClose={() => setEditEntry(null)} onSave={saveEntry} busy={busy} />
      <EditSessionModal key={editSession ? `session-${session.id}` : 'session-none'} session={editSession ? session : null} onClose={() => setEditSession(false)} onSave={saveSession} busy={busy} />
      <ConfirmDialog open={Boolean(confirm)} busy={busy} onClose={() => setConfirm(null)} onConfirm={doDelete}
        title={confirm?.type === 'session' ? 'Delete this session?' : 'Remove this exercise?'}
        message={confirm?.type === 'session' ? 'The session and all its exercises will be permanently deleted.' : `${confirm?.target?.exercise_name} will be removed from the session.`} />
    </div>
  )
}
