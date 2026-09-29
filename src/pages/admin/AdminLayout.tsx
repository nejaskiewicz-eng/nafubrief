import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CONTACT, Icon, Loading } from '../../components/ui'
import { api } from '../../lib/api'
import { isDemo, supabase } from '../../lib/supabase'

export default function AdminLayout() {
  const [session, setSession] = useState<{ email: string } | null | undefined>(undefined)
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    api.session().then(setSession)
    const sub = supabase?.auth.onAuthStateChange((_e, s) => setSession(s ? { email: s.user.email ?? '' } : null))
    return () => sub?.data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Loading />
  if (session === null) return <Navigate to="/login" replace state={{ from: loc.pathname }} />

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
