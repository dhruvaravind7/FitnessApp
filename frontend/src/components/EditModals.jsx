import { useState } from 'react'
import { Modal } from './ui'
import { useUnit } from '../context/UnitContext'
import { todayISO } from '../lib/format'
import { validateLog } from '../lib/validation'

/* These modals initialise their form state from props once, so parents must remount them
   with `key={entry?.id}` / `key={session?.id}` / `key={String(open)}` when the target changes. */

export function EditEntryModal({ entry, onClose, onSave, busy }) {
  const unit = useUnit()
  const [form, setForm] = useState(() => ({
    sets: entry ? String(entry.sets) : '', reps: entry ? String(entry.reps) : '',
    weight: entry?.weight != null ? String(unit.display(entry.weight)) : '', notes: entry?.notes || '',
  }))
  const [errors, setErrors] = useState({})

  function submit(e) {
    e?.preventDefault()
    const errs = validateLog(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({
      sets: Number(form.sets), reps: Number(form.reps), notes: form.notes.trim(),
      ...(form.weight === '' ? { clear_weight: true } : { weight: unit.toLbs(form.weight) }),
    })
  }

  return (
    <Modal open={Boolean(entry)} title={`Edit ${entry?.exercise_name || 'entry'}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      <form className="grid-2" onSubmit={submit}>
        <div className="field"><label htmlFor="edit-sets">Sets</label><input id="edit-sets" type="number" inputMode="numeric" min="1" className={`input ${errors.sets ? 'invalid' : ''}`} value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} />{errors.sets && <span className="error-text">{errors.sets}</span>}</div>
        <div className="field"><label htmlFor="edit-reps">Reps</label><input id="edit-reps" type="number" inputMode="numeric" min="1" className={`input ${errors.reps ? 'invalid' : ''}`} value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} />{errors.reps && <span className="error-text">{errors.reps}</span>}</div>
        <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="edit-weight">Weight ({unit.unit})</label><input id="edit-weight" type="number" inputMode="decimal" min="0" step="any" className={`input ${errors.weight ? 'invalid' : ''}`} placeholder="Empty = bodyweight" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />{errors.weight && <span className="error-text">{errors.weight}</span>}</div>
        <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor="edit-notes">Notes</label><input id="edit-notes" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export function EditSessionModal({ session, onClose, onSave, busy }) {
  const [form, setForm] = useState(() => ({ name: session?.name || '', date: session?.date || todayISO(), notes: session?.notes || '' }))

  function submit(e) {
    e?.preventDefault()
    onSave({ name: form.name.trim(), date: form.date, notes: form.notes.trim() })
  }

  return (
    <Modal open={Boolean(session)} title="Edit session" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="edit-name">Name</label><input id="edit-name" className="input" placeholder="e.g. Push day" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
        <div className="field"><label htmlFor="edit-date">Date</label><input id="edit-date" type="date" className="input" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} /><span className="hint">All exercises in the session move to this date.</span></div>
        <div className="field"><label htmlFor="edit-session-notes">Notes</label><textarea id="edit-session-notes" className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export function StartSessionModal({ open, onClose, onStart, busy }) {
  const [name, setName] = useState('')
  return (
    <Modal open={open} title="Start a session" onClose={onClose} width={420}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" onClick={() => onStart(name.trim())} disabled={busy}>{busy ? 'Starting…' : 'Start session'}</button></>}>
      <div className="field">
        <label htmlFor="start-name">Session name <span className="muted">(optional)</span></label>
        <input id="start-name" className="input" autoFocus placeholder="e.g. Push day, Leg day" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onStart(name.trim())} />
        <span className="hint">Then add exercises from the library. Finish it from the top bar when you&apos;re done.</span>
      </div>
    </Modal>
  )
}
