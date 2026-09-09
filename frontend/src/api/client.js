import axios from 'axios'

export const TOKEN_KEY = 'fitcoach_token'
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

const unauthorizedListeners = new Set()
/** Register a callback fired when the API answers 401 (AuthContext uses this to log out). */
export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn)
  return () => unauthorizedListeners.delete(fn)
}

export const api = axios.create({ baseURL: API_URL, timeout: 120000 })

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    if (status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      setToken(null)
      unauthorizedListeners.forEach((fn) => fn())
    }
    return Promise.reject(error)
  },
)

/** Human-readable message from an axios error (FastAPI `detail`, pydantic 422s, or network). */
export function errorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback
  if (!error.response) return error.code === 'ECONNABORTED' ? 'The request timed out' : 'Cannot reach the server'
  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const d = detail[0]
    const field = Array.isArray(d.loc) ? d.loc.filter((x) => x !== 'body').join('.') : ''
    return field ? `${field}: ${d.msg}` : d.msg
  }
  return fallback
}
