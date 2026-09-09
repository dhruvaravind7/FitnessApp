import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import History from './History'
import { renderWithProviders, fakeToken } from '../test/utils'
import { setToken } from '../api/client'

vi.mock('../api/sessions', () => ({
  listSessions: vi.fn(), getActiveSession: vi.fn().mockResolvedValue(null), getSession: vi.fn(),
  updateSession: vi.fn(), deleteSession: vi.fn(), updateExercise: vi.fn(), deleteExercise: vi.fn(),
}))
import * as sessionsApi from '../api/sessions'

const SESSIONS = [
  { id: 1, name: 'Push day', date: '2026-09-08', started_at: '2026-09-08T10:00:00Z', ended_at: '2026-09-08T11:00:00Z', notes: null, exercise_count: 1, total_volume: 3240,
    exercises: [{ id: 11, session_id: 1, exercise_id: 'exr_bench', exercise_name: 'Bench Press', target_muscles: ['PECTORALIS MAJOR STERNAL HEAD'], body_parts: ['CHEST'], sets: 3, reps: 8, weight: 135, notes: 'solid', date: '2026-09-08' }] },
  { id: 2, name: 'Legs', date: '2026-08-30', started_at: '2026-08-30T10:00:00Z', ended_at: '2026-08-30T10:40:00Z', notes: null, exercise_count: 0, total_volume: 0, exercises: [] },
]

describe('<History />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setToken(fakeToken())
    sessionsApi.listSessions.mockResolvedValue(SESSIONS)
  })

  it('groups sessions by month and expands entries', async () => {
    renderWithProviders(<History />, { route: '/history' })
    expect(await screen.findByText('Push day')).toBeInTheDocument()
    expect(screen.getByText(/September 2026/)).toBeInTheDocument()
    expect(screen.getByText(/August 2026/)).toBeInTheDocument()
    expect(screen.getByText(/2 sessions · 1 exercise · 3,240 lbs/)).toBeInTheDocument()

    const card = screen.getByText('Push day').closest('article')
    await userEvent.click(within(card).getByRole('button', { expanded: false }))
    expect(await screen.findByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('3 × 8')).toBeInTheDocument()
    expect(screen.getByText('135 lbs')).toBeInTheDocument()
  })

  it('deletes a session after confirmation', async () => {
    sessionsApi.deleteSession.mockResolvedValue({})
    renderWithProviders(<History />, { route: '/history' })
    const card = (await screen.findByText('Legs')).closest('article')
    await userEvent.click(within(card).getByRole('button', { name: 'Delete session' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete this session?')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(sessionsApi.deleteSession).toHaveBeenCalledWith(2))
    await waitFor(() => expect(screen.queryByText('Legs')).not.toBeInTheDocument())
    expect(screen.getByText('Push day')).toBeInTheDocument()
  })

  it('shows the empty state when there are no sessions', async () => {
    sessionsApi.listSessions.mockResolvedValue([])
    renderWithProviders(<History />, { route: '/history' })
    expect(await screen.findByText('No workouts logged yet')).toBeInTheDocument()
  })
})
