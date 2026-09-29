import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CONTACT, Icon, Loading } from '../../components/ui'
import { api, type Session } from '../../lib/api'
import { homeFor } from './Login'
import { isDemo, supabase } from '../../lib/supabase'

export default function AdminLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [clientHome, setClientHome] = useState<string | null>(null)
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    api.session().then(setSession)
    const sub = supabase?.auth.onAuthStateChange((e) => {
      if (e === 'SIGNED_OUT') setSession(null)
    })
    return () => sub?.data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Loading />
  if (session === null) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  // konto klienta nie ma wstępu do panelu
  if (session.role === 'client') {
    if (!clientHome) {
      homeFor('client').then(setClientHome)
      return <Loading />
    }
    return (
      <div className="lg pw-screen">
        <div className="lg-card pw-card">
          <img src="/brand/logo-outline.webp" alt="NAFU design" style={{ height: 56, width: 'auto', justifySelf: 'start' }} />
          <div>
            <div className="eyebrow">Panel NAFU Brief</div>
            <h2>Jesteś zalogowana na koncie klienta</h2>
          </div>
          <p className="note" style={{ fontSize: 14.5, color: 'rgba(255,255,255,.85)' }}>
            W tej przeglądarce jest teraz zalogowane konto <strong style={{ color: '#fff' }}>{session.email}</strong>. Panel administratora wymaga Twojego konta. Wszystkie dane klientów są bezpieczne.
          </p>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await api.signOut()
              setSession(null)
              nav('/login')
            }}
          >
            Wyloguj i zaloguj się jako administrator
          </button>
          <button className="btn btn-outline-light" onClick={() => nav(clientHome)}>
            Przejdź do strefy tego klienta
          </button>
          <p className="note">Konta klientów najlepiej testować w oknie prywatnym przeglądarki. Wtedy nie wylogowujesz się z panelu.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {isDemo && <div className="demo-banner">Tryb demo: dane zapisują się tylko w tej przeglądarce. Podłącz Supabase, aby działało naprawdę (instrukcja w README).</div>}
      <div className="admin">
        <aside className="admin-side brand-band">
          <NavLink to="/panel">
            <img src="/brand/logo-outline.webp" alt="Panel NAFU design" className="logo" />
          </NavLink>
          <nav>
            <NavLink to="/panel" end>
              <Icon name="users" /> Klienci
            </NavLink>
            <NavLink to="/panel/szablony">
              <Icon name="doc" /> Szablony ankiet
            </NavLink>
          </nav>
          <div className="side-foot">
            <img src="/brand/badge-arc.webp" alt="" />
            <span>{session.email !== 'demo' ? session.email : CONTACT.email}</span>
            <button
              className="btn btn-outline-light btn-sm"
              style={{ justifySelf: 'start' }}
              onClick={async () => {
                await api.signOut()
                setSession(null)
                nav('/login')
              }}
            >
              <Icon name="logout" size={15} /> Wyloguj
            </button>
          </div>
        </aside>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </>
  )
}
