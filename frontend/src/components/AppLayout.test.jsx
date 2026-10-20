import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppLayout from './AppLayout'
import { renderWithProviders, fakeToken } from '../test/utils'
import { TOKEN_KEY } from '../api/client'

vi.mock('../api/sessions', () => ({
  getActiveSession: vi.fn().mockResolvedValue(null),
  startSession: vi.fn(), addExercise: vi.fn(), getSession: vi.fn(), updateSession: vi.fn(),
  finishSession: vi.fn(), deleteSession: vi.fn(), quickLog: vi.fn(),
  updateExercise: vi.fn(), deleteExercise: vi.fn(), listSessions: vi.fn(),
}))

const shell = () => document.querySelector('.app-shell')
// The bottom nav renders the same links for mobile; CSS hides it but jsdom applies no
// CSS, so every link query is scoped to the sidebar to stay unambiguous.
const sidebar = () => within(document.querySelector('.sidebar'))

function renderAt(route) {
  return renderWithProviders(null, {
    route,
    routes: (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>dash</p>} />
          <Route path="/coach" element={<p>coach</p>} />
          <Route path="/coach/:id" element={<p>coach convo</p>} />
        </Route>
      </Routes>
    ),
  })
}

describe('AppLayout sidebar', () => {
  beforeEach(() => localStorage.setItem(TOKEN_KEY, fakeToken()))

  // /coach renders its own 280px conversation list; a full sidebar beside it means two
  // nav columns, so the rail is the default there and nowhere else.
  it('is expanded on the dashboard', () => {
    renderAt('/')
    expect(shell()).not.toHaveClass('sidebar-collapsed')
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapses by default on /coach and on a conversation route', () => {
    const { unmount } = renderAt('/coach')
    expect(shell()).toHaveClass('sidebar-collapsed')
    unmount()
    renderAt('/coach/42')
    expect(shell()).toHaveClass('sidebar-collapsed')
  })

  it('keeps nav labels readable to screen readers while collapsed', () => {
    renderAt('/coach')
    // Visually hidden, not removed from the accessibility tree.
    const history = sidebar().getByRole('link', { name: 'History' })
    expect(history.querySelector('span')).toHaveClass('sr-only')
    expect(history).toHaveAttribute('title', 'History')
  })

  it('lets the toggle override the route default', async () => {
    const user = userEvent.setup()
    renderAt('/coach')
    expect(shell()).toHaveClass('sidebar-collapsed')
    await user.click(screen.getByRole('button', { name: /expand sidebar/i }))
    expect(shell()).not.toHaveClass('sidebar-collapsed')
  })

  it('drops the override when the route changes', async () => {
    const user = userEvent.setup()
    renderAt('/coach')
    await user.click(screen.getByRole('button', { name: /expand sidebar/i }))
    expect(shell()).not.toHaveClass('sidebar-collapsed')
    // Navigating away and back restores the route's own default rather than the override.
    await user.click(sidebar().getByRole('link', { name: 'Dashboard' }))
    expect(shell()).not.toHaveClass('sidebar-collapsed')
    await user.click(sidebar().getByRole('link', { name: 'Coach' }))
    expect(shell()).toHaveClass('sidebar-collapsed')
  })
})
