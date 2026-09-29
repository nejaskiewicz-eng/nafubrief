import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CONTACT } from '../../components/ui'
import { api } from '../../lib/api'
import { isDemo } from '../../lib/supabase'

/** Po zalogowaniu: administratorka do panelu, klient do swoich ankiet */
export async function homeFor(role: 'admin' | 'client', next?: string | null) {
  if (role === 'admin') return next && next.startsWith('/panel') ? next : '/panel'
  if (next && next.startsWith('/') && !next.startsWith('/panel') && !next.startsWith('//')) return next
  const mine = await api.myClient()
  return mine ? `/${mine.slug}` : '/logowanie'
}

export default function Login({ variant = 'admin' }: { variant?: 'admin' | 'client' }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const isClient = variant === 'client'
  const [email, setEmail] = useState(isDemo && !isClient ? CONTACT.email : '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.signIn(email, password, isClient ? 'client' : 'admin')
      const s = await api.session()
      if (!s) throw new Error('Nie udało się zalogować.')
      const next = params.get('next') ?? (loc.state as { from?: string } | null)?.from
      const target = await homeFor(s.role, next)
      if (target === '/logowanie') {
        await api.signOut()
        throw new Error('To konto nie ma jeszcze przypisanych ankiet. Skontaktuj się ze mną.')
      }
      nav(target, { replace: true })
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
        <span className="tag">{isClient ? 'Strefa klienta' : 'Panel NAFU Design'}</span>
      </div>

      <div className="lg-stage">
        <div className="lg-glow" aria-hidden />
        <img src="/brand/kv-desk.webp" alt="" className="lg-kv" />
        <div className="lg-claim">
          {isClient ? (
            <>
              <h1>
                Pierwszy krok do Twojej <em>nowej strony</em>
              </h1>
              <p>Zaloguj się, żeby wypełnić ankiety. Twoje odpowiedzi zapisują się na bieżąco i widzisz je tylko Ty i ja.</p>
            </>
          ) : (
            <>
              <h1>
                Briefy klientów <em>w jednym</em> miejscu.
              </h1>
              <p>Ankiety, odpowiedzi i podsumowania AI dla każdego projektu.</p>
            </>
          )}
        </div>
      </div>

      <form className="lg-card" onSubmit={submit}>
        <div>
          <div className="eyebrow">{isClient ? 'Strefa klienta NAFU Design' : 'Panel NAFU Brief'}</div>
          <h2>{isClient ? 'Zaloguj się' : 'Witaj z powrotem'}</h2>
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
        {isClient && (
          <p className="note">
            Nie pamiętasz hasła? Zadzwoń pod {CONTACT.phone} albo napisz na {CONTACT.email}, ustawię nowe.
          </p>
        )}
        <div className="lg-foot">
          <span>{CONTACT.names}</span>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </div>
      </form>
    </div>
  )
}
