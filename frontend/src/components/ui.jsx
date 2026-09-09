/* Small shared building blocks. */
import { useEffect } from 'react'
import { X } from 'lucide-react'
import './ui.css'

export function Spinner({ size = 'md', label = 'Loading' }) {
  return <div className={`spinner ${size === 'lg' ? 'lg' : ''}`} role="status" aria-label={label} />
}

export function PageLoader() {
  return <div className="center" style={{ padding: '80px 0' }}><Spinner size="lg" /></div>
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty fade-in">
      {Icon && <span className="empty-icon"><Icon size={26} /></span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer, width = 480 }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal fade-in" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Delete', danger = true, onConfirm, onClose, busy }) {
  return (
    <Modal open={open} title={title} onClose={onClose} width={420}
      footer={(
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
        </>
      )}>
      <p className="text-2">{message}</p>
    </Modal>
  )
}

export function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`stat-card ${accent ? 'accent' : ''}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && <span className="stat-icon"><Icon size={16} /></span>}
      </div>
      <div className="stat-value mono">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Tag({ children, variant }) {
  return <span className={`tag ${variant || ''}`}>{children}</span>
}
