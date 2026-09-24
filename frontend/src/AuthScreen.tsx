import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, register, type User } from './api'
import './Auth.css'

type AuthScreenProps = { onAuthenticated: (user: User) => void }

type Mode = 'login' | 'register'

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [displayName, setDisplayName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode)
    setError('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await register(email, password, displayName, company, role)
      onAuthenticated(user)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <section className="auth-visual">
        <div className="auth-brand"><span className="auth-logo"><i /></span>log<span>lens</span></div>
        <div className="auth-visual-copy">
          <span className="auth-kicker">SECURITY OBSERVABILITY</span>
          <h1>Make every log<br /><em>tell a story.</em></h1>
          <p>Understand what happened, spot the attack, and move from noise to action in seconds.</p>
          <div className="auth-proof"><div className="proof-avatars"><span>JD</span><span>AK</span><span>PM</span></div><strong>Trusted by security teams</strong><small>to keep their systems legible</small></div>
        </div>
        <div className="auth-visual-footer"><span>© 2026 Loglens</span><span>Privacy · Security</span></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-auth-brand"><span className="auth-logo"><i /></span>log<span>lens</span></div>
          <div className="auth-heading">
            <span className="auth-kicker">WELCOME BACK</span>
            <h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}</h2>
            <p>{mode === 'login' ? 'Continue where you left off.' : 'Start turning noisy logs into clear answers.'}</p>
          </div>
          <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">Sign in</button><button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Create account</button></div>
          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <label>Full name<input autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} placeholder="Jordan Davis" required value={displayName} /></label>}
            {mode === 'register' && <label>Company<input autoComplete="organization" onChange={(event) => setCompany(event.target.value)} placeholder="Acme Cloud" required value={company} /></label>}
            {mode === 'register' && <label>Role<input onChange={(event) => setRole(event.target.value)} placeholder="Security Analyst" required value={role} /></label>}
            <label>Email address<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required type="email" value={email} /></label>
            <label>Password<div className="password-field"><input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={password} /><span>•••</span></div></label>
            {mode === 'login' && <div className="form-options"><label className="checkbox-label"><input type="checkbox" /> Remember me</label><button onClick={() => setError('Password reset is not configured yet.')} type="button">Forgot password?</button></div>}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" disabled={submitting} type="submit">{submitting ? 'Please wait…' : mode === 'login' ? 'Sign in to Loglens' : 'Create account'}<span>→</span></button>
          </form>
          <p className="auth-terms">By continuing, you agree to our <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</p>
        </div>
      </section>
    </main>
  )
}
