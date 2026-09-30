import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { CONTACT, Loading } from '../../components/ui'
import { api, type Session } from '../../lib/api'
import type { Client } from '../../lib/types'
import { unreadCount } from '../../lib/workspace'
import Access from '../../workspace/Access'
import Documents from '../../workspace/Documents'
import Media from '../../workspace/Media'
import Preview from '../../workspace/Preview'
import Messages from '../../workspace/Messages'
import Profile from '../../workspace/Profile'
import Services from '../../workspace/Services'
import Team from '../../workspace/Team'
import { AccountBar } from './BriefForm'

export interface ClientCtx {
  session: Session | null
  /** firma zalogowanego klienta, jeśli adres należy do niej */
  mine: Client | null
}

export const useClientCtx = () => useOutletContext<ClientCtx>()

/** Wspólny układ wszystkich adresów /:client/... */
export default function ClientArea() {
  const { client = '' } = useParams()
  const [ctx, setCtx] = useState<ClientCtx | null>(null)

  const load = useCallback(async () => {
    const session = await api.session()
    let mine: Client | null = null
    if (session?.role === 'client') {
      const c = await api.myClient()
      if (c?.slug === client) mine = c
    }
    setCtx({ session, mine })
  }, [client])

  useEffect(() => {
    load()
  }, [load])

  if (!ctx) return <Loading />
  // pierwsze logowanie albo hasło nadane przez administratorkę: najpierw własne hasło
  if (ctx.session?.role === 'client' && ctx.session.mustChangePassword) return <SetPassword onDone={load} />
  return (
    <>
      {ctx.session?.preview && (
        <div className="preview-bar">
          Tryb sprawdzania konta: zmiana hasła wyłączona tymczasowo. Nie wypełniaj ankiet. Po wylogowaniu wymuszenie wróci.
        </div>
      )}
      <Outlet context={ctx} />
    </>
  )
}

const TABS: Array<[string, string]> = [
  ['', 'Start'],
  ['podglad', 'Podgląd strony'],
  ['profil', 'Profil firmy'],
  ['media', 'Baza mediów'],
  ['zespol', 'Zespół'],
  ['uslugi', 'Usługi'],
  ['dostepy', 'Dostępy'],
  ['dokumenty', 'Dokumenty'],
  ['wiadomosci', 'Wiadomości'],
]

/** Nagłówek z zakładkami dla zalogowanego klienta */
export function ClientChrome({ children, email, client }: { children: ReactNode; email: string; client: Client }) {
  const [unread, setUnread] = useState(0)
  const loc = useLocation()
  const [menu, setMenu] = useState(false)
  const section = loc.pathname.split('/')[2] ?? ''
  const current = TABS.find(([p]) => p === section) ?? TABS[0]
  useEffect(() => setMenu(false), [loc.pathname])
  useEffect(() => {
    unreadCount(client.id, false).then(setUnread).catch(() => {})
  }, [client.id, loc.pathname])

  return (
    <>
      <header className="brand-band cz-head">
        <div className="wrap">
          <div className="f-top" style={{ marginBottom: 0 }}>
            <Link to={`/${client.slug}`}>
              <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
            </Link>
            <AccountBar email={email} />
          </div>
          <div className="eyebrow" style={{ color: 'var(--teal)', marginTop: 18 }}>
            Strefa klienta
          </div>
          <h1>{client.company || client.name}</h1>
          <nav className={`cz-nav${menu ? ' is-open' : ''}`} aria-label="Strefa klienta">
            <button className="cz-menu-btn" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <span className="cz-menu-icon" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span>
                <small>Menu · {TABS.length} sekcji</small>
                {current[1]}
              </span>
              {unread > 0 && current[0] !== 'wiadomosci' && <span className="dotn">{unread}</span>}
            </button>
            <div className="cz-tabs">
              {TABS.map(([path, label]) => (
                <NavLink key={path} to={`/${client.slug}${path ? `/${path}` : ''}`} end>
                  {label}
                  {path === 'wiadomosci' && unread > 0 && <span className="dotn">{unread}</span>}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className="wrap cz-main">{children}</main>
      <footer className="wrap page-foot">
        <span>
          © {new Date().getFullYear()} NAFU Design · {CONTACT.names} · {CONTACT.city}
        </span>
        <span className="row">
          <a href="/poradnik.pdf" target="_blank" rel="noopener">
            Poradnik (PDF)
          </a>
          <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </span>
      </footer>
    </>
  )
}

/** Zakładki strefy klienta (tylko po zalogowaniu) */
export function ClientTab({ tab }: { tab: 'podglad' | 'profil' | 'media' | 'zespol' | 'uslugi' | 'dostepy' | 'dokumenty' | 'wiadomosci' }) {
  const { client = '' } = useParams()
  const { session, mine } = useClientCtx()
  if (!session || !mine) return <Navigate to={`/logowanie?next=${encodeURIComponent(`/${client}/${tab}`)}`} replace />
  return (
    <ClientChrome email={session.email} client={mine}>
      {tab === 'podglad' && <Preview client={mine} isAdmin={false} />}
      {tab === 'dostepy' && <Access clientId={mine.id} isAdmin={false} />}
      {tab === 'dokumenty' && <Documents client={mine} isAdmin={false} />}
      {tab === 'profil' && <Profile clientId={mine.id} />}
      {tab === 'media' && <Media clientId={mine.id} />}
      {tab === 'zespol' && <Team clientId={mine.id} />}
      {tab === 'uslugi' && <Services clientId={mine.id} />}
      {tab === 'wiadomosci' && <Messages clientId={mine.id} isAdmin={false} />}
    </ClientChrome>
  )
}

function SetPassword({ onDone }: { onDone: () => Promise<void> }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return setErr('Hasło musi mieć co najmniej 8 znaków.')
    if (pw !== pw2) return setErr('Hasła nie są takie same.')
    setBusy(true)
    try {
      await api.changePassword(pw)
      await onDone()
    } catch (e2) {
      setErr((e2 as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="lg pw-screen">
      <form className="lg-card pw-card" onSubmit={submit}>
        <img src="/brand/logo-outline.webp" alt="NAFU design" style={{ height: 56, width: 'auto', justifySelf: 'start' }} />
        <div>
          <div className="eyebrow">Pierwsze logowanie</div>
          <h2>Ustaw własne hasło</h2>
        </div>
        <p className="note" style={{ fontSize: 14.5, color: 'rgba(255,255,255,.8)' }}>
          Hasło, które ode mnie dostałaś lub dostałeś, było tymczasowe. Ustaw teraz własne. Tylko Ty będziesz je znać.
        </p>
        <label className="field">
          <span className="label">Nowe hasło (co najmniej 8 znaków)</span>
          <input className="input" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Powtórz nowe hasło</span>
          <input className="input" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        {err && (
          <p className="err" role="alert">
            {err}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Zapisuję…' : 'Zapisz i przejdź dalej'}
        </button>
      </form>
    </div>
  )
}
