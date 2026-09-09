import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import './Toast.css'

const ToastContext = createContext(null)
const ICONS = { success: CheckCircle2, error: TriangleAlert, info: Info }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++counter.current
    setToasts((t) => [...t.slice(-3), { id, message, type }])
    if (duration) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const value = useMemo(
    () => ({
      push,
      success: (m, d) => push(m, 'success', d),
      error: (m, d) => push(m, 'error', d ?? 5000),
      info: (m, d) => push(m, 'info', d),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={18} />
              <span>{t.message}</span>
              <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={14} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
