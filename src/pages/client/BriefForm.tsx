import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QuestionField } from '../../components/QuestionField'
import { CONTACT, Check, Icon, Loading, Modal } from '../../components/ui'
import { api } from '../../lib/api'
import { isVisible, missingRequired, sectionProgress, surveyProgress } from '../../lib/format'
import type { AnswerValue, Answers, PublicBrief } from '../../lib/types'

export default function BriefFormPage() {
  const { token = '' } = useParams()
  const [data, setData] = useState<PublicBrief | null | undefined>(undefined)

  useEffect(() => {
    api.publicBrief(token).then(setData).catch(() => setData(null))
  }, [token])

  if (data === undefined) return <Loading />
  if (data === null)
    return <Notice title="Nie znaleziono ankiety" text="Link może być niepełny lub nieaktualny. Skontaktuj się ze mną — wyślę nowy." />
  if (data.status === 'draft')
    return <Notice title="Ankieta jest jeszcze przygotowywana" text="Dopracowuję pytania specjalnie dla Ciebie. Wróć do tego linku za chwilę." />

  return <BriefForm data={data} token={token} />
}

type SaveState = 'saved' | 'saving' | 'error' | 'idle'

export function BriefForm({ data, token, preview }: { data: PublicBrief; token?: string; preview?: boolean }) {
  const backupKey = token ? `nafu-brief-${token}` : ''
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
      if (preview || !token) return
      setSave('saving')
      try {
        await api.savePublicBrief(token, a)
        dirty.current = false
        setSave('saved')
      } catch {
        setSave('error')
      }
    },
    [preview, token],
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
    if (preview || !token) {
      setReview(false)
      setStage('done')
      return
    }
    setSending(true)
    clearTimeout(timer.current)
    try {
      await api.savePublicBrief(token, answers, true)
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
      alert('Nie udało się wysłać. Sprawdź połączenie z internetem i spróbuj ponownie — Twoje odpowiedzi są zapisane.')
    } finally {
      setSending(false)
    }
  }

  if (stage === 'welcome') return <Welcome data={data} preview={preview} onStart={() => setStage('form')} />
  if (stage === 'done') return <ThankYou data={data} />

  const visibleQs = section.questions.filter((q) => isVisible(q, answers, schema))
  const isLast = step === sections.length - 1

  return (
    <>
      {preview && <div className="demo-banner">Podgląd — tak ankietę zobaczy klient. Odpowiedzi nie są zapisywane.</div>}
      <header className="brand-band f-hero" ref={topRef}>
        <div className="wrap">
          <div>
            <div className="f-top">
              <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
            </div>
            <div className="eyebrow" style={{ color: 'var(--teal)' }}>
              Ankieta dla: {data.client_name}
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
                  {save === 'saving' ? 'Zapisuję…' : save === 'error' ? 'Brak połączenia — zapiszę ponownie' : 'Zapisano automatycznie'}
                </span>
              )}
            </div>
          </div>
          <img src="/brand/kv-desk.webp" alt="" className="kv" />
        </div>
      </header>

      <main className="wrap f-body">
        <aside>
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
            <span>Zadzwoń lub napisz — chętnie pomogę.</span>
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
          {visibleQs.length === 0 && <p className="muted">W tej części nie ma pytań dla Ciebie — przejdź dalej.</p>}
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
            <button className="btn btn-primary" onClick={trySubmit}>
              Sprawdź i wyślij
            </button>
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
            Uzupełniono {progress.done} z {progress.total} pytań. Puste pola nie są problemem — omówimy je na rozmowie. Po wysłaniu odpowiedzi trafią do NAFU Design.
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

function Welcome({ data, onStart, preview }: { data: PublicBrief; onStart: () => void; preview?: boolean }) {
  const count = data.schema.sections.reduce((n, s) => n + s.questions.length, 0)
  return (
    <>
      {preview && <div className="demo-banner">Podgląd — tak ankietę zobaczy klient.</div>}
      <div className="brand-band" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div className="wrap" style={{ paddingTop: 24 }}>
          <div className="f-top">
            <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
            <div className="contact">
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </div>
          </div>
        </div>
        <div className="wrap welcome" style={{ flex: 1, display: 'grid', alignItems: 'center' }}>
          <div className="welcome-grid">
            <div>
              <div className="eyebrow" style={{ color: 'var(--teal)' }}>
                Dla: {data.client_name}
              </div>
              <h1 style={{ marginTop: 14 }}>{data.title}</h1>
              {data.intro && <p className="lead">{data.intro}</p>}
              <div className="meta">
                <span className="chip-dark">{data.schema.sections.length} części</span>
                <span className="chip-dark">{count} pytań</span>
                <span className="chip-dark">Zapis automatyczny — możesz wrócić w każdej chwili</span>
              </div>
              <button className="btn btn-primary" style={{ minHeight: 52, padding: '14px 30px', fontSize: 16 }} onClick={onStart}>
                Zaczynamy
              </button>
            </div>
            <img src="/brand/kv-desk.webp" alt="Jednorożec NAFU przy biurku projektanta" className="kv-big" />
          </div>
        </div>
      </div>
    </>
  )
}

function ThankYou({ data }: { data: PublicBrief }) {
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
              Dziękujemy<span className="accent">!</span>
            </h1>
            <p className="lead">
              Twoje odpowiedzi „{data.title}” dotarły do NAFU Design. Przeanalizujemy je i odezwiemy się z propozycjami.
              {'\n\n'}Jeśli chcesz coś dopisać albo zmienić — po prostu zadzwoń lub napisz.
            </p>
            <div className="row">
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
