import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useUnit } from '../context/UnitContext'
import { friendlyDate, formatDuration, pluralize, titleCase } from '../lib/format'
import './SessionCard.css'

/** One exercise entry row (used in session cards and the session detail page). */
export function EntryRow({ entry, onEdit, onDelete, showImage = true }) {
  const unit = useUnit()
  return (
    <div className="entry-row">
      {showImage && (
        <Link to={`/exercise/${entry.exercise_id}`} className="entry-thumb">
          {entry.image_url ? <img src={entry.image_url} alt="" loading="lazy" /> : <span />}
        </Link>
      )}
      <div className="entry-main">
        <Link to={`/exercise/${entry.exercise_id}`} className="entry-name">{entry.exercise_name}</Link>
        <div className="entry-meta">
          <span className="mono">{entry.sets} × {entry.reps}</span>
          <span className="dot" />
          <span className="mono">{unit.weight(entry.weight)}</span>
          {entry.target_muscles?.[0] && <><span className="dot" /><span className="muted">{titleCase(entry.target_muscles[0])}</span></>}
        </div>
        {entry.notes && <p className="entry-notes">“{entry.notes}”</p>}
      </div>
      {(onEdit || onDelete) && (
        <div className="entry-actions">
          {onEdit && <button className="btn btn-ghost btn-icon" onClick={() => onEdit(entry)} aria-label="Edit entry"><Pencil size={15} /></button>}
          {onDelete && <button className="btn btn-ghost btn-icon danger" onClick={() => onDelete(entry)} aria-label="Delete entry"><Trash2 size={15} /></button>}
        </div>
      )}
    </div>
  )
}

export default function SessionCard({ session, defaultOpen = false, onEditSession, onDeleteSession, onEditEntry, onDeleteEntry }) {
  const [open, setOpen] = useState(defaultOpen)
  const unit = useUnit()
  const isActive = !session.ended_at
  return (
    <article className={`session-card card tight ${isActive ? 'active' : ''}`}>
      <div className="session-head">
        <button className="session-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ChevronDown size={18} className={open ? 'rot' : ''} />
        </button>
        <div className="session-title">
          <Link to={`/sessions/${session.id}`} className="session-name">{session.name || 'Workout'}</Link>
          <div className="session-meta muted small">
            <span>{friendlyDate(session.date)}</span>
            <span className="dot" />
            <span>{pluralize(session.exercise_count, 'exercise')}</span>
            {session.total_volume > 0 && <><span className="dot" /><span className="mono">{unit.volume(session.total_volume)}</span></>}
            {session.ended_at && formatDuration(session.started_at, session.ended_at) && <><span className="dot" /><span>{formatDuration(session.started_at, session.ended_at)}</span></>}
            {isActive && <span className="tag accent">In progress</span>}
          </div>
        </div>
        <div className="entry-actions">
          {onEditSession && <button className="btn btn-ghost btn-icon" onClick={() => onEditSession(session)} aria-label="Edit session"><Pencil size={15} /></button>}
          {onDeleteSession && <button className="btn btn-ghost btn-icon danger" onClick={() => onDeleteSession(session)} aria-label="Delete session"><Trash2 size={15} /></button>}
        </div>
      </div>
      {open && (
        <div className="session-body fade-in">
          {session.exercises.length === 0 ? <p className="muted small" style={{ padding: '4px 0 8px' }}>No exercises in this session.</p>
            : session.exercises.map((e) => <EntryRow key={e.id} entry={e} onEdit={onEditEntry} onDelete={onDeleteEntry} />)}
        </div>
      )}
    </article>
  )
}
