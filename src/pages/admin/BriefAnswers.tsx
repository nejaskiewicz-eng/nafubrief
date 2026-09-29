import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon, Spinner, StatusBadge, copyText, downloadFile, fmtDate, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { answerToText, briefToMarkdown, isVisible, surveyProgress } from '../../lib/format'
import { renderMarkdown } from '../../lib/markdown'
import type { Brief, Client, PublicBrief } from '../../lib/types'
import { templateByKey } from '../../templates'
import { BriefForm } from '../client/BriefForm'

export default function BriefAnswers() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [hideEmpty, setHideEmpty] = useState(false)

  useEffect(() => {
    api.getBrief(id).then(async (b) => {
      setBrief(b)
      setClient(await api.getClient(b.client_id))
    })
  }, [id])

  if (!brief || !client) return <Spinner />

  const p = surveyProgress(brief.schema, brief.answers)
  const md = briefToMarkdown(`${brief.title}: ${client.company || client.name}`, brief.schema, brief.answers, { includeEmpty: true })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs no-print">
            <Link to="/panel">Klienci</Link> <span>/</span>
            <Link to={`/panel/klient/${client.id}`}>{client.company || client.name}</Link> <span>/</span>
          </div>
          <h1>{brief.title}</h1>
          <div className="row muted" style={{ fontSize: 14, marginTop: 8 }}>
            <StatusBadge status={brief.status} />
            <span>
              Odpowiedzi: {p.done}/{p.total} ({p.pct}%)
            </span>
            {brief.submitted_at && <span>Wysłano: {fmtDate(brief.submitted_at)}</span>}
          </div>
        </div>
        <div className="row no-print">
          <label className="switch">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Ukryj puste
          </label>
          <button className="btn btn-sm" onClick={() => copyText(md).then(() => toast('Skopiowano jako Markdown'))}>
            <Icon name="copy" size={15} /> Kopiuj
          </button>
          <button className="btn btn-sm" onClick={() => downloadFile(`${brief.template_key}-${client.id.slice(0, 6)}.md`, md)}>
            <Icon name="download" size={15} /> .md
          </button>
          <button className="btn btn-sm" onClick={() => window.print()}>
            <Icon name="print" size={15} /> PDF
          </button>
        </div>
      </div>

      <div className="card answers">
        {brief.schema.sections.map((s, si) => {
          const qs = s.questions.filter((q) => isVisible(q, brief.answers, brief.schema))
          const rows = qs.map((q) => ({ q, a: answerToText(q, brief.answers) })).filter((r) => !hideEmpty || r.a)
          if (!rows.length) return null
          return (
            <section className="ans-section" key={s.id}>
              <h2>
                {si + 1}. {s.title}
              </h2>
              {rows.map(({ q, a }) => (
                <div className="ans-q" key={q.id}>
                  <div className="qq">{q.label}</div>
                  {a ? (
                    <div className="aa md" dangerouslySetInnerHTML={{ __html: renderMarkdown(a) }} />
                  ) : (
                    <div className="aa none">brak odpowiedzi</div>
                  )}
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </>
  )
}

/** Podgląd ankiety oczami klienta (bez zapisu) */
export function BriefPreview() {
  const { id = '', key = '' } = useParams()
  const [data, setData] = useState<PublicBrief | null>(null)

  useEffect(() => {
    if (key) {
      const t = templateByKey(key)
      if (t) setData({ status: 'sent', title: t.title, description: t.description, intro: t.intro, schema: t.schema, answers: {}, client_name: 'Twój klient', submitted_at: null })
      return
    }
    api.getBrief(id).then(async (b) => {
      const c = await api.getClient(b.client_id)
      setData({ status: 'sent', title: b.title, description: b.description, intro: b.intro, schema: b.schema, answers: {}, client_name: c.company || c.name, submitted_at: null })
    })
  }, [id, key])

  if (!data) return <Spinner />
  return (
    <>
      <div className="no-print" style={{ position: 'fixed', top: 12, right: 12, zIndex: 60 }}>
        <button className="btn btn-dark btn-sm" onClick={() => history.back()}>
          <Icon name="back" size={15} /> Zamknij podgląd
        </button>
      </div>
      <BriefForm data={data} preview />
    </>
  )
}
