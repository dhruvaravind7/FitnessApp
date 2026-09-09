import { describe, expect, it } from 'vitest'
import { formatVolume, formatWeight, round, toDisplay, toLbs } from './units'

describe('units', () => {
  it('converts stored lbs to the display unit', () => {
    expect(toDisplay(100, 'lbs')).toBe(100)
    expect(round(toDisplay(100, 'kg'), 1)).toBe(45.4)
    expect(toDisplay(null, 'kg')).toBeNull()
    expect(toDisplay('', 'kg')).toBeNull()
  })
  it('converts typed values back to lbs', () => {
    expect(toLbs('60', 'lbs')).toBe(60)
    expect(round(toLbs('60', 'kg'), 2)).toBe(132.28)
    expect(toLbs('', 'kg')).toBeNull()
    expect(toLbs('abc', 'kg')).toBeNull()
  })
  it('round-trips within rounding tolerance', () => {
    const lbs = toLbs(toDisplay(135, 'kg'), 'kg')
    expect(round(lbs, 6)).toBe(135)
  })
  it('formats weights and volume', () => {
    expect(formatWeight(135, 'lbs')).toBe('135 lbs')
    expect(formatWeight(135, 'kg')).toBe('61.2 kg')
    expect(formatWeight(null, 'kg')).toBe('Bodyweight')
    expect(formatVolume(12345, 'lbs')).toBe('12,345 lbs')
    expect(formatVolume(0, 'kg')).toBe('0 kg')
  })
})
