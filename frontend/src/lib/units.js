export const LBS_PER_KG = 2.2046226218

export function toDisplay(lbs, unit) {
  if (lbs === null || lbs === undefined || lbs === '') return null
  const n = Number(lbs)
  if (Number.isNaN(n)) return null
  return unit === 'kg' ? n / LBS_PER_KG : n
}

export function toLbs(value, unit) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return unit === 'kg' ? n * LBS_PER_KG : n
}

export function round(n, digits = 1) {
  if (n === null || n === undefined) return null
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** Format a stored-lbs weight for display: "135 lbs", "61.2 kg", or "Bodyweight" when null. */
export function formatWeight(lbs, unit, { bodyweight = 'Bodyweight' } = {}) {
  const v = toDisplay(lbs, unit)
  if (v === null) return bodyweight
  return `${formatNumber(round(v, 1))} ${unit}`
}

export function formatVolume(lbs, unit) {
  const v = toDisplay(lbs, unit) ?? 0
  return `${formatNumber(Math.round(v))} ${unit}`
}

export function formatNumber(n) {
  if (n === null || n === undefined) return '–'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n)
}

export function compactNumber(n) {
  if (n === null || n === undefined) return '–'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
