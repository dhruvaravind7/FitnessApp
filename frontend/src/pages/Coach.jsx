import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, MessageSquareHeart, MessageSquarePlus, Menu, Sparkles, Trash2, X } from 'lucide-react'
import * as coachApi from '../api/coach'
import { errorMessage } from '../api/client'
import { useToast } from '../context/ToastContext'
import { ConfirmDialog, Spinner } from '../components/ui'
import { timeAgo } from '../lib/format'
import './Coach.css'

const SUGGESTIONS = [
  'What did I train this week, and what am I neglecting?',
  'Plan my next push workout based on my recent numbers.',
  'How is my bench press progressing? Should I add weight?',
  'Build me a 4-day split from the exercises I already do.',
  'Which muscle groups have I trained least in the last month?',
  'Review my last session and give me two things to improve.',
]

export default function Coach() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [conversations, setConversations] = useState([])
  const [conversation, setConversation] = useState(null)
  const [loadingConv, setLoadingConv] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingUser, setPendingUser] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const loadList = useCallback(() => coachApi.listConversations().then(setConversations).catch((e) => toast.error(errorMessage(e))), [toast])
  useEffect(() => { loadList() }, [loadList])

  useEffect(() => {
    if (!conversationId) { setConversation(null); return }
    let cancelled = false
    setLoadingConv(true)
    coachApi.getConversation(conversationId)
      .then((c) => { if (!cancelled) setConversation(c) })
      .catch((e) => { if (!cancelled) { toast.error(errorMessage(e, 'Conversation not found')); navigate('/coach', { replace: true }) } })
      .finally(() => { if (!cancelled) setLoadingConv(false) })
    return () => { cancelled = true }
  }, [conversationId, navigate, toast])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversation?.messages?.length, pendingUser, sending])

  async function send(text) {
    const content = (text ?? draft).trim()
    if (!content || sending) return
    setSending(true)
    setDraft('')
    setPendingUser(content)
    try {
      let convId = conversationId
      if (!convId) {
        const created = await coachApi.createConversation()
        convId = created.id
        setConversation({ ...created, messages: [] })
        navigate(`/coach/${convId}`, { replace: true })
      }
      const res = await coachApi.sendMessage(convId, content)
      setConversation((c) => ({ ...(c || {}), ...res.conversation, messages: [...(c?.messages || []), res.user_message, res.model_message] }))
      setPendingUser(null)
      loadList()
    } catch (e) {
      toast.error(errorMessage(e, 'The coach could not answer'))
      setDraft(content)
      setPendingUser(null)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function removeConversation(id) {
    try {
      await coachApi.deleteConversation(id)
      setConfirmDelete(null)
      setConversations((l) => l.filter((c) => c.id !== id))
      if (String(id) === String(conversationId)) navigate('/coach')
      toast.success('Conversation deleted')
    } catch (e) { toast.error(errorMessage(e)) }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const messages = conversation?.messages || []
  const showWelcome = !loadingConv && messages.length === 0 && !pendingUser

  return (
    <div className="coach-page">
      <aside className={`conv-list ${listOpen ? 'open' : ''}`}>
        <div className="conv-list-head">
          <h2 className="row" style={{ gap: 8 }}><MessageSquareHeart size={18} /> Coach</h2>
          <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setListOpen(false)} aria-label="Close"><X size={18} /></button>
        </div>
        <button className="btn btn-primary btn-block" onClick={() => { navigate('/coach'); setListOpen(false); inputRef.current?.focus() }}><MessageSquarePlus size={16} /> New conversation</button>
        <div className="conv-items">
          {conversations.length === 0 && <p className="muted small" style={{ padding: '8px 4px' }}>Your conversations will be saved here.</p>}
          {conversations.map((c) => (
            <div key={c.id} className={`conv-item ${String(c.id) === String(conversationId) ? 'active' : ''}`}>
              <button className="conv-item-main" onClick={() => { navigate(`/coach/${c.id}`); setListOpen(false) }}>
                <span className="conv-title">{c.title}</span>
                <span className="muted" style={{ fontSize: '0.72rem' }}>{timeAgo(c.updated_at)}</span>
              </button>
              <button className="btn btn-ghost btn-icon conv-del" onClick={() => setConfirmDelete(c)} aria-label="Delete conversation"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </aside>
      {listOpen && <div className="conv-backdrop mobile-only" onClick={() => setListOpen(false)} />}

      <section className="chat">
        <header className="chat-head">
          <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setListOpen(true)} aria-label="Conversations"><Menu size={18} /></button>
          <div className="chat-head-title">
            <strong>{conversation?.title || 'New conversation'}</strong>
            <span className="muted small">Grounded in your log via MCP tools · not medical advice</span>
          </div>
        </header>

        <div className="chat-scroll">
          {loadingConv ? <div className="center" style={{ padding: 60 }}><Spinner size="lg" /></div> : (
            <div className="chat-inner">
              {showWelcome && (
                <div className="welcome fade-in">
                  <span className="welcome-icon"><Sparkles size={24} /></span>
                  <h1>What are we working on?</h1>
                  <p className="text-2">Your coach can read your sessions, records and muscle balance before answering. Try one of these:</p>
                  <div className="suggestions">
                    {SUGGESTIONS.map((s) => <button key={s} className="suggestion" onClick={() => send(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {messages.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)}
              {pendingUser && <Bubble role="user" content={pendingUser} />}
              {sending && (
                <div className="bubble-row model">
                  <div className="bubble typing"><span /><span /><span /></div>
                  <span className="muted small">Checking your training log…</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send() }}>
          <textarea ref={inputRef} className="composer-input" rows={1} placeholder="Ask about your training… (Enter to send, Shift+Enter for a new line)"
            value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} disabled={sending} maxLength={8000}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px` }} />
          <button type="submit" className="btn btn-primary btn-icon send-btn" disabled={!draft.trim() || sending} aria-label="Send"><ArrowUp size={18} /></button>
        </form>
      </section>

      <ConfirmDialog open={Boolean(confirmDelete)} title="Delete conversation?" message={`“${confirmDelete?.title}” will be permanently deleted.`}
        onClose={() => setConfirmDelete(null)} onConfirm={() => removeConversation(confirmDelete.id)} />
    </div>
  )
}

function Bubble({ role, content }) {
  return (
    <div className={`bubble-row ${role}`}>
      <div className="bubble">
        {role === 'model' ? <ReactMarkdown>{content}</ReactMarkdown> : content}
      </div>
    </div>
  )
}
