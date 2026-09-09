import { api } from './client'
import { todayISO } from '../lib/format'

export const getOverview = () => api.get('/stats/overview', { params: { today: todayISO() } }).then((r) => r.data)
export const getMuscles = (days = 30) =>
  api.get('/stats/muscles', { params: { days, today: todayISO() } }).then((r) => r.data)
export const getRecords = () => api.get('/stats/records').then((r) => r.data)
export const getRecentExercises = (limit = 8) => api.get('/stats/recent-exercises', { params: { limit } }).then((r) => r.data)
export const getProgress = (exerciseId) =>
  api.get(`/stats/exercises/${encodeURIComponent(exerciseId)}/progress`).then((r) => r.data)
