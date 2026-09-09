import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useUnit } from '../../context/UnitContext'
import { compactNumber, formatDate } from '../../lib/format'
import { AXIS, GRID, TOOLTIP_STYLE } from './chartTheme'

/** Weekly training volume (8 Monday-based buckets). */
export default function VolumeChart({ weeks = [] }) {
  const unit = useUnit()
  const data = weeks.map((w) => ({ ...w, label: formatDate(w.week_start, 'MMM d'), value: Math.round(unit.display(w.volume, 0) ?? 0) }))
  const empty = data.every((d) => d.value === 0)
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} tickFormatter={compactNumber} width={56} domain={empty ? [0, 1000] : undefined} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v, _n, p) => [`${compactNumber(v)} ${unit.unit} · ${p.payload.sessions} session${p.payload.sessions === 1 ? '' : 's'}`, 'Volume']} />
          <Bar dataKey="value" fill="#c8f135" radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
