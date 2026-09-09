import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Flame, Plus } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../api/client'
import { formatDuration, pluralize } from '../lib/format'
import './ActiveSessionBar.css'

export default function ActiveSessionBar() {
  const { active, finish } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [, tick] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [active])

  if (!active) return null

  async function handleFinish() {
    if (active.exercise_count === 0 && !window.confirm('This session has no exercises. Finish it anyway?')) return
    setBusy(true)
    try {
      const s = await finish()
      toast.success('Session finished. Nice work!')
      navigate(`/sessions/${s.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="active-bar fade-in">
      <Link to={`/sessions/${active.id}`} className="active-bar-info">
        <span className="pulse"><Flame size={16} /></span>
        <span className="active-bar-name">{active.name || 'Workout in progress'}</span>
        <span className="active-bar-meta">
          {pluralize(active.exercise_count, 'exercise')} · {formatDuration(active.started_at)}
        </span>
      </Link>
      <div className="active-bar-actions">
        <button className="btn btn-sm" onClick={() => navigate('/search')}><Plus size={14} /> Add exercise</button>
        <button className="btn btn-sm btn-primary" onClick={handleFinish} disabled={busy}><CheckCircle2 size={14} /> Finish</button>
      </div>
    </div>
  )
}
