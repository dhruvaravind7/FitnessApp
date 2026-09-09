import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { titleCase } from '../../lib/format'
import { AXIS, COLORS, TOOLTIP_STYLE } from './chartTheme'

/** Sets per muscle / body part, horizontal bars, top N. */
export default function MuscleBreakdown({ items = [], limit = 8 }) {
  const data = items.slice(0, limit).map((m) => ({ ...m, label: titleCase(m.name) }))
  if (data.length === 0) return <p className="muted small">Log a few exercises and your muscle balance shows up here.</p>
  return (
    <div style={{ width: '100%', height: Math.max(160, data.length * 34) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" {...AXIS} width={150} tick={{ fill: '#aab7c7', fontSize: 12 }} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v, _n, p) => [`${v} sets · ${p.payload.entries} entries`, '']} />
          <Bar dataKey="sets" radius={[0, 6, 6, 0]} maxBarSize={18} label={{ position: 'right', fill: '#aab7c7', fontSize: 12 }}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
