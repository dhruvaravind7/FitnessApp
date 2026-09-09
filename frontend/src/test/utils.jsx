import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthProvider } from '../context/AuthContext'
import { UnitProvider } from '../context/UnitContext'
import { ToastProvider } from '../context/ToastContext'
import { SessionProvider } from '../context/SessionContext'

export function renderWithProviders(ui, { route = '/', path = '*', routes = null } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <UnitProvider>
          <ToastProvider>
            <SessionProvider>
              {routes || <Routes><Route path={path} element={ui} /></Routes>}
            </SessionProvider>
          </ToastProvider>
        </UnitProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

/** A syntactically valid, unexpired JWT for user 1 / "tester" (signature is irrelevant client-side). */
export function fakeToken(username = 'tester', id = 1) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ user_id: String(id), username, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}
