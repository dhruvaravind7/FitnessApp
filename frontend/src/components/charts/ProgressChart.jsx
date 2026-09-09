import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useUnit } from '../../context/UnitContext'
import { formatDate } from '../../lib/format'
import { AXIS, GRID, TOOLTIP_STYLE } from './chartTheme'

/** Per-date max weight and estimated 1RM for one exercise. */
export default function ProgressChart({ points = [] }) {
  const unit = useUnit()
  const data = points.map((p) => ({
    label: formatDate(p.date, 'MMM d'),
    weight: p.max_weight != null ? unit.display(p.max_weight) : null,
    e1rm: p.est_1rm ? unit.display(p.est_1rm) : null,
    volume: unit.display(p.volume, 0),
  }))
  const bodyweightOnly = data.every((d) => d.weight === null)
  if (bodyweightOnly) {
    return (
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={points.map((p) => ({ label: formatDate(p.date, 'MMM d'), reps: p.max_reps, sets: p.sets }))} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="reps" name="Max reps" stroke="#c8f135" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} domain={['auto', 'auto']} width={48} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [`${v} ${unit.unit}`, name]} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#aab7c7' }} />
          <Line type="monotone" dataKey="weight" name="Top weight" stroke="#c8f135" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
          <Line type="monotone" dataKey="e1rm" name="Est. 1RM" stroke="#60a5fa" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
