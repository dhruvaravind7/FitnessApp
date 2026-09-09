import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import * as authApi from '../api/auth'
import { getToken, onUnauthorized, setToken } from '../api/client'

const AuthContext = createContext(null)

function userFromToken(token) {
  if (!token) return null
  try {
    const payload = jwtDecode(token)
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return { id: Number(payload.user_id), username: payload.username }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // Drop an expired token before the first render instead of in an effect.
  const [token, setTokenState] = useState(() => {
    const t = getToken()
    if (t && !userFromToken(t)) { setToken(null); return null }
    return t
  })
  const [user, setUser] = useState(() => userFromToken(getToken()))

  const applyAuth = useCallback((data) => {
    setToken(data.access_token)
    setTokenState(data.access_token)
    setUser(data.user ? { id: data.user.id, username: data.user.username, email: data.user.email } : userFromToken(data.access_token))
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setUser(null)
  }, [])

  useEffect(() => onUnauthorized(logout), [logout])

  const login = useCallback(async (username, password) => applyAuth(await authApi.login(username, password)), [applyAuth])
  const register = useCallback(
    async (username, password, email) => applyAuth(await authApi.register(username, password, email)),
    [applyAuth],
  )

  const value = useMemo(
    () => ({ user, token, isAuthenticated: Boolean(user), login, register, logout }),
    [user, token, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
