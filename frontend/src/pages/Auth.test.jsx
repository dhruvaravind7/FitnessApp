import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import Auth from './Auth'
import { validateAuth as validate } from '../lib/validation'
import { renderWithProviders, fakeToken } from '../test/utils'

vi.mock('../api/auth', () => ({ login: vi.fn(), register: vi.fn(), me: vi.fn() }))
vi.mock('../api/sessions', () => ({ getActiveSession: vi.fn().mockResolvedValue(null) }))
import * as authApi from '../api/auth'

describe('validate()', () => {
  it('requires fields and enforces register rules', () => {
    expect(validate('login', { username: '', password: '', email: '' })).toEqual({ username: 'Username is required', password: 'Password is required' })
    expect(validate('login', { username: 'ab', password: 'x', email: '' })).toEqual({})
    expect(validate('register', { username: 'ab', password: 'short', email: 'bad' })).toEqual({
      username: 'At least 3 characters', password: 'At least 8 characters', email: 'Enter a valid email',
    })
    expect(validate('register', { username: 'abc', password: 'longenough', email: 'a@b.co' })).toEqual({})
  })
})

describe('<Auth />', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows validation errors and does not call the API', async () => {
    renderWithProviders(<Auth />, { route: '/login' })
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('logs in and redirects to the dashboard', async () => {
    authApi.login.mockResolvedValue({ access_token: fakeToken('dhruv'), token_type: 'Bearer', user: { id: 1, username: 'dhruv' } })
    renderWithProviders(null, {
      route: '/login',
      routes: (
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/" element={<h1>Dashboard for tests</h1>} />
        </Routes>
      ),
    })
    await userEvent.type(screen.getByLabelText('Username'), 'dhruv')
    await userEvent.type(screen.getByLabelText('Password'), 'secret12')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith('dhruv', 'secret12'))
    expect(await screen.findByText('Dashboard for tests')).toBeInTheDocument()
  })

  it('shows the server error on failed login', async () => {
    authApi.login.mockRejectedValue({ response: { status: 401, data: { detail: 'Incorrect username or password' } } })
    renderWithProviders(<Auth />, { route: '/login' })
    await userEvent.type(screen.getByLabelText('Username'), 'dhruv')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')
  })

  it('registers with email on the create-account tab', async () => {
    authApi.register.mockResolvedValue({ access_token: fakeToken('new'), user: { id: 2, username: 'new' } })
    renderWithProviders(<Auth />, { route: '/login?tab=register' })
    await userEvent.type(screen.getByLabelText('Username'), 'newuser')
    await userEvent.type(screen.getByLabelText('Email'), 'new@user.io')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(authApi.register).toHaveBeenCalledWith('newuser', 'password123', 'new@user.io'))
  })
})
