import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Filter, Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react'
import * as exercisesApi from '../api/exercises'
import { errorMessage } from '../api/client'
import ExerciseCard, { ExerciseCardSkeleton } from '../components/ExerciseCard'
import { EmptyState } from '../components/ui'
import { BODY_PARTS, EQUIPMENTS, EXERCISE_TYPES, TARGET_MUSCLES } from '../constants/exerciseFilters'
import { titleCase } from '../lib/format'
import './Search.css'

const EMPTY_FILTERS = { bodyParts: '', equipments: '', targetMuscles: '', exerciseType: '' }
const STATE_KEY = 'fitcoach_search_state'

function loadState() {
  try { return JSON.parse(sessionStorage.getItem(STATE_KEY)) || {} } catch { return {} }
}

export default function Search() {
  const [query, setQuery] = useState(() => loadState().query || '')
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, ...(loadState().filters || {}) }))
  const [results, setResults] = useState([])
  const [meta, setMeta] = useState({ total: null, hasNextPage: false, nextCursor: null })
  const [mode, setMode] = useState('browse') // 'browse' (filters) | 'search' (name)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const requestId = useRef(0)

  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters])

  useEffect(() => {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ query, filters })) } catch { /* ignore */ }
  }, [query, filters])

  const runBrowse = useCallback(async (f) => {
    const id = ++requestId.current
    setLoading(true); setError(''); setMode('browse')
    try {
      const data = await exercisesApi.listExercises(f)
      if (id !== requestId.current) return
      setResults(data.data)
      setMeta({ total: data.total, hasNextPage: data.hasNextPage, nextCursor: data.nextCursor })
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  const runSearch = useCallback(async (q) => {
    const id = ++requestId.current
    setLoading(true); setError(''); setMode('search')
    try {
      const data = await exercisesApi.searchExercises(q)
      if (id !== requestId.current) return
      setResults(data)
      setMeta({ total: data.length, hasNextPage: false, nextCursor: null })
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  // Debounced name search; empty query falls back to browsing with filters.
  useEffect(() => {
    const q = query.trim()
    const t = setTimeout(() => { q ? runSearch(q) : runBrowse(filters) }, q ? 400 : 0)
    return () => clearTimeout(t)
  }, [query, filters, runBrowse, runSearch])

  async function loadMore() {
    if (!meta.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await exercisesApi.listExercises(filters, meta.nextCursor)
      setResults((r) => {
        const seen = new Set(r.map((x) => x.exerciseId))
        return [...r, ...data.data.filter((x) => !seen.has(x.exerciseId))]
      })
      setMeta({ total: data.total, hasNextPage: data.hasNextPage, nextCursor: data.nextCursor })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
    if (query) setQuery('')
  }

  const filterPanel = (
    <>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h3 className="row" style={{ gap: 8 }}><Filter size={16} /> Filters</h3>
        {activeFilterCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button>
        )}
      </div>
      <FilterSelect label="Body part" value={filters.bodyParts} options={BODY_PARTS} onChange={(v) => setFilter('bodyParts', v)} />
      <FilterSelect label="Equipment" value={filters.equipments} options={EQUIPMENTS} onChange={(v) => setFilter('equipments', v)} />
      <FilterSelect label="Target muscle" value={filters.targetMuscles} options={TARGET_MUSCLES} onChange={(v) => setFilter('targetMuscles', v)} />
      <FilterSelect label="Exercise type" value={filters.exerciseType} options={EXERCISE_TYPES} onChange={(v) => setFilter('exerciseType', v)} />
      <p className="hint muted small">Filters combine, so a body part plus equipment narrows the list. Typing a name searches instead.</p>
    </>
  )

  return (
    <div className="page search-page">
      <div className="page-header">
        <div>
          <h1>Exercise library</h1>
          <p className="subtitle">Find a movement, learn the form, and log it.</p>
        </div>
      </div>

      <div className="search-bar">
        <SearchIcon size={18} className="search-bar-icon" />
        <input
          className="input" type="search" placeholder="Search by name, e.g. bench press, squat, plank…"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search exercises"
        />
        {query && <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
        <button className="btn filter-toggle" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && <span className="badge">{activeFilterCount}</span>}
        </button>
      </div>

      <div className="search-layout">
        <aside className="filter-sidebar card tight">{filterPanel}</aside>

        {drawerOpen && (
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
            <div className="drawer card" onClick={(e) => e.stopPropagation()}>
              <div className="row between"><strong>Filters</strong><button className="btn btn-ghost btn-icon" onClick={() => setDrawerOpen(false)}><X size={18} /></button></div>
              {filterPanel}
              <button className="btn btn-primary btn-block" onClick={() => setDrawerOpen(false)}>Show results</button>
            </div>
          </div>
        )}

        <main className="search-results">
          <div className="results-meta">
            {loading ? <span className="muted small">Searching…</span> : (
              <span className="muted small">
                {mode === 'search' ? `${results.length} result${results.length === 1 ? '' : 's'} for “${query.trim()}”`
                  : meta.total != null ? `${meta.total} exercise${meta.total === 1 ? '' : 's'}` : `${results.length} exercises`}
              </span>
            )}
            {activeFilterCount > 0 && mode === 'browse' && (
              <div className="tag-row">
                {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
                  <button key={k} className="tag accent chip-btn" onClick={() => setFilter(k, '')}>{titleCase(v)} <X size={12} /></button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div className="results-grid">{Array.from({ length: 8 }).map((_, i) => <ExerciseCardSkeleton key={i} />)}</div>
          ) : results.length === 0 ? (
            <EmptyState icon={SearchIcon} title="No exercises found">
              Try a different name or loosen the filters.
            </EmptyState>
          ) : (
            <>
              <div className="results-grid">
                {results.map((ex) => <ExerciseCard key={ex.exerciseId} exercise={ex} />)}
              </div>
              {mode === 'browse' && meta.hasNextPage && (
                <div className="center" style={{ marginTop: 24 }}>
                  <button className="btn" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any {label.toLowerCase()}</option>
        {options.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
      </select>
    </div>
  )
}
