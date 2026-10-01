import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuestionField } from '../../components/QuestionField'
import { CONTACT, Check, Icon, Loading, Modal } from '../../components/ui'
import { api } from '../../lib/api'
import { isVisible, missingRequired, sectionProgress, surveyProgress } from '../../lib/format'
import type { AnswerValue, Answers, Brief, PublicBrief } from '../../lib/types'
import { useClientCtx } from './ClientArea'

type PageState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'draft' }
  | { kind: 'public'; data: PublicBrief }
  | { kind: 'fill'; data: PublicBrief; brief: Brief; email: string }

export default function BriefFormPage() {
  const { client = '', brief = '' } = useParams()
  const { session, mine } = useClientCtx()
  const [state, setState] = useState<PageState>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      // zalogowany klient tej firmy: pełna ankieta z odpowiedziami
      if (session && mine) {
        const b = (await api.myBriefs(mine.id)).find((x) => x.slug === brief)
        if (b) {
          if (!session.preview) api.openMyBrief(b.id)
          const data: PublicBrief = {
            status: b.status, title: b.title, description: b.description, intro: b.intro, schema: b.schema,
            answers: b.answers, client_name: mine.company || mine.name, submitted_at: b.submitted_at,
            own_title: !!b.case_id || b.template_key === 'custom',
          }
          if (alive) setState({ kind: 'fill', data, brief: b, email: session.email })
          return
        }
      }
      // wszyscy pozostali: tylko podgląd pytań
      const pub = await api.publicBrief(client, brief).catch(() => null)
      if (!alive) return
      if (!pub) setState({ kind: 'missing' })
      else if (pub.status === 'draft') setState({ kind: 'draft' })
      else setState({ kind: 'public', data: pub })
    })()
    return () => {
      alive = false
    }
  }, [client, brief, session, mine])

  if (state.kind === 'loading') return <Loading />
  if (state.kind === 'missing')
    return <Notice title="Nie znaleziono ankiety" text="Link może być niepełny lub nieaktualny. Skontaktuj się ze mną, wyślę nowy." />
  if (state.kind === 'draft')
    return <Notice title="Ankieta jest jeszcze przygotowywana" text="Dopracowuję pytania specjalnie dla Ciebie. Wróć do tego linku za chwilę." />

  const here = `/${client}/${brief}`
  if (state.kind === 'public') return <BriefForm data={state.data} mode="public" loginHref={`/logowanie?next=${encodeURIComponent(here)}`} backHref={`/${client}`} />

  const b = state.brief
  return (
    <BriefForm
      data={state.data}
      mode="fill"
      urgent={b.urgent && b.status !== 'submitted'}
      backHref={`/${client}`}
      account={<AccountBar email={state.email} />}
      saver={{ id: b.id, save: (a, submit) => api.saveMyBrief(b.id, a, submit) }}
    />
  )
}

type SaveState = 'saved' | 'saving' | 'error' | 'idle'

export function BriefForm({
  data,
  mode,
  saver,
  loginHref = '/logowanie',
  backHref,
  account,
  urgent,
}: {
  data: PublicBrief
  urgent?: boolean
  /** fill: zalogowany klient; public: podgląd pytań bez logowania; preview: podgląd w panelu */
  mode: 'fill' | 'public' | 'preview'
  saver?: { id: string; save: (answers: Answers, submit: boolean) => Promise<void> }
  loginHref?: string
  backHref?: string
  account?: ReactNode
}) {
  const preview = mode !== 'fill'
  const backupKey = saver ? `nafu-brief-${saver.id}` : ''
  const [answers, setAnswers] = useState<Answers>(() => {
    if (backupKey) {
      try {
        const b = localStorage.getItem(backupKey)
        if (b && Object.keys(data.answers ?? {}).length === 0) return JSON.parse(b)
      } catch {
        /* ignoruj */
      }
    }
    return data.answers ?? {}
  })
  const [stage, setStage] = useState<'welcome' | 'form' | 'done'>(
    data.status === 'submitted' ? 'done' : Object.keys(data.answers ?? {}).length ? 'form' : 'welcome',
  )
  const [step, setStep] = useState(0)
  const [save, setSave] = useState<SaveState>('idle')
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [review, setReview] = useState(false)
  const [sending, setSending] = useState(false)
  const dirty = useRef(false)
  const timer = useRef<number>(undefined)
  const topRef = useRef<HTMLDivElement>(null)

  const schema = data.schema
  const sections = schema.sections
  const section = sections[step]
  const progress = surveyProgress(schema, answers)

  const persist = useCallback(
    async (a: Answers) => {
      if (!saver) return
      setSave('saving')
      try {
        await saver.save(a, false)
        dirty.current = false
        setSave('saved')
      } catch {
        setSave('error')
      }
    },
    [saver],
  )

  const answersRef = useRef(answers)
  const onChange = (id: string, value: AnswerValue | undefined) => {
    const next = { ...answersRef.current }
    if (value === undefined) delete next[id]
    else next[id] = value
    answersRef.current = next
    setAnswers(next)
    if (backupKey) {
      try {
        localStorage.setItem(backupKey, JSON.stringify(next))
      } catch {
        /* ignoruj */
      }
    }
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => persist(next), 1200)
    if (errors.has(id)) setErrors((s) => new Set([...s].filter((x) => x !== id)))
  }

  // zapis przy zamykaniu karty
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current && !preview) {
        persist(answers)
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [answers, persist, preview])

  const go = (i: number) => {
    if (dirty.current) {
      clearTimeout(timer.current)
      persist(answers)
    }
    setStep(Math.max(0, Math.min(sections.length - 1, i)))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // na telefonie przewiń pasek części do aktywnej
  useEffect(() => {
    document.querySelector('.f-nav button.active')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [step])

  const missing = useMemo(() => missingRequired(schema, answers), [schema, answers])

  const trySubmit = () => {
    if (missing.length) {
      setErrors(new Set(missing.map((m) => m.question.id)))
      const first = missing[0]
      setStep(sections.indexOf(first.section))
      setTimeout(() => document.getElementById(`q-${first.question.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
      return
    }
    setReview(true)
  }

  const submit = async () => {
    if (!saver) {
      setReview(false)
      setStage('done')
      return
    }
    setSending(true)
    clearTimeout(timer.current)
    try {
      await saver.save(answers, true)
      try {
        localStorage.removeItem(backupKey)
      } catch {
        /* ignoruj */
      }
      dirty.current = false
      setReview(false)
      setStage('done')
      window.scrollTo({ top: 0 })
    } catch {
      setSave('error')
      alert('Nie udało się wysłać. Sprawdź połączenie z internetem i spróbuj ponownie. Twoje odpowiedzi są zapisane.')
    } finally {
      setSending(false)
    }
  }

  if (stage === 'welcome') return <Welcome data={data} mode={mode} loginHref={loginHref} account={account} urgent={urgent} onStart={() => setStage('form')} />
  if (stage === 'done') return <ThankYou data={data} backHref={backHref} />

  const visibleQs = section.questions.filter((q) => isVisible(q, answers, schema))
  const isLast = step === sections.length - 1

  return (
    <>
      {mode === 'preview' && <div className="demo-banner">Podgląd: tak ankietę zobaczy klient. Odpowiedzi nie są zapisywane.</div>}
      {mode === 'public' && <PublicBanner loginHref={loginHref} />}
      <header className="brand-band f-hero" ref={topRef}>
        <div className="wrap">
          <div>
            <div className="f-top">
              {backHref ? (
                <Link to={backHref} aria-label="Wszystkie ankiety">
                  <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
                </Link>
              ) : (
                <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
              )}
              {account}
            </div>
            <div className="eyebrow" style={{ color: 'var(--teal)' }}>
              Ankieta dla: {data.client_name}
              {urgent && <span className="badge urgent" style={{ marginLeft: 12, letterSpacing: 0, textTransform: 'none' }}>Pilne</span>}
            </div>
            <h1 style={{ marginTop: 10 }}>{data.title}</h1>
            <div className="f-hero-progress">
              <div className="progress" aria-label={`Postęp ${progress.pct}%`}>
                <span style={{ width: `${progress.pct}%` }} />
              </div>
              <span>{progress.pct}%</span>
              {!preview && (
                <span className={`save-state ${save}`} aria-live="polite">
                  <span className="dot" />
                  {save === 'saving' ? 'Zapisuję…' : save === 'error' ? 'Brak połączenia, zapiszę ponownie' : 'Zapisano automatycznie'}
                </span>
              )}
            </div>
          </div>
          <img src="/brand/kv-desk.webp" alt="" className="kv" />
        </div>
      </header>

      <main className="wrap f-body">
        <aside className="f-aside">
          <nav className="f-nav" aria-label="Części ankiety">
            <div className="f-nav-title">Części ankiety</div>
            {sections.map((s, i) => {
              const p = sectionProgress(s, answers, schema)
              const done = p.total > 0 && p.done === p.total
              return (
                <button key={s.id} className={`${i === step ? 'active' : ''}${done ? ' done' : ''}`} onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}>
                  <span className="num">{done ? <Check /> : i + 1}</span>
                  <span>{s.title}</span>
                  <span className="count">
                    {p.done}/{p.total}
                  </span>
                </button>
              )
            })}
          </nav>
          <div className="f-help">
            <strong>Masz pytanie?</strong>
            <span>Zadzwoń lub napisz, pomogę.</span>
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </div>
        </aside>

        <section aria-labelledby="sec-title">
          <div className="f-section-head">
            <div className="eyebrow">
              Część {step + 1} z {sections.length}
            </div>
            <h2 id="sec-title">{section.title}</h2>
            {section.description && <p>{section.description}</p>}
          </div>
          {visibleQs.map((q) => (
            <QuestionField key={q.id} q={q} answers={answers} onChange={onChange} error={errors.has(q.id)} />
          ))}
          {visibleQs.length === 0 && <p className="muted">W tej części nie ma pytań dla Ciebie. Przejdź dalej.</p>}
        </section>
      </main>

      <footer className="f-footer">
        <div className="wrap">
          <button className="btn btn-ghost" onClick={() => go(step - 1)} disabled={step === 0}>
            <Icon name="back" size={16} /> Wstecz
          </button>
          <span className="step">
            {section.title} · {step + 1}/{sections.length}
          </span>
          {isLast ? (
            mode === 'public' ? (
              <Link className="btn btn-primary" to={loginHref}>
                Zaloguj się, aby wypełnić
              </Link>
            ) : (
              <button className="btn btn-primary" onClick={trySubmit}>
                Sprawdź i wyślij
              </button>
            )
          ) : (
            <button className="btn btn-primary" onClick={() => go(step + 1)}>
              Dalej: {sections[step + 1].title}
            </button>
          )}
        </div>
      </footer>

      {review && (
        <Modal label="Wyślij ankietę" onClose={() => setReview(false)}>
          <div className="eyebrow">Ostatni krok</div>
          <h2 style={{ marginTop: 8 }}>Wysyłamy?</h2>
          <p className="muted">
            Uzupełniono {progress.done} z {progress.total} pytań. Puste pola nie są problemem, omówimy je na rozmowie. Po wysłaniu odpowiedzi trafią do NAFU Design.
          </p>
          <div className="review-list">
            {sections.map((s, i) => {
              const p = sectionProgress(s, answers, schema)
              return (
                <div className="review-item" key={s.id}>
                  <span>
                    {i + 1}. {s.title}
                  </span>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {p.done}/{p.total}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setReview(false)}>
              Wróć do ankiety
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={sending}>
              {sending ? 'Wysyłam…' : 'Wyślij odpowiedzi'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Welcome({
  data,
  onStart,
  mode,
  loginHref,
  account,
  urgent,
}: {
  data: PublicBrief
  urgent?: boolean
  onStart: () => void
  mode: 'fill' | 'public' | 'preview'
  loginHref: string
  account?: ReactNode
}) {
  const sections = data.schema.sections
  const count = sections.reduce((n, s) => n + s.questions.length, 0)
  const minutes = Math.max(5, Math.round((count * 0.35) / 5) * 5)
  const [intro, ...rest] = (data.intro ?? '').split('\n\n')

  return (
    <>
      {mode === 'preview' && <div className="demo-banner">Podgląd: tak ankietę zobaczy klient.</div>}
      <div className="wl">
        <header className="wl-top wrap">
          <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
          {account ?? (
            <div className="wl-contact">
              <a href={CONTACT.phoneHref}>
                <Icon name="phone" size={15} /> {CONTACT.phone}
              </a>
              <a href={`mailto:${CONTACT.email}`}>
                <Icon name="mail" size={15} /> {CONTACT.email}
              </a>
            </div>
          )}
        </header>

        <section className="wl-hero wrap">
          <div className="wl-copy">
            <span className="wl-pill">
              <span className="dot" /> Przygotowane dla: <strong>{data.client_name}</strong>
            </span>
            {urgent && (
              <span className="wl-urgent">
                Pilne: ta ankieta jest mi potrzebna jak najszybciej. Dziękuję, że wypełnisz ją w pierwszej kolejności.
              </span>
            )}
            <div className="wl-kicker">{data.own_title ? 'Ankieta' : data.title}</div>
            {data.own_title ? (
              <h1>{data.title}</h1>
            ) : (
              <h1>
                Pierwszy krok do Twojej <em>nowej strony</em>
              </h1>
            )}
            {intro && <p className="wl-lead">{intro}</p>}
            {rest.map((r, i) => (
              <p className="wl-note" key={i}>
                {r}
              </p>
            ))}
            <div className="wl-cta">
              {mode === 'public' ? (
                <>
                  <Link className="btn btn-primary wl-start" to={loginHref}>
                    Zaloguj się, aby wypełnić <span aria-hidden>→</span>
                  </Link>
                  <button className="btn btn-outline-light" onClick={onStart}>
                    Zobacz pytania
                  </button>
                </>
              ) : (
                <button className="btn btn-primary wl-start" onClick={onStart}>
                  Zaczynamy <span aria-hidden>→</span>
                </button>
              )}
              <span className="wl-time">
                <strong>ok. {minutes} min</strong>
                <span>
                  {sections.length} części · {count} pytań
                </span>
              </span>
            </div>
            <div className="wl-hosts">
              <img src="/brand/natalia.webp" alt="" />
              <span>
                <strong>{CONTACT.names}</strong>
                <span>NAFU Design. Jeśli coś jest niejasne, zadzwoń</span>
              </span>
            </div>
          </div>
          <div className="wl-art" aria-hidden>
            <div className="wl-glow" />
            <img src="/brand/kv-desk.webp" alt="" className="wl-kv" />
          </div>
        </section>

        <section className="wl-steps wrap" aria-label="Jak to działa">
          <div className="wl-step">
            <span className="n">1</span>
            <strong>Zaznaczasz</strong>
            <span>Większość pytań to kliknięcia. Tam, gdzie warto, piszesz własnymi słowami.</span>
          </div>
          <div className="wl-step">
            <span className="n">2</span>
            <strong>Wracasz, kiedy chcesz</strong>
            <span>Wszystko zapisuje się samo na Twoim koncie. Możesz przerwać i dokończyć później.</span>
          </div>
          <div className="wl-step">
            <span className="n">3</span>
            <strong>Wysyłasz odpowiedzi</strong>
            <span>{data.own_title ? 'Czego nie wiesz, zaznacz „Nie wiem” albo zostaw puste. Wrócimy do tego w rozmowie.' : 'Czego nie wiesz, zostaw puste. Omówimy to razem na spotkaniu.'}</span>
          </div>
        </section>

        <section className="wl-map wrap" aria-label="Co nas czeka">
          <span className="wl-map-title">Co nas czeka</span>
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}

function ThankYou({ data, backHref }: { data: PublicBrief; backHref?: string }) {
  return (
    <div className="brand-band" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
      </div>
      <div className="wrap welcome" style={{ flex: 1, display: 'grid', alignItems: 'center' }}>
        <div className="welcome-grid">
          <div>
            <div className="eyebrow" style={{ color: 'var(--teal)' }}>
              Gotowe
            </div>
            <h1 style={{ marginTop: 14 }}>
              Dziękuję<span className="accent">!</span>
            </h1>
            <p className="lead">
              Twoje odpowiedzi „{data.title}” dotarły do NAFU Design. Przeanalizuję je i odezwę się z propozycjami.
              {'\n\n'}Jeśli chcesz coś dopisać albo zmienić, zadzwoń lub napisz.
            </p>
            <div className="row">
              {backHref && (
                <Link className="btn btn-primary" to={backHref}>
                  Pozostałe ankiety
                </Link>
              )}
              <a className="btn btn-outline-light" href={CONTACT.phoneHref}>
                <Icon name="phone" size={16} /> {CONTACT.phone}
              </a>
              <a className="btn btn-outline-light" href={`mailto:${CONTACT.email}`}>
                <Icon name="mail" size={16} /> Napisz e-mail
              </a>
            </div>
            <p style={{ marginTop: 28, color: 'rgba(255,255,255,.6)', fontSize: 14 }}>
              {CONTACT.names} · {CONTACT.city}
            </p>
          </div>
          <img src="/brand/badge-arc.webp" alt="NAFU Design" style={{ width: '100%', maxWidth: 320, marginInline: 'auto' }} />
        </div>
      </div>
    </div>
  )
}

export function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="brand-band center-screen">
      <div style={{ textAlign: 'center', maxWidth: 520, display: 'grid', gap: 16, justifyItems: 'center' }}>
        <img src="/brand/badge-arc.webp" alt="" style={{ width: 140 }} />
        <h1 style={{ fontSize: 32 }}>{title}</h1>
        <p style={{ color: 'rgba(255,255,255,.8)', margin: 0 }}>{text}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn btn-outline-light" href={CONTACT.phoneHref}>
            {CONTACT.phone}
          </a>
          <a className="btn btn-outline-light" href={`mailto:${CONTACT.email}`}>
            {CONTACT.email}
          </a>
        </div>
      </div>
    </div>
  )
}

/** Pasek nad ankietą bez logowania: to tylko podgląd pytań */
export function PublicBanner({ loginHref }: { loginHref: string }) {
  return (
    <div className="pub-banner">
      <span>Podgląd pytań. Aby wypełnić ankietę i zapisać odpowiedzi, zaloguj się na swoje konto.</span>
      <Link className="btn btn-primary btn-sm" to={loginHref}>
        Zaloguj się
      </Link>
    </div>
  )
}

/** Zalogowany klient: e-mail, zmiana hasła, wylogowanie */
export function AccountBar({ email }: { email: string }) {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const change = async () => {
    if (pw.length < 8) return setMsg('Hasło musi mieć co najmniej 8 znaków.')
    if (pw !== pw2) return setMsg('Hasła nie są takie same.')
    setBusy(true)
    try {
      await api.changePassword(pw)
      setOpen(false)
      setPw('')
      setPw2('')
      setMsg('')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct">
      <span className="acct-email" title={email}>
        {email}
      </span>
      <button className="btn btn-outline-light btn-sm" onClick={() => setOpen(true)}>
        Zmień hasło
      </button>
      <button
        className="btn btn-outline-light btn-sm"
        onClick={async () => {
          await api.signOut()
          nav('/logowanie')
        }}
      >
        <Icon name="logout" size={14} /> Wyloguj
      </button>
      {open && (
        <Modal label="Zmień hasło" onClose={() => setOpen(false)}>
          <div className="eyebrow">Twoje konto</div>
          <h2 style={{ marginTop: 8, marginBottom: 16 }}>Zmień hasło</h2>
          <div className="stack">
            <label className="field">
              <span className="label">Nowe hasło (co najmniej 8 znaków)</span>
              <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Powtórz nowe hasło</span>
              <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
            {msg && <p style={{ color: 'var(--danger)', margin: 0 }}>{msg}</p>}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setOpen(false)}>
              Anuluj
            </button>
            <button className="btn btn-primary" onClick={change} disabled={busy}>
              {busy ? 'Zapisuję…' : 'Zapisz hasło'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
