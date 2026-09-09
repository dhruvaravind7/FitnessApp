import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as sessionsApi from '../api/sessions'
import { useAuth } from './AuthContext'

const SessionContext = createContext(null)

/** Tracks the user's single active (unfinished) workout session. */
export function SessionProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) { setActive(null); return null }
    setLoading(true)
    try {
      const s = await sessionsApi.getActiveSession()
      setActive(s)
      return s
    } catch {
      return active
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  useEffect(() => { refresh() }, [refresh])

  const start = useCallback(async (body = {}) => {
    const s = await sessionsApi.startSession(body)
    setActive(s)
    return s
  }, [])

  /** Add an exercise to the active session, starting one first when needed. */
  const addExercise = useCallback(async (entry, { sessionName } = {}) => {
    let s = active
    if (!s) s = await sessionsApi.startSession(sessionName ? { name: sessionName } : {})
    const added = await sessionsApi.addExercise(s.id, entry)
    const fresh = await sessionsApi.getSession(s.id)
    setActive(fresh)
    return { session: fresh, entry: added }
  }, [active])

  const finish = useCallback(async () => {
    if (!active) return null
    const s = await sessionsApi.finishSession(active.id)
    setActive(null)
    return s
  }, [active])

  const discard = useCallback(async () => {
    if (!active) return
    await sessionsApi.deleteSession(active.id)
    setActive(null)
  }, [active])

  const value = useMemo(
    () => ({ active, loading, refresh, start, addExercise, finish, discard, setActive }),
    [active, loading, refresh, start, addExercise, finish, discard],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
