import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon, Modal, Spinner, copyText, fmtDate, useToast } from '../components/ui'
import {
  addComment, addConcept, decideReview, deleteComment, deleteReview, listComments, listReviews, resolveComment, saveReview,
  type PinData, type Review, type ReviewComment, type ReviewStatus,
} from '../lib/project'
import type { Client } from '../lib/types'
import { signedUrls } from '../lib/workspace'
import { Empty, Field } from './bits'

export const FEEDBACK_SCRIPT = '<script src="https://nafu-design.com/feedback.js" defer></script>'

const STATUS: Record<ReviewStatus, [string, string]> = {
  pending: ['Czeka na decyzję', 'sent'],
  approved: ['Zaakceptowane', 'submitted'],
  changes: ['Do poprawy', 'in_progress'],
}

const originOf = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/** Sprawdza w tle, czy na podglądzie jest skrypt pinezek */
function useScriptProbe(url: string | null) {
  const [state, setState] = useState<'checking' | 'ok' | 'missing'>('checking')
  const frame = useRef<HTMLIFrameElement | null>(null)
  useEffect(() => {
    if (!url) return
    setState('checking')
    const origin = originOf(url)
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px'
    iframe.src = url
    frame.current = iframe
    let done = false
    const onMsg = (e: MessageEvent) => {
      if (e.origin === origin && e.data?.type === 'nafu:ready') {
        done = true
        setState('ok')
      }
    }
    window.addEventListener('message', onMsg)
    const hello = () => iframe.contentWindow?.postMessage({ type: 'nafu:hello' }, origin || '*')
    iframe.onload = () => {
      hello()
      setTimeout(hello, 1200)
    }
    const t = setTimeout(() => !done && setState('missing'), 9000)
    document.body.appendChild(iframe)
    return () => {
      clearTimeout(t)
      window.removeEventListener('message', onMsg)
      iframe.remove()
    }
  }, [url])
  return state
}

export default function Preview({ client, isAdmin }: { client: Client; isAdmin: boolean }) {
  const toast = useToast()
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Review | null>(null)
  const [adding, setAdding] = useState<null | 'concept' | 'page'>(null)

  const load = useCallback(async () => {
    const list = await listReviews(client.id)
    setReviews(list)
    setThumbs(await signedUrls(list.filter((r) => r.file?.path).map((r) => r.file!.path!)))
  }, [client.id])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  if (!reviews) return <Spinner />
  const concepts = reviews.filter((r) => r.kind === 'concept')
  const pages = reviews.filter((r) => r.kind === 'page')

  return (
    <div className="ws">
      {isAdmin && <ScriptReminder />}

      <section className="card ws-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Koncept</h2>
          {isAdmin && (
            <button className="btn btn-sm" onClick={() => setAdding('concept')}>
              <Icon name="plus" size={15} /> Dodaj koncept
            </button>
          )}
        </div>
        <p className="muted ws-lead">
          {isAdmin ? 'Wstępna wizualizacja, key visual. Klient ogląda, komentuje i akceptuje.' : 'Wstępna wizualizacja kierunku, w którym pójdzie Twoja strona. Obejrzyj, napisz, co myślisz, i daj znać, czy akceptujesz.'}
        </p>
        {concepts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{isAdmin ? 'Nie dodano jeszcze konceptu.' : 'Koncept pojawi się tutaj, gdy będzie gotowy.'}</p>
        ) : (
          <div className="concept-grid">
            {concepts.map((c) => (
              <button key={c.id} className="concept-card card" onClick={() => setOpen(c)}>
                <div className="concept-img">{c.file?.path && thumbs[c.file.path] ? <img src={thumbs[c.file.path]} alt={c.title} /> : <Icon name="eye" size={28} />}</div>
                <div className="concept-info">
                  <strong>{c.title}</strong>
                  <span className={`badge ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card ws-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Podgląd strony</h2>
          {isAdmin && (
            <button className="btn btn-sm" onClick={() => setAdding('page')}>
              <Icon name="plus" size={15} /> Dodaj podstronę
            </button>
          )}
        </div>
        <p className="muted ws-lead">
          {isAdmin
            ? 'Linki do roboczego podglądu. Klient otwiera podstronę, zaznacza uwagi pinezkami i akceptuje każdą podstronę osobno.'
            : 'Tak powstaje Twoja strona. Otwórz podstronę, kliknij „Dodaj uwagę” i wskaż miejsce, którego dotyczy. Gdy podstrona jest w porządku, kliknij „Akceptuję”.'}
        </p>
        {pages.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{isAdmin ? 'Nie dodano jeszcze podglądu.' : 'Podgląd pojawi się tutaj, gdy będzie gotowy.'}</p>
        ) : (
          <div className="svc-list">
            {pages.map((p) => (
              <PageRow key={p.id} page={p} isAdmin={isAdmin} onOpen={() => setOpen(p)} onDelete={async () => {
                if (!confirm(`Usunąć podstronę „${p.title}” razem z uwagami?`)) return
                await deleteReview(p.id)
                load()
              }} />
            ))}
          </div>
        )}
      </section>

      {!isAdmin && reviews.length === 0 && (
        <Empty title="Tu zobaczysz swoją stronę" text="Gdy przygotuję koncept i roboczy podgląd, pojawią się tutaj. Dostaniesz ode mnie wiadomość." />
      )}

      {adding && <AddModal kind={adding} client={client} onClose={() => setAdding(null)} onSaved={load} />}
      {open?.kind === 'concept' && (
        <ConceptViewer review={open} imageUrl={open.file?.path ? thumbs[open.file.path] : undefined} isAdmin={isAdmin} onClose={() => { setOpen(null); load() }} />
      )}
      {open?.kind === 'page' && <PageViewer review={open} pages={pages} isAdmin={isAdmin} onClose={() => { setOpen(null); load() }} onSwitch={setOpen} />}
    </div>
  )
}

function ScriptReminder() {
  const toast = useToast()
  return (
    <div className="script-note">
      <div>
        <strong>Pamiętaj: skrypt pinezek w wersji podglądowej projektu</strong>
        <p>
          Dodaj tę linijkę do sekcji <code>&lt;head&gt;</code> podglądu. Dzięki niej klient zaznacza uwagi w konkretnych miejscach strony. W Next.js na Vercelu wstaw ją w <code>layout</code> tylko dla podglądu, w WebWave w ustawieniach strony, w polu na własny kod. Podgląd na Vercelu musi mieć wyłączoną ochronę (Deployment Protection), inaczej nie wyświetli się w panelu. Przed publikacją usuń skrypt z wersji produkcyjnej.
        </p>
        <code className="script-code">{FEEDBACK_SCRIPT}</code>
      </div>
      <button className="btn btn-sm btn-primary" onClick={() => copyText(FEEDBACK_SCRIPT).then(() => toast('Skopiowano skrypt'))}>
        <Icon name="copy" size={15} /> Kopiuj
      </button>
    </div>
  )
}

function PageRow({ page, isAdmin, onOpen, onDelete }: { page: Review; isAdmin: boolean; onOpen: () => void; onDelete: () => void }) {
  const probe = useScriptProbe(isAdmin ? page.url : null)
  return (
    <div className="svc-row">
      <button className="svc-main" onClick={onOpen}>
        <strong>{page.title}</strong>
        <span className="muted" style={{ wordBreak: 'break-all' }}>{page.url}</span>
      </button>
      <div className="row">
        {isAdmin && (
          <span className={`badge ${probe === 'ok' ? 'submitted' : probe === 'missing' ? 'in_progress' : 'draft'}`} title="Skrypt pinezek na podglądzie">
            {probe === 'ok' ? 'Pinezki działają' : probe === 'missing' ? 'Brak skryptu pinezek' : 'Sprawdzam skrypt…'}
          </span>
        )}
        <span className={`badge ${STATUS[page.status][1]}`}>{STATUS[page.status][0]}</span>
        <button className="btn btn-sm btn-primary" onClick={onOpen}>
          <Icon name="eye" size={15} /> Otwórz
        </button>
        {isAdmin && (
          <button className="btn btn-ghost btn-icon" aria-label="Usuń" onClick={onDelete}>
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

function AddModal({ kind, client, onClose, onSaved }: { kind: 'concept' | 'page'; client: Client; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [title, setTitle] = useState(kind === 'page' ? 'Strona główna' : 'Koncept')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Modal label={kind === 'page' ? 'Dodaj podstronę' : 'Dodaj koncept'} onClose={onClose}>
      <div className="eyebrow">Podgląd strony</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>{kind === 'page' ? 'Dodaj podstronę do podglądu' : 'Dodaj koncept'}</h2>
      <div className="stack">
        <Field label={kind === 'page' ? 'Nazwa podstrony' : 'Tytuł'} value={title} onChange={setTitle} />
        {kind === 'page' ? (
          <>
            <Field label="Link do roboczego podglądu" value={url} onChange={setUrl} placeholder="https://projekt-klienta.vercel.app/o-nas" />
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Pamiętaj o skrypcie pinezek w wersji podglądowej: {FEEDBACK_SCRIPT}</p>
          </>
        ) : (
          <label className="field">
            <span className="label">Grafika (JPG, PNG, WebP lub PDF)</span>
            <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        <Field label="Opis dla klienta (opcjonalnie)" value={note} onChange={setNote} textarea />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            if (!title.trim()) return toast('Wpisz nazwę.')
            setBusy(true)
            try {
              if (kind === 'page') {
                if (!/^https?:\/\//i.test(url.trim())) throw new Error('Link musi zaczynać się od https://')
                await saveReview({ client_id: client.id, kind: 'page', title: title.trim(), url: url.trim(), note: note || null })
              } else {
                if (!file) throw new Error('Wybierz plik z konceptem.')
                await addConcept(client.id, title.trim(), file, note)
              }
              await onSaved()
              onClose()
            } catch (e) {
              toast((e as Error).message)
              setBusy(false)
            }
          }}
        >
          Dodaj
        </button>
      </div>
    </Modal>
  )
}

function Decision({ review, isAdmin, onChanged }: { review: Review; isAdmin: boolean; onChanged: (s: ReviewStatus) => void }) {
  const toast = useToast()
  const decide = async (s: ReviewStatus) => {
    try {
      await decideReview(review.id, s)
      onChanged(s)
      toast(s === 'approved' ? 'Zaakceptowano, dziękuję!' : s === 'changes' ? 'Zapisano: do poprawy' : 'Przywrócono do decyzji')
    } catch (e) {
      toast((e as Error).message)
    }
  }
  return (
    <div className="decision">
      <span className={`badge ${STATUS[review.status][1]}`}>{STATUS[review.status][0]}</span>
      {review.status !== 'approved' && (
        <button className="btn btn-sm btn-primary" onClick={() => decide('approved')}>
          ✓ Akceptuję
        </button>
      )}
      {review.status !== 'changes' && (
        <button className="btn btn-sm" onClick={() => decide('changes')}>
          Proszę o zmiany
        </button>
      )}
      {isAdmin && review.status !== 'pending' && (
        <button className="btn btn-sm btn-ghost" onClick={() => decide('pending')}>
          Cofnij decyzję
        </button>
      )}
    </div>
  )
}

function CommentList({
  comments, isAdmin, active, onPick, onChanged,
}: {
  comments: ReviewComment[]
  isAdmin: boolean
  active?: number | null
  onPick?: (n: number) => void
  onChanged: () => void
}) {
  const open = async (path: string | null, url: string | null) => {
    if (url) return window.open(url, '_blank', 'noopener')
    if (!path) return
    const u = (await signedUrls([path]))[path]
    if (u) window.open(u, '_blank', 'noopener')
  }
  if (!comments.length) return <p className="muted" style={{ fontSize: 14 }}>Brak uwag.</p>
  return (
    <div className="c-list">
      {comments.map((c) => (
        <div key={c.id} className={`c-item${c.resolved ? ' resolved' : ''}${active != null && c.pin === active ? ' active' : ''}`} id={c.pin ? `pin-${c.pin}` : undefined}>
          <div className="c-head">
            {c.pin ? (
              <button className="c-pin" onClick={() => onPick?.(c.pin!)} title="Pokaż na stronie">
                <span>{c.pin}</span>
              </button>
            ) : (
              <span className="c-pin plain">•</span>
            )}
            <span className="muted">
              {c.from_admin ? 'Natalia' : 'Klient'} · {fmtDate(c.created_at)}
            </span>
          </div>
          <div className="c-body">{c.body}</div>
          {c.file && (
            <button className="msg-file" onClick={() => open(c.file!.path, c.file!.url)}>
              <Icon name="doc" size={15} /> {c.file.name}
            </button>
          )}
          <div className="row" style={{ marginTop: 6 }}>
            {isAdmin && (
              <button className="btn btn-ghost btn-sm" onClick={async () => { await resolveComment(c); onChanged() }}>
                {c.resolved ? 'Przywróć' : '✓ Poprawione'}
              </button>
            )}
            {c.resolved && !isAdmin && <span className="badge submitted">Poprawione</span>}
            {isAdmin && (
              <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('Usunąć uwagę?')) { await deleteComment(c.id); onChanged() } }}>
                Usuń
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function CommentForm({ onSend, pinNo, onCancelPin, placeholder }: { onSend: (body: string, file?: File) => Promise<void>; pinNo?: number | null; onCancelPin?: () => void; placeholder?: string }) {
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (pinNo) ta.current?.focus()
  }, [pinNo])
  return (
    <div className="c-form">
      {pinNo != null && (
        <div className="c-pinnote">
          <span className="c-pin"><span>{pinNo}</span></span> Uwaga do zaznaczonego miejsca
          <button className="btn btn-ghost btn-sm" onClick={onCancelPin}>
            Anuluj
          </button>
        </div>
      )}
      <textarea ref={ta} className="textarea" style={{ minHeight: 80 }} placeholder={placeholder ?? 'Napisz uwagę…'} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="row">
        <button className="btn btn-sm" onClick={() => input.current?.click()}>
          <Icon name="plus" size={15} /> {file ? file.name : 'Zrzut ekranu'}
        </button>
        <span className="spacer" />
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !body.trim()}
          onClick={async () => {
            setBusy(true)
            try {
              await onSend(body.trim(), file ?? undefined)
              setBody('')
              setFile(null)
            } finally {
              setBusy(false)
            }
          }}
        >
          Dodaj uwagę
        </button>
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    </div>
  )
}

function ConceptViewer({ review, imageUrl, isAdmin, onClose }: { review: Review; imageUrl?: string; isAdmin: boolean; onClose: () => void }) {
  const [r, setR] = useState(review)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const load = useCallback(() => listComments(review.id).then(setComments), [review.id])
  useEffect(() => {
    load()
  }, [load])
  const isPdf = review.file?.mime === 'application/pdf'
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <strong>{r.title}</strong>
        <Decision review={r} isAdmin={isAdmin} onChanged={(s) => setR({ ...r, status: s })} />
        <span className="spacer" />
        <button className="btn btn-sm" onClick={onClose}>
          Zamknij
        </button>
      </div>
      <div className="viewer-body">
        <div className="viewer-stage concept">
          {imageUrl ? isPdf ? <iframe src={imageUrl} title={r.title} /> : <img src={imageUrl} alt={r.title} /> : <Spinner />}
        </div>
        <aside className="viewer-side">
          {r.note && <p className="muted" style={{ marginTop: 0 }}>{r.note}</p>}
          <h3 className="ws-sub" style={{ marginTop: 0 }}>Uwagi</h3>
          <CommentList comments={comments} isAdmin={isAdmin} onChanged={load} />
          <CommentForm
            placeholder="Co Ci się podoba, co zmienić?"
            onSend={async (body, file) => {
              await addComment(r, body, isAdmin, { file })
              load()
            }}
          />
        </aside>
      </div>
    </div>
  )
}

function PageViewer({ review, pages, isAdmin, onClose, onSwitch }: { review: Review; pages: Review[]; isAdmin: boolean; onClose: () => void; onSwitch: (r: Review) => void }) {
  const toast = useToast()
  const [r, setR] = useState(review)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [script, setScript] = useState<'checking' | 'ok' | 'missing'>('checking')
  const [path, setPath] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [pin, setPin] = useState<PinData | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [filter, setFilter] = useState<'page' | 'all'>('page')
  const frame = useRef<HTMLIFrameElement>(null)
  const origin = originOf(review.url ?? '')

  useEffect(() => setR(review), [review])

  const load = useCallback(() => listComments(review.id).then(setComments), [review.id])
  useEffect(() => {
    load()
  }, [load])

  const post = useCallback((msg: unknown) => frame.current?.contentWindow?.postMessage(msg, origin || '*'), [origin])

  // rozmowa ze skryptem na podglądzie
  useEffect(() => {
    setScript('checking')
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin) return
      const m = e.data || {}
      if (m.type === 'nafu:ready' || m.type === 'nafu:nav') {
        setScript('ok')
        setPath(m.path)
      } else if (m.type === 'nafu:pick') {
        setPicking(false)
        setPin(m.data)
      } else if (m.type === 'nafu:pinclick') {
        setActive(m.n)
        setFilter('page')
        setTimeout(() => document.getElementById(`pin-${m.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      }
    }
    window.addEventListener('message', onMsg)
    const t = setTimeout(() => setScript((s) => (s === 'checking' ? 'missing' : s)), 9000)
    return () => {
      window.removeEventListener('message', onMsg)
      clearTimeout(t)
    }
  }, [origin, review.url])

  const pagePins = useMemo(() => comments.filter((c) => c.pin && c.path === path), [comments, path])
  useEffect(() => {
    if (script !== 'ok') return
    post({
      type: 'nafu:pins',
      pins: pagePins.map((c) => ({ n: c.pin, selector: c.selector, x_pct: c.x_pct, y_pct: c.y_pct, page_x: c.page_x, page_y: c.page_y, resolved: c.resolved })),
    })
  }, [pagePins, script, post])

  const nextPin = Math.max(0, ...comments.map((c) => c.pin ?? 0)) + 1
  const shown = filter === 'page' && path ? comments.filter((c) => !c.pin || c.path === path) : comments

  return (
    <div className="viewer">
      <div className="viewer-bar">
        {pages.length > 1 ? (
          <select className="select" style={{ width: 'auto', minWidth: 180 }} value={r.id} onChange={(e) => onSwitch(pages.find((p) => p.id === e.target.value)!)}>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        ) : (
          <strong>{r.title}</strong>
        )}
        <Decision review={r} isAdmin={isAdmin} onChanged={(s) => setR({ ...r, status: s })} />
        <span className="spacer" />
        {script === 'ok' ? (
          <button
            className={`btn btn-sm ${picking ? 'btn-dark' : 'btn-primary'}`}
            onClick={() => {
              const on = !picking
              setPicking(on)
              post({ type: 'nafu:mode', on })
            }}
          >
            {picking ? 'Kliknij miejsce na stronie… (anuluj)' : '+ Dodaj uwagę'}
          </button>
        ) : script === 'missing' ? (
          <span className="badge in_progress" title="Uwagi działają, ale bez wskazywania miejsca">
            {isAdmin ? 'Brak skryptu pinezek na podglądzie' : 'Uwagi dodasz w panelu obok'}
          </span>
        ) : (
          <span className="badge draft">Ładuję podgląd…</span>
        )}
        {r.url && (
          <a className="btn btn-sm" href={r.url} target="_blank" rel="noopener">
            Nowa karta
          </a>
        )}
        <button className="btn btn-sm" onClick={onClose}>
          Zamknij
        </button>
      </div>
      <div className="viewer-body">
        <div className="viewer-stage">
          {r.url && (
            <iframe
              ref={frame}
              key={r.url}
              src={r.url}
              title={r.title}
              onLoad={() => {
                post({ type: 'nafu:hello' })
                setTimeout(() => post({ type: 'nafu:hello' }), 1200)
              }}
            />
          )}
          {isAdmin && script === 'missing' && (
            <div className="viewer-warn">
              Nie wykryto skryptu pinezek. Jeśli widzisz pustą ramkę albo błąd, wyłącz ochronę podglądu na Vercelu (Deployment Protection). Skrypt do dodania: <code>{FEEDBACK_SCRIPT}</code>
              <button className="btn btn-sm" onClick={() => copyText(FEEDBACK_SCRIPT).then(() => toast('Skopiowano skrypt'))}>
                Kopiuj
              </button>
            </div>
          )}
        </div>
        <aside className="viewer-side">
          {r.note && <p className="muted" style={{ marginTop: 0 }}>{r.note}</p>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="ws-sub" style={{ margin: 0 }}>Uwagi ({comments.filter((c) => !c.resolved).length} otwarte)</h3>
            {script === 'ok' && (
              <div className="seg">
                <button className={filter === 'page' ? 'on' : ''} onClick={() => setFilter('page')}>
                  Ta strona
                </button>
                <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
                  Wszystkie
                </button>
              </div>
            )}
          </div>
          <CommentList
            comments={shown}
            isAdmin={isAdmin}
            active={active}
            onPick={(n) => {
              setActive(n)
              post({ type: 'nafu:scrollto', n })
            }}
            onChanged={load}
          />
          <CommentForm
            pinNo={pin ? nextPin : null}
            onCancelPin={() => setPin(null)}
            placeholder={script === 'ok' && !pin ? 'Uwaga ogólna do tej podstrony. Żeby wskazać miejsce, kliknij „Dodaj uwagę” u góry.' : undefined}
            onSend={async (body, file) => {
              await addComment(r, body, isAdmin, { file, pin: pin ?? undefined, pinNo: pin ? nextPin : undefined })
              setPin(null)
              await load()
            }}
          />
        </aside>
      </div>
    </div>
  )
}
