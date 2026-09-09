import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from 'date-fns'

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDate(iso) {
  return typeof iso === 'string' ? parseISO(iso) : iso
}

export function formatDate(iso, pattern = 'MMM d, yyyy') {
  if (!iso) return ''
  return format(parseDate(iso), pattern)
}

export function friendlyDate(iso) {
  if (!iso) return ''
  const d = parseDate(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, MMM d')
}

export function timeAgo(iso) {
  if (!iso) return ''
  return formatDistanceToNowStrict(parseDate(iso), { addSuffix: true })
}

export function titleCase(s = '') {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function durationMinutes(startIso, endIso) {
  if (!startIso) return 0
  const start = parseDate(startIso)
  const end = endIso ? parseDate(endIso) : new Date()
  return Math.max(0, Math.round((end - start) / 60000))
}

/** "45 min" / "1h 20m"; returns '' for sub-minute spans (quick logs have start == end). */
export function formatDuration(startIso, endIso) {
  const mins = durationMinutes(startIso, endIso)
  if (mins < 1) return ''
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function pluralize(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export { compactNumber, formatNumber } from './units'
