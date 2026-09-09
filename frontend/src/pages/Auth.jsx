import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff, Sparkles, TrendingUp, Search as SearchIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { validateAuth } from '../lib/validation'
import './Auth.css'

export default function Auth() {
  const { isAuthenticated, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'register' ? 'register' : 'login'

  const [form, setForm] = useState({ username: '', password: '', email: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)

  if (isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />

  function setTab(next) {
    setErrors({})
    setServerError('')
    setParams(next === 'register' ? { tab: 'register' } : {}, { replace: true })
  }

  function update(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }))
    }
  }

  async function submit(e) {
    e.preventDefault()
    const errs = validateAuth(tab, form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerError('')
    try {
      if (tab === 'login') await login(form.username.trim(), form.password)
      else await register(form.username.trim(), form.password, form.email.trim())
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setServerError(errorMessage(err, tab === 'login' ? 'Could not sign in' : 'Could not create account'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="brand"><span className="brand-mark"><Dumbbell size={18} /></span> FitCoach</div>
        <h1>Train smarter.<br />Track everything.</h1>
        <p className="text-2">Search 1,300+ exercises, log sessions in seconds, watch your numbers climb, and get advice from a coach that actually reads your log.</p>
        <ul className="auth-features">
          <li><SearchIcon size={18} /> Exercise library with videos and step-by-step instructions</li>
          <li><TrendingUp size={18} /> Volume, streaks, records and per-exercise progress charts</li>
          <li><Sparkles size={18} /> AI coach grounded in your real workout history</li>
        </ul>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'login'} className={tab === 'login' ? 'on' : ''} onClick={() => setTab('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={tab === 'register'} className={tab === 'register' ? 'on' : ''} onClick={() => setTab('register')}>Create account</button>
          </div>
          <h2>{tab === 'login' ? 'Welcome back' : 'Let’s get started'}</h2>
          <p className="muted small">{tab === 'login' ? 'Sign in to continue your training.' : 'Create a free account to start logging.'}</p>

          {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}

          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" className={`input ${errors.username ? 'invalid' : ''}`} autoComplete="username" placeholder="yourname"
              value={form.username} onChange={update('username')} />
            {errors.username && <span className="error-text">{errors.username}</span>}
          </div>

          {tab === 'register' && (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className={`input ${errors.email ? 'invalid' : ''}`} autoComplete="email" placeholder="you@example.com"
                value={form.email} onChange={update('email')} />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
          )}

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="pw-wrap">
              <input id="password" type={showPw ? 'text' : 'password'} className={`input ${errors.password ? 'invalid' : ''}`}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'} placeholder={tab === 'register' ? 'At least 8 characters' : '••••••••'}
                value={form.password} onChange={update('password')} />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <p className="muted small auth-switch">
            {tab === 'login' ? (
              <>New here? <button type="button" className="link" onClick={() => setTab('register')}>Create an account</button></>
            ) : (
              <>Already have an account? <button type="button" className="link" onClick={() => setTab('login')}>Sign in</button></>
            )}
          </p>
        </form>
      </section>
    </div>
  )
}
