import { api } from './client'

export const searchExercises = (q) => api.get('/exercises/search', { params: { q } }).then((r) => r.data)
export const listExercises = (filters = {}, after) =>
  api.get('/exercises', { params: { ...filters, after: after || undefined, limit: 25 } }).then((r) => r.data)
export const getExercise = (id) => api.get(`/exercises/${encodeURIComponent(id)}`).then((r) => r.data)
export const getFilterVocab = () => api.get('/exercises/filters').then((r) => r.data)
