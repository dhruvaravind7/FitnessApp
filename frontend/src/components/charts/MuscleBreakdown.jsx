import { titleCase } from '../../lib/format'
import { COLORS } from './chartTheme'
import './MuscleBreakdown.css'

/** Sets per muscle / body part as horizontal bars (top N). Plain CSS so it renders reliably at any size. */
export default function MuscleBreakdown({ items = [], limit = 8 }) {
  const data = items.slice(0, limit)
  if (data.length === 0) return <p className="muted small">Log a few exercises and your muscle balance shows up here.</p>
  const max = Math.max(...data.map((d) => d.sets), 1)
  return (
    <ul className="muscle-bars" aria-label="Sets per muscle">
      {data.map((m, i) => (
        <li key={m.name} className="muscle-bar-row" title={`${m.entries} entries`}>
          <span className="muscle-bar-label">{titleCase(m.name)}</span>
          <span className="muscle-bar-track">
            <span className="muscle-bar-fill" style={{ width: `${Math.max(3, (m.sets / max) * 100)}%`, background: COLORS[i % COLORS.length] }} />
          </span>
          <span className="muscle-bar-value mono">{m.sets} <span className="muted">sets</span></span>
        </li>
      ))}
    </ul>
  )
}
