import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CONTACT, Loading, StatusBadge, TEMPLATE_COLORS, TEMPLATE_LETTER } from '../../components/ui'
import { api } from '../../lib/api'
import type { Brief, BriefStatus, Client, PublicPortal } from '../../lib/types'
import { ClientChrome, useClientCtx } from './ClientArea'
import { Notice } from './BriefForm'
import Start from '../../workspace/Start'

type Row = { title: string; description: string | null; slug: string; template_key: string; status?: BriefStatus; urgent?: boolean }
type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ok'; name: string; slug: string; rows: Row[]; email?: string; mine?: Client; briefs?: Brief[] }

export default function Portal() {
  const { client = '' } = useParams()
  const { session, mine } = useClientCtx()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (session && mine) {
        const briefs: Brief[] = await api.myBriefs(mine.id)
        // pilne na górze, wysłane na końcu
        const order = (b: Brief) => (b.status === 'submitted' ? 2 : b.urgent ? 0 : 1)
        briefs.sort((a, b) => order(a) - order(b))
        if (alive)
          setState({
            kind: 'ok',
            name: mine.company || mine.name,
            slug: mine.slug,
            email: session.email,
            mine,
            briefs,
            rows: briefs.map((b) => ({ title: b.title, description: b.description, slug: b.slug, template_key: b.template_key, status: b.status, urgent: b.urgent })),
          })
        return
      }
      const pub: PublicPortal | null = await api.publicPortal(client).catch(() => null)
      if (!alive) return
      setState(pub ? { kind: 'ok', name: pub.client_name, slug: pub.client_slug, rows: pub.briefs } : { kind: 'missing' })
    })()
    return () => {
      alive = false
    }
  }, [client, session, mine])

  if (state.kind === 'loading') return <Loading />
  if (state.kind === 'missing') return <Notice title="Nie znaleziono strony" text="Link może być niepełny lub nieaktualny. Skontaktuj się ze mną, wyślę nowy." />

  const loggedIn = !!state.email
  const done = state.rows.filter((r) => r.status === 'submitted').length
  const loginHref = `/logowanie?next=${encodeURIComponent(`/${state.slug}`)}`
  const urgentOpen = state.rows.filter((r) => r.urgent && r.status !== 'submitted').length

  if (loggedIn && state.mine)
    return (
      <ClientChrome email={state.email!} client={state.mine}>
        <div className="ws">
          <Start client={state.mine} briefs={state.briefs ?? []} isAdmin={false} />
          <section className="card ws-card">
            <h2>Ankiety</h2>
            <p className="muted ws-lead">
              Wysłano <strong>{done}</strong> z {state.rows.length}.{' '}
              {urgentOpen > 0 && <strong style={{ color: 'var(--danger)' }}>Pilne do wypełnienia: {urgentOpen}.</strong>}
            </p>
          </section>
          <List rows={state.rows} slug={state.slug} loggedIn />
          <p className="muted" style={{ fontSize: 14.5, margin: 0 }}>
            Ankiety możesz wypełniać w kilku podejściach, wszystko zapisuje się na Twoim koncie. W zakładkach powyżej uzupełnisz profil firmy, wgrasz zdjęcia i pliki, dodasz zespół i usługi.
          </p>
        </div>
      </ClientChrome>
    )

  return (
    <>
      <header className="brand-band">
        <div className="wrap" style={{ padding: '24px 0 40px' }}>
          <div className="f-top">
            <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
            <div className="contact">
                <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              </div>

          </div>
          <div className="eyebrow" style={{ color: 'var(--teal)' }}>
            Brief projektu
          </div>
          <h1 style={{ fontSize: 'clamp(30px,4.5vw,48px)', marginTop: 10 }}>{state.name}</h1>
            <>
              <p style={{ color: 'rgba(255,255,255,.82)', fontWeight: 300, fontSize: 18, maxWidth: '60ch' }}>
                Poniżej możesz przejrzeć pytania. Żeby je wypełnić, zaloguj się na konto, które dla Ciebie założyłam. Dane logowania znajdziesz w wiadomości ode mnie.
              </p>
              <Link className="btn btn-primary" to={loginHref} style={{ minHeight: 50, padding: '12px 28px' }}>
                Zaloguj się, aby wypełnić
              </Link>
            </>
        </div>
      </header>
      <main className="wrap" style={{ padding: '32px 0 48px' }}>
        <List rows={state.rows} slug={state.slug} loggedIn={false} />
        <footer className="page-foot" style={{ marginTop: 40 }}>
          <span>
            © {new Date().getFullYear()} NAFU Design · {CONTACT.names} · {CONTACT.city}
          </span>
          <span className="row">
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </span>
        </footer>
      </main>
    </>
  )
}

function List({ rows, slug, loggedIn }: { rows: Row[]; slug: string; loggedIn: boolean }) {
  return (
    <div className="card">
      {rows.map((b) => (
        <div className={`brief-row${b.urgent && b.status !== 'submitted' ? ' is-urgent' : ''}`} key={b.slug}>
          <div className="brief-icon" style={{ background: TEMPLATE_COLORS[b.template_key] ?? TEMPLATE_COLORS.strategy }}>
            {TEMPLATE_LETTER[b.template_key] ?? '•'}
          </div>
          <div>
            <h3>{b.title}</h3>
            {b.description && <p className="muted" style={{ margin: '4px 0 0', fontSize: 14.5 }}>{b.description}</p>}
            {(b.status || b.urgent) && (
              <div className="meta">
                {b.urgent && b.status !== 'submitted' && <span className="badge urgent">Pilne</span>}
                {b.status && <StatusBadge status={b.status} />}
              </div>
            )}
          </div>
          <div className="actions">
            {loggedIn ? (
              <Link className={`btn ${b.status === 'submitted' ? '' : 'btn-primary'}`} to={`/${slug}/${b.slug}`}>
                {b.status === 'submitted' ? 'Zobacz' : b.status === 'in_progress' ? 'Kontynuuj' : 'Wypełnij'}
              </Link>
            ) : (
              <Link className="btn" to={`/${slug}/${b.slug}`}>
                Zobacz pytania
              </Link>
            )}
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="muted" style={{ padding: 24 }}>Ankiety są jeszcze przygotowywane.</p>}
    </div>
  )
}
