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
    <div className="lg">
      <div className="lg-top">
        <img src="/brand/logo-outline.webp" alt="NAFU design" />
        <span className="tag">Panel NAFU Design</span>
      </div>

      <div className="lg-stage">
        <div className="lg-glow" aria-hidden />
        <img src="/brand/kv-desk.webp" alt="" className="lg-kv" />
        <div className="lg-claim">
          <h1>
            Briefy klientów <em>w jednym</em> miejscu.
          </h1>
          <p>Ankiety, odpowiedzi i podsumowania AI dla każdego projektu.</p>
        </div>
      </div>

      <form className="lg-card" onSubmit={submit}>
        <div>
          <div className="eyebrow">Panel NAFU Brief</div>
          <h2>Witaj z powrotem</h2>
        </div>
        {isDemo && <p className="note">Tryb demo: kliknij „Zaloguj”, hasło nie jest sprawdzane.</p>}
        <label className="field">
          <span className="label">E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="twoj@email.pl" />
        </label>
        <label className="field">
          <span className="label">Hasło</span>
          <input className="input" type="password" autoComplete="current-password" required={!isDemo} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Loguję…' : 'Zaloguj się'}
        </button>
        <div className="lg-foot">
          <span>{CONTACT.names}</span>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </div>
      </form>
    </div>
  )
}
