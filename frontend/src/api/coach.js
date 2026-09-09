import { api } from './client'
import { todayISO } from '../lib/format'

export const listConversations = () => api.get('/coach/conversations').then((r) => r.data)
export const createConversation = (title) => api.post('/coach/conversations', title ? { title } : {}).then((r) => r.data)
export const getConversation = (id) => api.get(`/coach/conversations/${id}`).then((r) => r.data)
export const deleteConversation = (id) => api.delete(`/coach/conversations/${id}`)
export const sendMessage = (id, content) =>
  api.post(`/coach/conversations/${id}/messages`, { content, today: todayISO() }).then((r) => r.data)
