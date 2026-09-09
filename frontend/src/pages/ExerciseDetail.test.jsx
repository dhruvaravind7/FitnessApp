import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import ExerciseDetail from './ExerciseDetail'
import { validateLog } from '../lib/validation'
import { renderWithProviders, fakeToken } from '../test/utils'
import { setToken } from '../api/client'

vi.mock('../api/exercises', () => ({ getExercise: vi.fn() }))
vi.mock('../api/stats', () => ({ getProgress: vi.fn() }))
vi.mock('../api/sessions', () => ({
  getActiveSession: vi.fn(), startSession: vi.fn(), addExercise: vi.fn(), getSession: vi.fn(), quickLog: vi.fn(),
}))
vi.mock('../components/charts/ProgressChart', () => ({ default: () => <div data-testid="chart" /> }))
import * as exercisesApi from '../api/exercises'
import * as statsApi from '../api/stats'
import * as sessionsApi from '../api/sessions'

const BENCH = {
  exerciseId: 'exr_bench', name: 'Bench Press', imageUrl: 'https://img/b.jpg', videoUrl: null, bodyParts: ['CHEST'], equipments: ['BARBELL'],
  targetMuscles: ['PECTORALIS MAJOR STERNAL HEAD'], secondaryMuscles: [], exerciseType: 'STRENGTH', instructions: ['Lie down.', 'Press.'], overview: null, exerciseTips: [],
}

describe('validateLog()', () => {
  it('validates sets, reps and weight', () => {
    expect(validateLog({ sets: '', reps: '0', weight: '-1' })).toEqual({ sets: 'Enter at least 1 set', reps: 'Enter at least 1 rep', weight: 'Weight must be 0 or more' })
    expect(validateLog({ sets: '3', reps: '8', weight: '' })).toEqual({})
  })
})

describe('<ExerciseDetail />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setToken(fakeToken())
    exercisesApi.getExercise.mockResolvedValue(BENCH)
    statsApi.getProgress.mockResolvedValue({ exercise_id: 'exr_bench', points: [], best_weight: null })
    sessionsApi.getActiveSession.mockResolvedValue(null)
  })

  function renderPage() {
    return renderWithProviders(null, {
      route: '/exercise/exr_bench',
      routes: (
        <Routes>
          <Route path="/exercise/:id" element={<ExerciseDetail />} />
          <Route path="/sessions/:id" element={<h1>Session page</h1>} />
        </Routes>
      ),
    })
  }

  it('renders the exercise and quick-logs with kg converted to lbs', async () => {
    localStorage.setItem('fitcoach_unit', 'kg')
    sessionsApi.quickLog.mockResolvedValue({ id: 42 })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Lie down.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Sets')); await userEvent.type(screen.getByLabelText('Sets'), '4')
    await userEvent.clear(screen.getByLabelText('Reps')); await userEvent.type(screen.getByLabelText('Reps'), '6')
    await userEvent.type(screen.getByLabelText('Weight (kg)'), '60')
    await userEvent.click(screen.getByRole('button', { name: /Quick log/ }))

    await waitFor(() => expect(sessionsApi.quickLog).toHaveBeenCalledTimes(1))
    const body = sessionsApi.quickLog.mock.calls[0][0]
    expect(body.sets).toBe(4)
    expect(body.reps).toBe(6)
    expect(body.weight).toBeCloseTo(132.28, 1)
    expect(body.exerciseDetails.exerciseId).toBe('exr_bench')
    expect(body.notes).toBeNull()
    expect(typeof body.date).toBe('string')
    expect(await screen.findByText('Session page')).toBeInTheDocument()
  })

  it('adds to the active session when one exists', async () => {
    const active = { id: 7, name: 'Push day', exercise_count: 1, started_at: new Date().toISOString(), ended_at: null, exercises: [] }
    sessionsApi.getActiveSession.mockResolvedValue(active)
    sessionsApi.addExercise.mockResolvedValue({ id: 1 })
    sessionsApi.getSession.mockResolvedValue({ ...active, exercise_count: 2 })
    renderPage()
    const btn = await screen.findByRole('button', { name: /Add to “Push day”/ })
    await userEvent.click(btn)
    await waitFor(() => expect(sessionsApi.addExercise).toHaveBeenCalledWith(7, expect.objectContaining({ sets: 3, reps: 10, weight: null })))
    expect(sessionsApi.startSession).not.toHaveBeenCalled()
  })

  it('blocks submission on invalid input', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Bench Press' })
    await userEvent.clear(screen.getByLabelText('Sets'))
    await userEvent.click(screen.getByRole('button', { name: /Quick log/ }))
    expect(await screen.findByText('Enter at least 1 set')).toBeInTheDocument()
    expect(sessionsApi.quickLog).not.toHaveBeenCalled()
  })
})
