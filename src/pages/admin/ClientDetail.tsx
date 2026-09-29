import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CONTACT, Icon, Modal, Spinner, StatusBadge, TEMPLATE_COLORS, TEMPLATE_LETTER,
  copyText, downloadFile, fmtDate, useToast,
} from '../../components/ui'
import { api, briefLink, portalLink, type ClientInput } from '../../lib/api'
import { surveyProgress } from '../../lib/format'
import { renderMarkdown } from '../../lib/markdown'
import type { Brief, Client, Summary, TemplateKey } from '../../lib/types'
import { TemplatePicker } from './Dashboard'

type Tab = 'briefs' | 'ai' | 'data'

export default function ClientDetail() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [briefs, setBriefs] = useState<Brief[] | null>(null)
  const [tab, setTab] = useState<Tab>('briefs')

  const reload = useCallback(async () => {
    const [c, b] = await Promise.all([api.getClient(id), api.listBriefs(id)])
    setClient(c)
    setBriefs(b)
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (!client || !briefs) return <Spinner />

  const submitted = briefs.filter((b) => b.status === 'submitted').length

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link to="/panel">Klienci</Link> <span>/</span>
          </div>
          <h1>{client.company || client.name}</h1>
          <div className="row muted" style={{ fontSize: 14.5, marginTop: 6 }}>
            {client.company && <span>{client.name}</span>}
            {client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}
            {client.phone && <a href={`tel:${client.phone}`}>{client.phone}</a>}
            {client.industry && <span>{client.industry}</span>}
          </div>
        </div>
        <div className="row">
          <span className="muted" style={{ fontSize: 14 }}>
            Wypełnione: <strong style={{ color: 'var(--ink)' }}>{submitted}/{briefs.length}</strong>
          </span>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'briefs'} className={tab === 'briefs' ? 'on' : ''} onClick={() => setTab('briefs')}>
          Ankiety i linki
        </button>
        <button role="tab" aria-selected={tab === 'ai'} className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>
          Podsumowanie AI
        </button>
        <button role="tab" aria-selected={tab === 'data'} className={tab === 'data' ? 'on' : ''} onClick={() => setTab('data')}>
          Dane klienta
        </button>
      </div>

      {tab === 'briefs' && <BriefsTab client={client} briefs={briefs} reload={reload} />}
      {tab === 'ai' && <AiTab client={client} briefs={briefs} />}
      {tab === 'data' && <DataTab client={client} onSaved={reload} />}
    </>
  )
}

/* ------------------------------------------------------------------ */

function BriefsTab({ client, briefs, reload }: { client: Client; briefs: Brief[]; reload: () => Promise<void> }) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [sharing, setSharing] = useState(false)
  const drafts = briefs.filter((b) => b.status === 'draft')
  const live = briefs.filter((b) => b.status !== 'draft')

  const publish = async () => {
    await api.publishBriefs(client.id)
    await reload()
    toast('Linki są aktywne')
    setSharing(true)
  }

  return (
    <div className="two-col">
      <div className="stack">
        {drafts.length > 0 && (
          <div className="panel-dark brand-band">
            <div className="eyebrow" style={{ color: 'var(--teal)' }}>
              Krok 1 z 2
            </div>
            <h2 style={{ marginTop: 8 }}>Sprawdź pytania w {drafts.length === 1 ? 'ankiecie' : `${drafts.length} ankietach`}</h2>
            <p style={{ margin: '8px 0 18px' }}>
              Szkice nie są jeszcze widoczne dla klienta. Otwórz każdą ankietę, dopasuj, usuń lub dodaj pytania, a potem zatwierdź, żeby linki zaczęły działać.
            </p>
            <button className="btn btn-primary" onClick={publish}>
              Zatwierdź i wygeneruj linki
            </button>
          </div>
        )}

        <div className="card">
          {briefs.map((b) => (
            <BriefRow key={b.id} b={b} reload={reload} />
          ))}
          {briefs.length === 0 && <p className="muted" style={{ padding: 24, margin: 0 }}>Ten klient nie ma jeszcze ankiet.</p>}
        </div>
        <div>
          <button className="btn" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Dodaj ankietę
          </button>
        </div>
      </div>

      <aside className="stack">
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow">{drafts.length ? 'Krok 2 z 2' : 'Wysyłka'}</div>
          <h3 style={{ fontSize: 20, margin: '8px 0 6px', color: 'var(--ink)' }}>Link dla klienta</h3>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            Jeden link do wszystkich ankiet. Klient wypełnia je w dowolnej kolejności.
          </p>
          {live.length ? (
            <>
              <div className="link-box">
                <span>{portalLink(client.portal_token)}</span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => copyText(portalLink(client.portal_token)).then(() => toast('Skopiowano link'))}
                >
                  <Icon name="copy" size={15} /> Kopiuj
                </button>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setSharing(true)}>
                <Icon name="mail" size={15} /> Wiadomość do klienta
              </button>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>Link pojawi się po zatwierdzeniu ankiet.</p>
          )}
        </div>
      </aside>

      {adding && (
        <AddBriefsModal
          existing={briefs.map((b) => b.template_key as TemplateKey)}
          onClose={() => setAdding(false)}
          onAdd={async (keys) => {
            await api.addBriefs(client.id, keys)
            await reload()
            setAdding(false)
            toast('Dodano ankiety jako szkice')
          }}
        />
      )}
      {sharing && <ShareModal client={client} briefs={live} onClose={() => setSharing(false)} />}
    </div>
  )
}

function BriefRow({ b, reload }: { b: Brief; reload: () => Promise<void> }) {
  const toast = useToast()
  const p = surveyProgress(b.schema, b.answers)
  const qs = b.schema.sections.reduce((n, s) => n + s.questions.length, 0)
  return (
    <div className="brief-row">
      <div className="brief-icon" style={{ background: TEMPLATE_COLORS[b.template_key] ?? TEMPLATE_COLORS.strategy }}>
        {TEMPLATE_LETTER[b.template_key] ?? '•'}
      </div>
      <div style={{ minWidth: 0 }}>
        <h3>{b.title}</h3>
        <div className="meta">
          <StatusBadge status={b.status} />
          <span>
            {b.schema.sections.length} części · {qs} pytań
          </span>
          {b.status !== 'draft' && <span>odpowiedzi: {p.pct}%</span>}
          {b.submitted_at && <span>wysłano {fmtDate(b.submitted_at)}</span>}
        </div>
      </div>
      <div className="actions">
        {b.status === 'draft' ? (
          <Link className="btn btn-sm btn-primary" to={`/panel/ankieta/${b.id}/edycja`}>
            <Icon name="edit" size={15} /> Sprawdź pytania
          </Link>
        ) : (
          <Link className="btn btn-sm btn-primary" to={`/panel/ankieta/${b.id}`}>
            <Icon name="doc" size={15} /> Odpowiedzi
          </Link>
        )}
        {b.status !== 'draft' && (
          <Link className="btn btn-sm" to={`/panel/ankieta/${b.id}/edycja`}>
            <Icon name="edit" size={15} /> Pytania
          </Link>
        )}
        <Link className="btn btn-sm" to={`/panel/ankieta/${b.id}/podglad`} title="Podgląd jak u klienta">
          <Icon name="eye" size={15} /> Podgląd
        </Link>
        {b.status !== 'draft' && (
          <button className="btn btn-sm" title="Kopiuj link do tej ankiety" onClick={() => copyText(briefLink(b.token)).then(() => toast('Skopiowano link do ankiety'))}>
            <Icon name="link" size={15} /> Link
          </button>
        )}
        {b.status === 'submitted' && (
          <button
            className="btn btn-sm"
            title="Pozwól klientowi poprawić odpowiedzi"
            onClick={async () => {
              await api.reopenBrief(b.id)
              await reload()
              toast('Klient może ponownie edytować ankietę')
            }}
          >
            <Icon name="unlock" size={15} /> Odblokuj
          </button>
        )}
        <button
          className="btn btn-sm btn-danger"
          title="Usuń ankietę"
          onClick={async () => {
            if (!confirm(`Usunąć „${b.title}”${b.status === 'submitted' ? ' razem z odpowiedziami klienta' : ''}?`)) return
            await api.deleteBrief(b.id)
            await reload()
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
    </div>
  )
}

function AddBriefsModal({ existing, onClose, onAdd }: { existing: TemplateKey[]; onClose: () => void; onAdd: (k: TemplateKey[]) => Promise<void> }) {
  const [picked, setPicked] = useState<TemplateKey[]>([])
  const [busy, setBusy] = useState(false)
  return (
    <Modal label="Dodaj ankietę" onClose={onClose}>
      <div className="eyebrow">Dodaj ankietę</div>
      <h2 style={{ marginTop: 8, marginBottom: 16 }}>Wybierz szablony</h2>
      {existing.length > 0 && <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>Możesz dodać ten sam szablon ponownie, np. osobną ankietę dla drugiej firmy klienta.</p>}
      <TemplatePicker picked={picked} onChange={setPicked} />
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          disabled={!picked.length || busy}
          onClick={async () => {
            setBusy(true)
            await onAdd(picked)
          }}
        >
          Dodaj {picked.length || ''}
        </button>
      </div>
    </Modal>
  )
}

function ShareModal({ client, briefs, onClose }: { client: Client; briefs: Brief[]; onClose: () => void }) {
  const toast = useToast()
  const first = client.name.split(' ')[0]
  const message = `Dzień dobry${first ? ` ${first}` : ''},

przygotowałam dla Ciebie krótki brief do projektu strony. Wszystkie ankiety znajdziesz pod jednym linkiem:
${portalLink(client.portal_token)}

${briefs.map((b) => `• ${b.title}: ${briefLink(b.token)}`).join('\n')}

Możesz wypełniać je w kilku podejściach, odpowiedzi zapisują się automatycznie. Jeśli czegoś nie wiesz, zostaw puste, omówimy to razem.

W razie pytań jestem pod telefonem ${CONTACT.phone} i mailem ${CONTACT.email}.

Pozdrawiam serdecznie
Natalia Jaśkiewicz
NAFU Design`
  const mailto = `mailto:${client.email ?? ''}?subject=${encodeURIComponent('Brief projektu strony, NAFU Design')}&body=${encodeURIComponent(message)}`

  return (
    <Modal label="Wiadomość do klienta" onClose={onClose}>
      <div className="eyebrow">Wysyłka</div>
      <h2 style={{ marginTop: 8 }}>Wiadomość z linkami</h2>
      <p className="muted" style={{ marginTop: 4 }}>Skopiuj i wyślij e-mailem, SMS-em lub w komunikatorze.</p>
      <textarea className="textarea" style={{ minHeight: 300, fontSize: 14 }} defaultValue={message} id="share-msg" />
      <div className="modal-actions">
        {client.email && (
          <a className="btn" href={mailto}>
            <Icon name="mail" size={16} /> Otwórz w poczcie
          </a>
        )}
        <button
          className="btn btn-primary"
          onClick={() => {
            const v = (document.getElementById('share-msg') as HTMLTextAreaElement).value
            copyText(v).then(() => toast('Skopiowano wiadomość'))
          }}
        >
          <Icon name="copy" size={16} /> Kopiuj wiadomość
        </button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function AiTab({ client, briefs }: { client: Client; briefs: Brief[] }) {
  const toast = useToast()
  const [list, setList] = useState<Summary[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [instructions, setInstructions] = useState('')
  const poll = useRef<number>(undefined)

  const load = useCallback(async () => {
    const s = await api.listSummaries(client.id)
    setList(s)
    setActiveId((cur) => cur ?? s[0]?.id ?? null)
    clearTimeout(poll.current)
    if (s.some((x) => x.status === 'pending')) poll.current = window.setTimeout(load, 4000)
  }, [client.id])

  useEffect(() => {
    load()
    return () => clearTimeout(poll.current)
  }, [load])

  const withAnswers = briefs.filter((b) => Object.keys(b.answers).length > 0)
  const active = list?.find((s) => s.id === activeId)

  const run = async () => {
    try {
      const id = await api.requestSummary(client.id, instructions)
      setActiveId(id)
      toast('Agent AI pracuje, to potrwa 1-3 minuty')
      await load()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="two-col">
      <div className="card" style={{ padding: '28px 32px', minHeight: 300 }}>
        {!active ? (
          <div className="empty">
            <img src="/brand/kv-desk.webp" alt="" style={{ borderRadius: 20 }} />
            <h3>Podsumowanie, wnioski i konspekt pracy</h3>
            <p className="muted" style={{ margin: 0, maxWidth: 480 }}>
              Agent AI przeczyta wszystkie odpowiedzi klienta i przygotuje: profil klienta, kluczowe wnioski, zakres strony, listę dokumentów prawnych, braki do dopytania i plan pracy.
            </p>
          </div>
        ) : active.status === 'pending' ? (
          <div className="empty">
            <Spinner />
            <h3>Agent analizuje odpowiedzi…</h3>
            <p className="muted" style={{ margin: 0 }}>Zwykle trwa to 1-3 minuty. Możesz zostawić tę stronę.</p>
          </div>
        ) : active.status === 'error' ? (
          <div className="empty">
            <h3>Nie udało się przygotować podsumowania</h3>
            <p className="muted" style={{ margin: 0 }}>{active.error}</p>
          </div>
        ) : (
          <>
            <div className="row no-print" style={{ marginBottom: 18 }}>
              <span className="muted" style={{ fontSize: 13.5 }}>
                {fmtDate(active.created_at)} · {active.model}
              </span>
              <span className="spacer" />
              <button className="btn btn-sm" onClick={() => copyText(active.content ?? '').then(() => toast('Skopiowano Markdown'))}>
                <Icon name="copy" size={15} /> Kopiuj
              </button>
              <button className="btn btn-sm" onClick={() => downloadFile(`${slug(client.company || client.name)}-podsumowanie.md`, active.content ?? '')}>
                <Icon name="download" size={15} /> .md
              </button>
              <button className="btn btn-sm" onClick={() => window.print()}>
                <Icon name="print" size={15} /> PDF
              </button>
            </div>
            <article className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(active.content ?? '') }} />
          </>
        )}
      </div>

      <aside className="stack no-print">
        <div className="panel-dark brand-band">
          <div className="eyebrow" style={{ color: 'var(--teal)' }}>
            Agent AI
          </div>
          <h2 style={{ marginTop: 8 }}>Nowe podsumowanie</h2>
          <p style={{ fontSize: 14 }}>
            Ankiety z odpowiedziami: <strong style={{ color: '#fff' }}>{withAnswers.length}</strong> z {briefs.length}
          </p>
          <textarea
            className="textarea"
            style={{ minHeight: 90, fontSize: 14 }}
            placeholder="Dodatkowe wskazówki dla agenta (opcjonalnie), np. „skup się na ofercie dla dzieci”"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} disabled={!withAnswers.length || list?.some((s) => s.status === 'pending')} onClick={run}>
            <Icon name="sparkle" /> Generuj
          </button>
        </div>

        {list && list.length > 0 && (
          <div className="card" style={{ padding: 8 }}>
            {list.map((s) => (
              <div key={s.id} className="row" style={{ padding: '6px 8px' }}>
                <button className={`btn btn-sm ${s.id === activeId ? 'btn-dark' : 'btn-ghost'}`} style={{ flex: 1, justifyContent: 'flex-start' }} onClick={() => setActiveId(s.id)}>
                  {fmtDate(s.created_at)}
                  {s.status === 'pending' && ' · w toku'}
                  {s.status === 'error' && ' · błąd'}
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  aria-label="Usuń podsumowanie"
                  onClick={async () => {
                    if (!confirm('Usunąć to podsumowanie?')) return
                    await api.deleteSummary(s.id)
                    if (s.id === activeId) setActiveId(null)
                    load()
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* ------------------------------------------------------------------ */

function DataTab({ client, onSaved }: { client: Client; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState<ClientInput>({
    name: client.name, company: client.company, email: client.email, phone: client.phone,
    website: client.website, industry: client.industry, notes: client.notes,
  })
  const set = (k: keyof ClientInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })
  const fields: Array<[keyof ClientInput, string]> = [
    ['name', 'Imię i nazwisko'], ['company', 'Firma'], ['email', 'E-mail'], ['phone', 'Telefon'], ['industry', 'Branża'], ['website', 'Obecna strona'],
  ]
  return (
    <div className="card" style={{ padding: 28, maxWidth: 820 }}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          await api.updateClient(client.id, form)
          await onSaved()
          toast('Zapisano')
        }}
      >
        <div className="form-grid">
          {fields.map(([k, l]) => (
            <label className="field" key={k}>
              <span className="label">{l}</span>
              <input className="input" value={(form[k] as string) ?? ''} onChange={set(k)} required={k === 'name'} />
            </label>
          ))}
          <label className="field full">
            <span className="label">Notatki (widoczne tylko dla Ciebie, trafiają też do agenta AI)</span>
            <textarea className="textarea" value={form.notes ?? ''} onChange={set('notes')} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary">Zapisz</button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (!confirm(`Usunąć klienta „${client.company || client.name}” wraz ze wszystkimi ankietami i odpowiedziami? Tej operacji nie można cofnąć.`)) return
              await api.deleteClient(client.id)
              nav('/panel')
            }}
          >
            <Icon name="trash" size={16} /> Usuń klienta
          </button>
        </div>
      </form>
    </div>
  )
}
