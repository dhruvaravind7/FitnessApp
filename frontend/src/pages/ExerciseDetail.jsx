import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Dumbbell, Flame, Lightbulb, LineChart, PlusCircle, Zap } from 'lucide-react'
import * as exercisesApi from '../api/exercises'
import * as statsApi from '../api/stats'
import { quickLog } from '../api/sessions'
import { errorMessage } from '../api/client'
import { useSession } from '../context/SessionContext'
import { useUnit } from '../context/UnitContext'
import { useToast } from '../context/ToastContext'
import { Modal, PageLoader, EmptyState } from '../components/ui'
import ProgressChart from '../components/charts/ProgressChart'
import { formatDate, titleCase, todayISO } from '../lib/format'
import { validateLog } from '../lib/validation'
import './ExerciseDetail.css'

export default function ExerciseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { active, addExercise } = useSession()
  const unit = useUnit()
  const toast = useToast()

  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null)
  const [tipsOpen, setTipsOpen] = useState(false)

  const [form, setForm] = useState({ sets: '3', reps: '10', weight: '', notes: '', date: todayISO() })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState('')
  const [nameModal, setNameModal] = useState(false)
  const [sessionName, setSessionName] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    exercisesApi.getExercise(id)
      .then((ex) => { if (!cancelled) setExercise(ex) })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, 'Exercise not found')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    statsApi.getProgress(id).then((p) => { if (!cancelled) setProgress(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [id])

  // Pre-fill from the user's last entry of this exercise.
  useEffect(() => {
    const last = progress?.points?.at(-1)
    if (!last) return
    setForm((f) => ({
      ...f,
      reps: String(last.max_reps || f.reps),
      weight: last.max_weight != null ? String(unit.display(last.max_weight)) : '',
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  const payload = useMemo(() => ({
    exerciseDetails: exercise,
    sets: Number(form.sets),
    reps: Number(form.reps),
    weight: form.weight === '' ? null : unit.toLbs(form.weight),
    notes: form.notes.trim() || null,
  }), [exercise, form, unit])

  function update(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }))
    }
  }

  function check() {
    const errs = validateLog(form)
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleAddToSession(name) {
    if (!check()) return
    setBusy('session')
    try {
      const { session } = await addExercise(payload, { sessionName: name })
      toast.success(`Added to ${session.name || 'your session'}`)
      setNameModal(false)
      navigate(`/sessions/${session.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  async function handleQuickLog() {
    if (!check()) return
    setBusy('quick')
    try {
      const s = await quickLog({ ...payload, date: form.date })
      toast.success('Workout logged!')
      navigate(`/sessions/${s.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="page"><PageLoader /></div>
  if (error || !exercise) {
    return (
      <div className="page">
        <EmptyState icon={Dumbbell} title="Exercise not found" action={<Link className="btn" to="/search">Back to library</Link>}>{error}</EmptyState>
      </div>
    )
  }

  const backTo = location.state?.from || '/search'

  return (
    <div className="page detail-page">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(backTo)}><ArrowLeft size={16} /> Back to library</button>

      <div className="detail-hero card">
        <div className="detail-media">
          {exercise.videoUrl ? (
            <video src={exercise.videoUrl} poster={exercise.imageUrl} autoPlay loop muted playsInline controls={false} />
          ) : exercise.imageUrl ? (
            <img src={exercise.imageUrl} alt={exercise.name} />
          ) : null}
        </div>
        <div className="detail-info">
          <div className="tag-row">
            {exercise.exerciseType && <span className="tag info">{titleCase(exercise.exerciseType)}</span>}
            {exercise.bodyParts.map((p) => <span key={p} className="tag">{titleCase(p)}</span>)}
            {exercise.equipments.map((e) => <span key={e} className="tag">{titleCase(e)}</span>)}
          </div>
          <h1>{exercise.name}</h1>
          {exercise.overview && <p className="text-2 overview">{exercise.overview}</p>}
          <div className="muscle-groups">
            <div>
              <p className="muscle-label">Target muscles</p>
              <div className="tag-row">{exercise.targetMuscles.map((m) => <span key={m} className="tag accent">{titleCase(m)}</span>)}</div>
            </div>
            {exercise.secondaryMuscles.length > 0 && (
              <div>
                <p className="muscle-label">Secondary</p>
                <div className="tag-row">{exercise.secondaryMuscles.map((m) => <span key={m} className="tag">{titleCase(m)}</span>)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="detail-body">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="card-title"><h2>Instructions</h2></div>
            {exercise.instructions.length === 0 ? <p className="muted">No instructions available.</p> : (
              <ol className="steps">
                {exercise.instructions.map((step, i) => (
                  <li key={i}><span className="step-num">{i + 1}</span><p>{step.replace(/^Step:\d+\s*/i, '')}</p></li>
                ))}
              </ol>
            )}
          </section>

          {exercise.exerciseTips?.length > 0 && (
            <section className="card">
              <button className="card-title collapsible" onClick={() => setTipsOpen((o) => !o)} aria-expanded={tipsOpen}>
                <h2 className="row" style={{ gap: 8 }}><Lightbulb size={18} /> Form tips</h2>
                <ChevronDown size={18} className={tipsOpen ? 'rot' : ''} />
              </button>
              {tipsOpen && <ul className="tips">{exercise.exerciseTips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            </section>
          )}

          <section className="card">
            <div className="card-title"><h2 className="row" style={{ gap: 8 }}><LineChart size={18} /> Your progress</h2>
              {progress?.best_weight != null && <span className="tag accent">Best {unit.weight(progress.best_weight)}</span>}
            </div>
            {!progress || progress.points.length === 0 ? (
              <p className="muted small">You haven&apos;t logged this exercise yet. Your first entry starts the chart.</p>
            ) : (
              <>
                <ProgressChart points={progress.points} />
                <div className="history-mini">
                  {progress.points.slice(-5).reverse().map((p) => (
                    <div key={p.session_id ?? p.date} className="history-mini-row">
                      <span className="muted">{formatDate(p.date, 'MMM d')}</span>
                      <span>{p.sets} sets · up to {p.max_reps} reps</span>
                      <span className="mono">{p.max_weight != null ? unit.weight(p.max_weight) : 'Bodyweight'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="log-panel card">
          <div className="card-title"><h2 className="row" style={{ gap: 8 }}><Dumbbell size={18} /> Log this exercise</h2></div>
          <div className="log-grid">
            <div className="field">
              <label htmlFor="sets">Sets</label>
              <input id="sets" type="number" inputMode="numeric" min="1" className={`input ${errors.sets ? 'invalid' : ''}`} value={form.sets} onChange={update('sets')} />
              {errors.sets && <span className="error-text">{errors.sets}</span>}
            </div>
            <div className="field">
              <label htmlFor="reps">Reps</label>
              <input id="reps" type="number" inputMode="numeric" min="1" className={`input ${errors.reps ? 'invalid' : ''}`} value={form.reps} onChange={update('reps')} />
              {errors.reps && <span className="error-text">{errors.reps}</span>}
            </div>
            <div className="field span-2">
              <label htmlFor="weight">Weight ({unit.unit})</label>
              <input id="weight" type="number" inputMode="decimal" min="0" step="any" className={`input ${errors.weight ? 'invalid' : ''}`} placeholder="Leave empty for bodyweight"
                value={form.weight} onChange={update('weight')} />
              {errors.weight ? <span className="error-text">{errors.weight}</span> : <span className="hint">Stored in lbs; shown in your unit.</span>}
            </div>
            <div className="field span-2">
              <label htmlFor="notes">Notes</label>
              <input id="notes" className="input" placeholder="Tempo, RPE, how it felt…" value={form.notes} onChange={update('notes')} maxLength={2000} />
            </div>
          </div>

          <div className="log-actions">
            {active ? (
              <button className="btn btn-primary btn-block" disabled={Boolean(busy)} onClick={() => handleAddToSession()}>
                <PlusCircle size={16} /> {busy === 'session' ? 'Adding…' : `Add to “${active.name || 'current session'}”`}
              </button>
            ) : (
              <button className="btn btn-primary btn-block" disabled={Boolean(busy)} onClick={() => { if (check()) setNameModal(true) }}>
                <Flame size={16} /> Start a session with this
              </button>
            )}
            <div className="quick-log">
              <div className="field">
                <label htmlFor="date">Quick log date</label>
                <input id="date" type="date" className="input" value={form.date} max={todayISO()} onChange={update('date')} />
              </div>
              <button className="btn btn-block" disabled={Boolean(busy)} onClick={handleQuickLog}>
                <Zap size={16} /> {busy === 'quick' ? 'Saving…' : 'Quick log as its own session'}
              </button>
            </div>
            <p className="hint muted small">Quick log saves a finished one-exercise session. Use a session to group several exercises.</p>
          </div>
        </aside>
      </div>

      <Modal open={nameModal} title="Start a session" onClose={() => setNameModal(false)}
        footer={(
          <>
            <button className="btn" onClick={() => setNameModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => handleAddToSession(sessionName.trim() || undefined)}>
              {busy ? 'Starting…' : 'Start & add exercise'}
            </button>
          </>
        )}>
        <div className="field">
          <label htmlFor="session-name">Session name <span className="muted">(optional)</span></label>
          <input id="session-name" className="input" placeholder="e.g. Push day, Leg day, Full body" value={sessionName}
            onChange={(e) => setSessionName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddToSession(sessionName.trim() || undefined)} autoFocus />
          <span className="hint">You can keep adding exercises from the library, then finish the session from the top bar.</span>
        </div>
      </Modal>
    </div>
  )
}
