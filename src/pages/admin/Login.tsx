import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CONTACT } from '../../components/ui'
import { api } from '../../lib/api'
import { isDemo } from '../../lib/supabase'

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState(isDemo ? CONTACT.email : '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.signIn(email, password)
      nav((loc.state as { from?: string } | null)?.from ?? '/panel', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-art brand-band">
        <img src="/brand/logo-outline.webp" alt="NAFU design" style={{ width: 240 }} />
        <img src="/brand/kv-desk.webp" alt="" className="kv" />
        <p className="light" style={{ fontSize: 20, margin: 0, color: 'rgba(255,255,255,.85)' }}>
          Brief, który pracuje za Ciebie.
        </p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <div>
          <div className="eyebrow">Panel NAFU Brief</div>
          <h1 style={{ fontSize: 34, color: 'var(--ink)', marginTop: 8 }}>Zaloguj się</h1>
        </div>
        {isDemo && <p className="muted" style={{ margin: 0 }}>Tryb demo: kliknij „Zaloguj”, hasło nie jest sprawdzane.</p>}
        <label className="field">
          <span className="label">E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Hasło</span>
          <input className="input" type="password" autoComplete="current-password" required={!isDemo} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        <button className="btn btn-primary" disabled={busy} style={{ minHeight: 50 }}>
          {busy ? 'Loguję…' : 'Zaloguj'}
        </button>
      </form>
    </div>
  )
}
