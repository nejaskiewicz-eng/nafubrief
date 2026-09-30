import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CONTACT, Icon, Modal, Spinner, StatusBadge, TEMPLATE_COLORS, TEMPLATE_LETTER,
  copyText, downloadFile, fmtDate, useToast,
} from '../../components/ui'
import { api, briefLink, loginLink, portalLink, SITE_URL, type ClientInput } from '../../lib/api'
import { surveyProgress } from '../../lib/format'
import { renderMarkdown } from '../../lib/markdown'
import type { Brief, Client, Summary, TemplateKey } from '../../lib/types'
import { TemplatePicker } from './Dashboard'
import { isDemo } from '../../lib/supabase'
import { unreadCount } from '../../lib/workspace'
import Access from '../../workspace/Access'
import Documents from '../../workspace/Documents'
import Media from '../../workspace/Media'
import Preview from '../../workspace/Preview'
import Start from '../../workspace/Start'
import Messages from '../../workspace/Messages'
import Profile from '../../workspace/Profile'
import Services from '../../workspace/Services'
import Team from '../../workspace/Team'

type Tab = 'start' | 'briefs' | 'podglad' | 'profil' | 'media' | 'zespol' | 'uslugi' | 'dostepy' | 'dokumenty' | 'wiadomosci' | 'ai' | 'data'

const TAB_LABELS: Array<[Tab, string]> = [
  ['start', 'Przebieg projektu'],
  ['briefs', 'Ankiety i dostęp'],
  ['podglad', 'Podgląd strony'],
  ['profil', 'Profil firmy'],
  ['media', 'Baza mediów'],
  ['zespol', 'Zespół'],
  ['uslugi', 'Usługi'],
  ['dostepy', 'Dostępy'],
  ['dokumenty', 'Dokumenty'],
  ['wiadomosci', 'Wiadomości'],
  ['ai', 'Podsumowanie AI'],
  ['data', 'Dane klienta'],
]

export default function ClientDetail() {
  const { id = '' } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [briefs, setBriefs] = useState<Brief[] | null>(null)
  const [tab, setTab] = useState<Tab>('start')
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!isDemo) unreadCount(id, true).then(setUnread).catch(() => {})
  }, [id, tab])

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
        {TAB_LABELS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
            {k === 'wiadomosci' && unread > 0 && <span className="tab-dot">{unread}</span>}
          </button>
        ))}
      </div>

      {tab === 'briefs' && <BriefsTab client={client} briefs={briefs} reload={reload} />}
      {tab === 'start' && <Start client={client} briefs={briefs} isAdmin onBriefsChanged={reload} onGo={(t) => setTab(t === 'start' ? 'start' : (t as Tab))} />}
      {tab === 'podglad' && <Preview client={client} isAdmin />}
      {tab === 'dostepy' && <Access clientId={client.id} isAdmin />}
      {tab === 'dokumenty' && <Documents client={client} isAdmin />}
      {tab === 'profil' && <Profile clientId={client.id} />}
      {tab === 'media' && <Media clientId={client.id} />}
      {tab === 'zespol' && <Team clientId={client.id} />}
      {tab === 'uslugi' && <Services clientId={client.id} />}
      {tab === 'wiadomosci' && <Messages clientId={client.id} isAdmin />}
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
  const [access, setAccess] = useState<null | 'create' | 'password'>(null)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)
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
            <BriefRow key={b.id} b={b} client={client} reload={reload} />
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
          <div className="eyebrow">Dostęp klienta</div>
          <h3 style={{ fontSize: 20, margin: '8px 0 6px', color: 'var(--ink)' }}>Konto do wypełniania ankiet</h3>
          {client.user_id ? (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
                Klient loguje się adresem <strong style={{ color: 'var(--ink)' }}>{client.login_email}</strong> i widzi tylko swoje ankiety.
              </p>
              <div className="row">
                <button className="btn btn-sm" onClick={() => setAccess('password')}>
                  <Icon name="unlock" size={15} /> Nowe hasło
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    if (!confirm('Usunąć konto klienta? Nie będzie mógł się zalogować. Odpowiedzi zostaną w panelu.')) return
                    try {
                      await api.clientAccess('remove', client.id)
                      await reload()
                      toast('Usunięto dostęp klienta')
                    } catch (e) {
                      toast((e as Error).message)
                    }
                  }}
                >
                  <Icon name="trash" size={15} /> Usuń dostęp
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
                Bez konta klient może tylko przejrzeć pytania. Załóż mu konto, żeby mógł je wypełnić i zapisać odpowiedzi.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setAccess('create')}>
                <Icon name="plus" size={15} /> Załóż konto klienta
              </button>
            </>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow">{drafts.length ? 'Krok 2 z 2' : 'Wysyłka'}</div>
          <h3 style={{ fontSize: 20, margin: '8px 0 6px', color: 'var(--ink)' }}>Link dla klienta</h3>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            Jeden link do wszystkich ankiet. Klient wypełnia je w dowolnej kolejności.
          </p>
          {live.length ? (
            <>
              <div className="link-box">
                <span>{portalLink(client)}</span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => copyText(portalLink(client)).then(() => toast('Skopiowano link'))}
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
      {access && (
        <AccessModal
          client={client}
          mode={access}
          onClose={() => setAccess(null)}
          onDone={async (c) => {
            await reload()
            setAccess(null)
            setCreds(c)
            setSharing(true)
          }}
        />
      )}
      {sharing && (
        <ShareModal
          client={client}
          briefs={live}
          creds={creds}
          onClose={() => {
            setSharing(false)
            setCreds(null)
          }}
        />
      )}
    </div>
  )
}

function BriefRow({ b, client, reload }: { b: Brief; client: Client; reload: () => Promise<void> }) {
  const toast = useToast()
  const p = surveyProgress(b.schema, b.answers)
  const qs = b.schema.sections.reduce((n, s) => n + s.questions.length, 0)
  return (
    <div className={`brief-row${b.urgent && b.status !== 'submitted' ? ' is-urgent' : ''}`}>
      <div className="brief-icon" style={{ background: TEMPLATE_COLORS[b.template_key] ?? TEMPLATE_COLORS.strategy }}>
        {TEMPLATE_LETTER[b.template_key] ?? '•'}
      </div>
      <div style={{ minWidth: 0 }}>
        <h3>{b.title}</h3>
        <div className="meta">
          {b.urgent && <span className="badge urgent">Pilne</span>}
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
          <button className="btn btn-sm" title="Kopiuj link do tej ankiety" onClick={() => copyText(briefLink(client, b)).then(() => toast('Skopiowano link do ankiety'))}>
            <Icon name="link" size={15} /> Link
          </button>
        )}
        {b.status !== 'submitted' && (
          <button
            className={`btn btn-sm${b.urgent ? ' btn-urgent' : ''}`}
            aria-pressed={b.urgent}
            title="Klient zobaczy tę ankietę jako pilną, na górze listy"
            onClick={async () => {
              await api.updateBrief(b.id, { urgent: !b.urgent })
              await reload()
              toast(b.urgent ? 'Zdjęto oznaczenie „Pilne”' : 'Oznaczono jako pilną')
            }}
          >
            {b.urgent ? '● Pilne' : 'Oznacz jako pilną'}
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

type Form = 'ty' | 'pani' | 'pan'

/** Zdrobnienia w wołaczu do powitania na „Ty” (najpopularniejsze imiona) */
const INFORMAL: Record<string, string> = {
  aleksandra: 'Olu', anna: 'Aniu', joanna: 'Asiu', katarzyna: 'Kasiu', małgorzata: 'Gosiu', magdalena: 'Madziu',
  agnieszka: 'Agnieszko', barbara: 'Basiu', elżbieta: 'Elu', ewa: 'Ewo', dorota: 'Doroto', monika: 'Moniko',
  karolina: 'Karolino', paulina: 'Paulino', natalia: 'Natalio', marta: 'Marto', justyna: 'Justyno', beata: 'Beato',
  agata: 'Agato', aneta: 'Aneto', iwona: 'Iwono', izabela: 'Izo', jolanta: 'Jolu', julia: 'Julio', kinga: 'Kingo',
  klaudia: 'Klaudio', krystyna: 'Krysiu', maria: 'Marysiu', marzena: 'Marzeno', patrycja: 'Patrycjo', renata: 'Renato',
  sylwia: 'Sylwio', urszula: 'Ulu', weronika: 'Weroniko', wiktoria: 'Wiktorio', zuzanna: 'Zuziu', emilia: 'Emilko',
  alicja: 'Alu', dominika: 'Dominiko', edyta: 'Edyto', grażyna: 'Grażynko', halina: 'Halinko', teresa: 'Tereso',
  adam: 'Adamie', andrzej: 'Andrzeju', bartosz: 'Bartku', damian: 'Damianie', daniel: 'Danielu', dawid: 'Dawidzie',
  grzegorz: 'Grzesiu', hubert: 'Hubercie', jakub: 'Kubo', jan: 'Janku', jarosław: 'Jarku', kamil: 'Kamilu',
  krzysztof: 'Krzysiu', łukasz: 'Łukaszu', maciej: 'Maćku', marcin: 'Marcinie', marek: 'Marku', mariusz: 'Mariuszu',
  mateusz: 'Mateuszu', michał: 'Michale', paweł: 'Pawle', piotr: 'Piotrze', rafał: 'Rafale', robert: 'Robercie',
  sebastian: 'Sebastianie', szymon: 'Szymonie', tomasz: 'Tomku', wojciech: 'Wojtku', zbigniew: 'Zbyszku',
}

/** Wołacz imienia do powitania; zawsze można poprawić ręcznie */
function vocative(name: string, form: Form) {
  const first = name.trim().split(/\s+/)[0] ?? ''
  if (!first || form === 'pan') return ''
  if (form === 'ty') {
    const inf = INFORMAL[first.toLowerCase()]
    if (inf) return inf
  }
  return /a$/i.test(first) ? first.replace(/a$/i, 'o') : first
}

function buildMessage(o: { form: Form; greeting: string; hasAccount: boolean; creds: { email: string; password: string } | null; loginEmail: string | null; portal: string }) {
  const ty = o.form === 'ty'
  const P = o.form === 'pani' ? 'Pani' : 'Pan'
  const t = (tyText: string, panText: string) => (ty ? tyText : panText)

  const access = o.creds
    ? t(
        `Zaloguj się tutaj: ${loginLink()}\nE-mail: ${o.creds.email}\nHasło tymczasowe: ${o.creds.password}\n\nPrzy pierwszym logowaniu ustawisz własne hasło.`,
        `Proszę zalogować się tutaj: ${loginLink()}\nE-mail: ${o.creds.email}\nHasło tymczasowe: ${o.creds.password}\n\nPrzy pierwszym logowaniu ustawi ${P} własne hasło.`,
      )
    : o.hasAccount
      ? t(
          `Panel znajdziesz tutaj: ${loginLink()}\nLogujesz się adresem ${o.loginEmail}. Jeśli nie pamiętasz hasła, daj znać, ustawię nowe.`,
          `Panel znajdzie ${P} tutaj: ${loginLink()}\nLogowanie adresem ${o.loginEmail}. Jeśli hasło wypadło z pamięci, proszę dać znać, ustawię nowe.`,
        )
      : t(`Panel znajdziesz tutaj: ${o.portal}\nDane do logowania prześlę Ci osobno.`, `Panel znajdzie ${P} tutaj: ${o.portal}\nDane do logowania prześlę osobno.`)

  return `${o.greeting}

${t(
  'przygotowałam dla Ciebie panel klienta. Zbierzemy w nim wszystko, czego potrzebuję do projektu Twojej nowej strony: kilka krótkich ankiet, dane firmy, zdjęcia, informacje o zespole i usługach.',
  `przygotowałam dla ${o.form === 'pani' ? 'Pani' : 'Pana'} panel klienta. Zbierzemy w nim wszystko, czego potrzebuję do projektu nowej strony: kilka krótkich ankiet, dane firmy, zdjęcia, informacje o zespole i usługach.`,
)}

${access}

${t(
  'Nie musisz robić wszystkiego za jednym razem. Wszystko zapisuje się na bieżąco, więc możesz wracać, kiedy znajdziesz chwilę. Jeśli na któreś pytanie nie znasz odpowiedzi, po prostu je pomiń, omówimy to razem.',
  `Nie musi ${P} robić wszystkiego za jednym razem. Wszystko zapisuje się na bieżąco, więc można wracać w dowolnej chwili. Jeśli na któreś pytanie nie zna ${P} odpowiedzi, wystarczy je pominąć, omówimy to razem.`,
)}

${t('W załączniku przesyłam krótki poradnik, jak korzystać z panelu.', 'W załączniku przesyłam krótki poradnik, jak korzystać z panelu.')}

${t('Gdyby coś było niejasne, zadzwoń albo napisz.', 'Gdyby coś było niejasne, proszę dzwonić albo pisać.')}

Pozdrawiam serdecznie
Natalia Jaśkiewicz
NAFU Design
${CONTACT.phone}`
}

function ShareModal({ client, creds, onClose }: { client: Client; briefs: Brief[]; creds: { email: string; password: string } | null; onClose: () => void }) {
  const toast = useToast()
  const prefKey = `nafu-form-${client.id}`
  const [form, setForm] = useState<Form>(() => {
    try {
      return (localStorage.getItem(prefKey) as Form) || 'ty'
    } catch {
      return 'ty'
    }
  })
  const greetKey = (f: Form) => `nafu-greet-${client.id}-${f}`
  const defaultGreeting = (f: Form) => {
    try {
      const saved = localStorage.getItem(greetKey(f))
      if (saved) return saved
    } catch {
      /* ignoruj */
    }
    const v = vocative(client.name, f)
    if (f === 'ty') return v ? `Cześć ${v},` : 'Cześć,'
    if (f === 'pani') return v ? `Dzień dobry Pani ${v},` : 'Dzień dobry,'
    return 'Dzień dobry,'
  }
  const [greeting, setGreeting] = useState(() => defaultGreeting(form))
  const compose = (f: Form, g: string) =>
    buildMessage({ form: f, greeting: g, hasAccount: !!client.user_id, creds, loginEmail: client.login_email, portal: portalLink(client) })
  const [message, setMessage] = useState(() => compose(form, greeting))

  const changeForm = (f: Form) => {
    const g = defaultGreeting(f)
    setForm(f)
    setGreeting(g)
    setMessage(compose(f, g))
    try {
      localStorage.setItem(prefKey, f)
    } catch {
      /* ignoruj */
    }
  }
  const mailto = `mailto:${client.email ?? client.login_email ?? ''}?subject=${encodeURIComponent('Panel klienta do projektu strony')}&body=${encodeURIComponent(message)}`

  return (
    <Modal label="Wiadomość do klienta" onClose={onClose}>
      <div className="eyebrow">Wysyłka</div>
      <h2 style={{ marginTop: 8 }}>Wiadomość do klienta</h2>
      <p className="muted" style={{ marginTop: 4 }}>Możesz ją jeszcze dowolnie zmienić. Do maila dołącz poradnik PDF.</p>
      {creds && (
        <p className="card" style={{ padding: '10px 14px', background: 'var(--warn-50)', borderColor: '#f4e0b4', fontSize: 14, margin: '0 0 12px' }}>
          Hasło widzisz tylko teraz, nie jest nigdzie zapisane. Skopiuj wiadomość przed zamknięciem okna.
        </p>
      )}
      <div className="form-grid" style={{ marginBottom: 12, alignItems: 'end' }}>
        <div className="field">
          <span className="label">Forma zwracania się</span>
          <div className="seg" role="radiogroup" aria-label="Forma zwracania się">
            {(
              [
                ['ty', 'Na „Ty”'],
                ['pani', 'Pani'],
                ['pan', 'Pan'],
              ] as Array<[Form, string]>
            ).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={form === k} className={form === k ? 'on' : ''} onClick={() => changeForm(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="label">Powitanie</span>
          <input
            className="input"
            value={greeting}
            onChange={(e) => {
              setGreeting(e.target.value)
              setMessage(compose(form, e.target.value))
              try {
                localStorage.setItem(greetKey(form), e.target.value)
              } catch {
                /* ignoruj */
              }
            }}
          />
        </label>
      </div>
      <textarea className="textarea" style={{ minHeight: 320, fontSize: 14 }} value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="modal-actions">
        <a className="btn" href="/poradnik.pdf" download="NAFU-strefa-klienta-poradnik.pdf">
          <Icon name="download" size={16} /> Poradnik PDF
        </a>
        {(client.email || client.login_email) && (
          <a className="btn" href={mailto}>
            <Icon name="mail" size={16} /> Otwórz w poczcie
          </a>
        )}
        <button className="btn btn-primary" onClick={() => copyText(message).then(() => toast('Skopiowano wiadomość'))}>
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
              if (!confirm(`Usunąć klienta „${client.company || client.name}” wraz ze wszystkimi ankietami, odpowiedziami, plikami i kontem logowania klienta? Tej operacji nie można cofnąć.`)) return
              try {
                // najpierw konto logowania klienta, żeby nie zostało bez firmy
                if (client.user_id) await api.clientAccess('remove', client.id)
                await api.deleteClient(client.id)
                nav('/panel')
              } catch (e) {
                toast((e as Error).message)
              }
            }}
          >
            <Icon name="trash" size={16} /> Usuń klienta
          </button>
        </div>
      </form>
    </div>
  )
}

const PW_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const genPassword = () => {
  const r = crypto.getRandomValues(new Uint8Array(10))
  const c = Array.from(r, (b) => PW_ALPHABET[b % PW_ALPHABET.length]).join('')
  return `${c.slice(0, 5)}-${c.slice(5)}`
}

function AccessModal({
  client,
  mode,
  onClose,
  onDone,
}: {
  client: Client
  mode: 'create' | 'password'
  onClose: () => void
  onDone: (creds: { email: string; password: string }) => Promise<void>
}) {
  const [email, setEmail] = useState(client.login_email ?? client.email ?? '')
  const [password, setPassword] = useState(genPassword)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.clientAccess(mode, client.id, email, password)
      await onDone({ email: mode === 'create' ? email.trim().toLowerCase() : client.login_email ?? email, password })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal label={mode === 'create' ? 'Załóż konto klienta' : 'Nowe hasło'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="eyebrow">Dostęp klienta</div>
        <h2 style={{ marginTop: 8 }}>{mode === 'create' ? 'Załóż konto klienta' : 'Ustaw nowe hasło'}</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          {mode === 'create'
            ? 'Klient będzie logował się tym adresem e-mail i hasłem. Po zapisaniu przygotuję gotową wiadomość z danymi logowania.'
            : `Nowe hasło dla ${client.login_email}. Poprzednie przestanie działać.`}
        </p>
        <div className="stack" style={{ marginTop: 16 }}>
          {mode === 'create' && (
            <label className="field">
              <span className="label">E-mail klienta (login)</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span className="label">Hasło (co najmniej 8 znaków)</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="input" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} />
              <button type="button" className="btn btn-sm" onClick={() => setPassword(genPassword())}>
                Losuj
              </button>
            </div>
          </label>
          {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Zapisuję…' : mode === 'create' ? 'Załóż konto' : 'Ustaw hasło'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
