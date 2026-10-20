import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { startSession } from './sessions'
import { todayISO } from '../lib/format'

describe('startSession', () => {
  afterEach(() => vi.restoreAllMocks())

  // Regression: the server falls back to its own CURRENT_DATE, which is UTC. For a user
  // behind UTC that is already tomorrow late in the evening, so the session landed on the
  // wrong day and the dashboard streak read 0 right after logging a workout.
  it('sends the client local date so the session is not dated in UTC', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await startSession()
    expect(post).toHaveBeenCalledWith('/sessions', { date: todayISO() })
  })

  it('keeps the caller name and still dates the session', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await startSession({ name: 'Leg day' })
    expect(post).toHaveBeenCalledWith('/sessions', { date: todayISO(), name: 'Leg day' })
  })

  it('lets an explicit date win over the default', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await startSession({ date: '2026-01-02' })
    expect(post).toHaveBeenCalledWith('/sessions', { date: '2026-01-02' })
  })
})
