import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CONTACT, Loading, StatusBadge, TEMPLATE_COLORS, TEMPLATE_LETTER } from '../../components/ui'
import { api } from '../../lib/api'
import type { PublicPortal } from '../../lib/types'
import { Notice } from './BriefForm'

export default function Portal() {
  const { token = '' } = useParams()
  const [data, setData] = useState<PublicPortal | null | undefined>(undefined)

  useEffect(() => {
    api.portal(token).then(setData).catch(() => setData(null))
  }, [token])

  if (data === undefined) return <Loading />
  if (data === null) return <Notice title="Nie znaleziono strony" text="Link może być niepełny lub nieaktualny. Skontaktuj się ze mną — wyślę nowy." />

  const done = data.briefs.filter((b) => b.status === 'submitted').length

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
          <h1 style={{ fontSize: 'clamp(30px,4.5vw,48px)', marginTop: 10 }}>{data.client_name}</h1>
          <p style={{ color: 'rgba(255,255,255,.78)', fontWeight: 300, fontSize: 18, maxWidth: '60ch' }}>
            Przygotowałam dla Ciebie kilka krótkich ankiet. Możesz wypełniać je w dowolnej kolejności i w kilku podejściach — wszystko zapisuje się automatycznie.
          </p>
          <p style={{ color: 'var(--teal)', fontWeight: 600, marginBottom: 0 }}>
            Wysłano {done} z {data.briefs.length}
          </p>
        </div>
      </header>
      <main className="wrap" style={{ padding: '32px 0 48px' }}>
        <div className="card">
          {data.briefs.map((b) => (
            <div className="brief-row" key={b.token}>
              <div className="brief-icon" style={{ background: TEMPLATE_COLORS[b.template_key] ?? TEMPLATE_COLORS.strategy }}>
                {TEMPLATE_LETTER[b.template_key] ?? '•'}
              </div>
              <div>
                <h3>{b.title}</h3>
                {b.description && <p className="muted" style={{ margin: '4px 0 0', fontSize: 14.5 }}>{b.description}</p>}
                <div className="meta">
                  <StatusBadge status={b.status} />
                </div>
              </div>
              <div className="actions">
                <Link className={`btn ${b.status === 'submitted' ? '' : 'btn-primary'}`} to={`/b/${b.token}`}>
                  {b.status === 'submitted' ? 'Zobacz' : b.status === 'in_progress' ? 'Kontynuuj' : 'Wypełnij'}
                </Link>
              </div>
            </div>
          ))}
          {data.briefs.length === 0 && <p className="muted" style={{ padding: 24 }}>Ankiety są jeszcze przygotowywane.</p>}
        </div>
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
