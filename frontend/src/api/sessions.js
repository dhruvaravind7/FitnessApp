import { api } from './client'
import { todayISO } from '../lib/format'

export const listSessions = (params = {}) => api.get('/sessions', { params }).then((r) => r.data)
export const getSession = (id) => api.get(`/sessions/${id}`).then((r) => r.data)
export const getActiveSession = () => api.get('/sessions/active').then((r) => r.data)
// Send the client's local date: the server would otherwise fall back to its own CURRENT_DATE,
// which is UTC and can already be tomorrow for users behind it. An explicit body.date still wins.
export const startSession = (body = {}) =>
  api.post('/sessions', { date: todayISO(), ...body }).then((r) => r.data)
export const updateSession = (id, body) => api.patch(`/sessions/${id}`, body).then((r) => r.data)
export const finishSession = (id) => updateSession(id, { finished: true })
export const deleteSession = (id) => api.delete(`/sessions/${id}`)
export const quickLog = (body) => api.post('/sessions/quick-log', body).then((r) => r.data)
export const addExercise = (sessionId, body) => api.post(`/sessions/${sessionId}/exercises`, body).then((r) => r.data)
export const updateExercise = (sessionId, entryId, body) =>
  api.patch(`/sessions/${sessionId}/exercises/${entryId}`, body).then((r) => r.data)
export const deleteExercise = (sessionId, entryId) => api.delete(`/sessions/${sessionId}/exercises/${entryId}`)
