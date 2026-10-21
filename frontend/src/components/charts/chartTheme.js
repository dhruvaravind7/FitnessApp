export const AXIS = { stroke: '#7d8b9d', fontSize: 12, tickLine: false, axisLine: false }
export const GRID = { stroke: '#223041', strokeDasharray: '3 3', vertical: false }
export const TOOLTIP_STYLE = {
  contentStyle: { background: '#182230', border: '1px solid #2f4058', borderRadius: 10, fontSize: 13, color: '#e8eef5' },
  labelStyle: { color: '#aab7c7', marginBottom: 4 },
  itemStyle: { color: '#e8eef5' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}
// Mirrors --chart-1..8 in tokens.css. Kept in JS because recharts takes colours as
// SVG attributes, where CSS custom properties are not reliably resolved.
export const COLORS = ['#60a5fa', '#f472b6', '#fbbf24', '#34d399', '#a78bfa', '#fb923c', '#22d3ee', '#94a3b8']
/** Primary series colour: one exercise, one metric over time. */
export const SERIES = COLORS[0]
/** Derived series (estimated 1RM): slate, so a calculated line stays visibly
 *  subordinate to measured data rather than reading as a second real metric. */
export const SERIES_EST = COLORS[7]
