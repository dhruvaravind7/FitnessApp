import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatVolume, formatWeight, round, toDisplay, toLbs } from '../lib/units'

const UNIT_KEY = 'fitcoach_unit'
const UnitContext = createContext(null)

export function UnitProvider({ children }) {
  const [unit, setUnitState] = useState(() => {
    try { return localStorage.getItem(UNIT_KEY) === 'kg' ? 'kg' : 'lbs' } catch { return 'lbs' }
  })
  useEffect(() => {
    try { localStorage.setItem(UNIT_KEY, unit) } catch { /* ignore */ }
  }, [unit])

  const setUnit = useCallback((u) => setUnitState(u === 'kg' ? 'kg' : 'lbs'), [])
  const toggle = useCallback(() => setUnitState((u) => (u === 'kg' ? 'lbs' : 'kg')), [])

  const value = useMemo(
    () => ({
      unit,
      setUnit,
      toggle,
      /** stored lbs -> number in the current unit */
      display: (lbs, digits = 1) => round(toDisplay(lbs, unit), digits),
      /** number typed in the current unit -> lbs for the API */
      toLbs: (v) => toLbs(v, unit),
      weight: (lbs, opts) => formatWeight(lbs, unit, opts),
      volume: (lbs) => formatVolume(lbs, unit),
    }),
    [unit, setUnit, toggle],
  )
  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>
}

export function useUnit() {
  const ctx = useContext(UnitContext)
  if (!ctx) throw new Error('useUnit must be used inside <UnitProvider>')
  return ctx
}
