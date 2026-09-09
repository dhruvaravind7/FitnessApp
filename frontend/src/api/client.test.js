import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, errorMessage, getToken, onUnauthorized, setToken, TOKEN_KEY } from './client'

describe('api client', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('stores and clears the token', () => {
    setToken('abc')
    expect(getToken()).toBe('abc')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc')
    setToken(null)
    expect(getToken()).toBeNull()
  })

  it('attaches the bearer token to requests', async () => {
    setToken('tok123')
    const handler = api.interceptors.request.handlers[0]
    const config = await handler.fulfilled({ headers: {}, url: '/sessions' })
    expect(config.headers.Authorization).toBe('Bearer tok123')
  })

  it('clears the token and notifies listeners on 401 (except auth endpoints)', async () => {
    setToken('tok')
    const listener = vi.fn()
    const off = onUnauthorized(listener)
    const handler = api.interceptors.response.handlers[0]
    await expect(handler.rejected({ response: { status: 401 }, config: { url: '/sessions' } })).rejects.toBeTruthy()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getToken()).toBeNull()

    setToken('tok2')
    await expect(handler.rejected({ response: { status: 401 }, config: { url: '/auth/login' } })).rejects.toBeTruthy()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getToken()).toBe('tok2')
    off()
  })

  it('extracts readable error messages', () => {
    expect(errorMessage({ response: { data: { detail: 'Nope' } } })).toBe('Nope')
    expect(errorMessage({ response: { data: { detail: [{ loc: ['body', 'sets'], msg: 'must be >= 1' }] } } })).toBe('sets: must be >= 1')
    expect(errorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback')
    expect(errorMessage({ request: {} })).toBe('Cannot reach the server')
    expect(errorMessage({ code: 'ECONNABORTED' })).toBe('The request timed out')
  })
})
