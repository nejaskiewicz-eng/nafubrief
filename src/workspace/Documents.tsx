import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Icon, Modal, Spinner, copyText, fmtDate, useToast } from '../components/ui'
import { renderMarkdown } from '../lib/markdown'
import { CLIENT_DOC_KINDS, DOC_KINDS, acceptDocument, addDocument, deleteDocument, deleteDocumentNote, docKind, docKindLabel, listDocumentNotes, listDocuments, saveDocumentNote, updateDocument, type ClientDocument, type DocKind } from '../lib/project'
import { logActivity } from '../lib/cases'
import type { Client } from '../lib/types'
import { signedUrls } from '../lib/workspace'
import { Empty, Field, Toggle } from './bits'

export default function Documents({
  client, isAdmin, adminTools, caseId, onChanged, only, locked,
}: {
  client: Client
  isAdmin: boolean
  adminTools?: ReactNode
  /** tylko dokumenty tej sprawy bieżącej; nowe dokumenty trafiają do niej */
  caseId?: string
  onChanged?: () => void
  /** w sprawie: tylko umowy ('contract') albo wszystko poza umowami ('other') */
  only?: 'contract' | 'other'
  /** sprawa zamknięta: klient nie dodaje ani nie usuwa */
  locked?: boolean
}) {
  const toast = useToast()
  const [docs, setDocs] = useState<ClientDocument[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [reading, setReading] = useState<ClientDocument | null>(null)
  const [readAt, setReadAt] = useState(0)
  // dziennik aktywności klienta w sprawie (administratorki nie zapisujemy)
  const log = (kind: string, label?: string, meta?: Record<string, unknown>) => !isAdmin && logActivity(caseId, kind, label, meta)
  const [cat, setCat] = useState<DocKind | 'all'>('all')

  const load = useCallback(async () => {
    const all = await listDocuments(client.id)
    const list = (caseId ? all.filter((d) => d.case_id === caseId) : all).filter((d) =>
      only === 'contract' ? d.kind === 'contract' : only === 'other' ? d.kind !== 'contract' : true,
    )
    if (isAdmin) {
      const notes = await listDocumentNotes(client.id).catch(() => ({}) as Record<string, string>)
      list.forEach((d) => (d.admin_note = notes[d.id] ?? null))
    }
    setDocs(list)
    onChanged?.()
  }, [client.id, isAdmin, caseId, onChanged, only])
  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  if (!docs) return <Spinner />

  const openFile = async (d: ClientDocument) => {
    log('document_opened', d.title)
    if (d.content) {
      setReadAt(Date.now())
      return setReading(d)
    }
    const p = d.file?.path
    if (!p) return
    const u = (await signedUrls([p]))[p]
    if (u) window.open(u, '_blank', 'noopener')
  }
  const accept = async (d: ClientDocument) => {
    if (!confirm(`Potwierdzasz, że zapoznałaś/eś się z dokumentem „${d.title}” i go akceptujesz?`)) return
    try {
      await acceptDocument(d.id)
      log('document_accepted', d.title)
      toast('Dziękuję, dokument zaakceptowany')
      load()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  // w sprawie dokumenty dodają obie strony; rozdzielamy je na dodane przez pracownię i przez klienta
  const bothSides = !!caseId && only !== 'contract'
  const clientCanAdd = bothSides && !isAdmin && !locked
  // kategorie: poziome menu nad listą (poza osobną sekcją umów w sprawie)
  const withCats = only !== 'contract'
  const label = (k: string) => docKindLabel(k, { isAdmin, inCase: !!caseId })
  const cats = DOC_KINDS.map((k) => ({ key: k, n: docs.filter((d) => docKind(d.kind) === k).length })).filter((c) => c.n > 0)
  const active = cat !== 'all' && cats.some((c) => c.key === cat) ? cat : 'all'
  const shown = withCats && active !== 'all' ? docs.filter((d) => docKind(d.kind) === active) : docs
  // kategorie do wyboru przy dodawaniu i zmianie
  const pickable: DocKind[] = isAdmin ? DOC_KINDS.filter((k) => (caseId ? k !== 'contract' : true)) : CLIENT_DOC_KINDS
  const groups = bothSides
    ? [
        { key: 'studio', title: isAdmin ? 'Dodane przeze mnie' : 'Od Natalii', list: shown.filter((d) => d.from_admin !== false) },
        { key: 'client', title: isAdmin ? 'Dodane przez klienta' : 'Dodane przez Ciebie', list: shown.filter((d) => d.from_admin === false) },
      ].filter((g) => g.list.length > 0)
    : [{ key: 'all', title: '', list: shown }]

  return (
    <div className="ws">
      {!caseId && adminTools}

      {clientCanAdd && (
        <div className="ws-savebar">
          <span className="muted" style={{ fontSize: 14 }}>Tu dodasz własne dokumenty do tej sprawy, na przykład umowę, faktury albo raporty.</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Dodaj dokument
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="ws-savebar">
          <span className="muted" style={{ fontSize: 14 }}>Umowy, gotowe dokumenty i inne pliki dla klienta, z akceptacją online.</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> {only === 'contract' ? 'Dodaj umowę' : 'Dodaj dokument'}
          </button>
        </div>
      )}

      {withCats && docs.length > 0 && (
        <div className="doc-cats" role="tablist" aria-label="Kategorie dokumentów">
          <button role="tab" aria-selected={active === 'all'} className={active === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
            Wszystkie <span>{docs.length}</span>
          </button>
          {cats.map((c) => (
            <button key={c.key} role="tab" aria-selected={active === c.key} className={active === c.key ? 'on' : ''} onClick={() => setCat(c.key)}>
              {label(c.key)} <span>{c.n}</span>
            </button>
          ))}
        </div>
      )}

      {docs.length === 0 ? (
        caseId ? (
          <p className="muted" style={{ margin: 0 }}>
            {only === 'contract'
              ? isAdmin ? 'Brak umów w tej sprawie.' : 'Umowy do tej sprawy pojawią się tutaj.'
              : isAdmin ? 'Brak dokumentów w tej sprawie.' : 'Dokumenty do tej sprawy pojawią się tutaj.'}
          </p>
        ) : (
        <Empty title={isAdmin ? 'Brak dokumentów' : 'Tu znajdziesz dokumenty'} text={isAdmin ? 'Dodaj umowę albo przygotuj dokumenty prawne.' : 'Umowa i dokumenty do Twojej strony pojawią się tutaj. Dostaniesz ode mnie wiadomość.'} />
        )
      ) : (
        groups.map((g) => (
        <div key={g.key} className="doc-group">
        {g.title && (
          <div className={`doc-group-title ${g.key}`}>
            {g.title} <span className="muted">({g.list.length})</span>
          </div>
        )}
        <div className="card">
          {g.list.map((d) => {
            const fromClient = d.from_admin === false
            return (
            <div className="brief-row doc-row" key={d.id}>
              <div className="brief-icon" style={{ background: fromClient ? 'linear-gradient(135deg,#b7791f,#e0a84a)' : d.visible ? 'linear-gradient(135deg,#0a7189,#02afca)' : '#8aa0a7' }}>
                <Icon name="doc" size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3>{d.title}</h3>
                <div className="meta">
                  {isAdmin && !d.visible && <span className="badge draft">Szkic, widoczny tylko dla Ciebie</span>}
                  {fromClient ? null : d.requires_acceptance ? (
                    d.accepted_at ? (
                      <span className="badge submitted">Zaakceptowany {fmtDate(d.accepted_at)}</span>
                    ) : (
                      d.visible && <span className="badge in_progress">Czeka na akceptację</span>
                    )
                  ) : (
                    <span className="badge sent">Do wiadomości</span>
                  )}
                  {withCats && (isAdmin ? (
                    <select
                      className="doc-cat-select"
                      aria-label="Kategoria dokumentu"
                      value={docKind(d.kind)}
                      onChange={async (e) => {
                        try {
                          await updateDocument(d.id, { kind: e.target.value })
                          load()
                        } catch (err) {
                          toast((err as Error).message)
                        }
                      }}
                    >
                      {(pickable.includes(docKind(d.kind)) ? pickable : [docKind(d.kind), ...pickable]).map((k) => (
                        <option key={k} value={k}>{label(k)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="doc-cat-tag">{label(d.kind)}</span>
                  ))}
                  <span>dodano {fmtDate(d.created_at)}</span>
                </div>
                <div className="actions doc-actions">
                  <button className="btn btn-sm" onClick={() => openFile(d)}>
                    <Icon name="eye" size={15} /> {d.content ? 'Czytaj' : 'Otwórz'}
                  </button>
                  {!isAdmin && d.requires_acceptance && !d.accepted_at && (
                    <button className="btn btn-sm btn-primary" onClick={() => accept(d)}>
                      ✓ Akceptuję
                    </button>
                  )}
                  {!isAdmin && fromClient && !locked && (
                    <button
                      className="btn btn-sm btn-danger"
                      aria-label="Usuń dokument"
                      onClick={async () => {
                        if (!confirm(`Usunąć „${d.title}”?`)) return
                        try {
                          await deleteDocument(d.id)
                          log('document_removed', d.title)
                          load()
                        } catch (e) {
                          toast((e as Error).message)
                        }
                      }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                  {isAdmin && fromClient && (
                    <button
                      className="btn btn-sm btn-danger"
                      aria-label="Usuń dokument"
                      onClick={async () => {
                        if (!confirm(`Usunąć „${d.title}”? To dokument dodany przez klienta.`)) return
                        await deleteDocument(d.id)
                        load()
                      }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                  {isAdmin && !fromClient && (
                    <>
                      <button
                        className={`btn btn-sm ${d.visible ? '' : 'btn-primary'}`}
                        onClick={async () => {
                          if (!d.visible && d.content?.includes('[DO UZUPEŁNIENIA')) {
                            if (!confirm('W treści są jeszcze znaczniki [DO UZUPEŁNIENIA]. Klient je zobaczy. Udostępnić mimo to?')) return
                          }
                          await updateDocument(d.id, { visible: !d.visible })
                          toast(d.visible ? 'Ukryto przed klientem' : 'Udostępniono klientowi')
                          load()
                        }}
                      >
                        {d.visible ? 'Ukryj przed klientem' : 'Udostępnij klientowi'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={async () => {
                          if (!confirm(`Usunąć „${d.title}”?`)) return
                          await deleteDocument(d.id)
                          load()
                        }}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </>
                  )}
                </div>
                {isAdmin && fromClient ? (
                  <>
                    {d.note && (
                      <div className="doc-note doc-note-client">
                        <strong>Opis od klienta:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{d.note}</span>
                      </div>
                    )}
                    <DocNotes doc={d} onChanged={load} kinds={['internal']} />
                  </>
                ) : isAdmin ? (
                  <DocNotes doc={d} onChanged={load} />
                ) : fromClient ? (
                  d.note && (
                    <div className="doc-note doc-note-client">
                      <span style={{ whiteSpace: 'pre-wrap' }}>{d.note}</span>
                    </div>
                  )
                ) : (
                  d.note && (
                    <div className="doc-note doc-note-client">
                      <strong>Notatka:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{d.note}</span>
                    </div>
                  )
                )}
                {isAdmin && d.content?.includes('[DO UZUPEŁNIENIA') && <span className="badge in_progress" style={{ marginTop: 6 }}>Są miejsca do uzupełnienia</span>}
              </div>
            </div>
            )
          })}
        </div>
        </div>
        ))
      )}

      {adding && (
        <AddDoc
          asClient={!isAdmin}
          kinds={only === 'contract' ? undefined : pickable.map((k) => ({ key: k, label: label(k) }))}
          initialKind={active !== 'all' && pickable.includes(active) ? active : 'other'}
          onClose={() => setAdding(false)}
          onSave={async (title, file, requires, visible, note, kind) => {
            await addDocument(client.id, title, file, isAdmin
              ? { requiresAcceptance: requires, visible, note, caseId, kind: only === 'contract' ? 'contract' : kind }
              : { requiresAcceptance: false, visible: true, note, caseId, kind })
            setAdding(false)
            log('document_added', title)
            if (!isAdmin) toast('Dodano dokument')
            load()
          }}
        />
      )}
      {reading && (
        <DocReader
          doc={reading}
          isAdmin={isAdmin}
          onClose={() => {
            log('document_closed', reading.title, { seconds: Math.round((Date.now() - readAt) / 1000) })
            setReading(null)
          }}
          onSaved={async (content, title) => {
            await updateDocument(reading.id, { content, title })
            setReading({ ...reading, content, title })
            toast('Zapisano zmiany')
            load()
          }}
          onAccept={!isAdmin && reading.requires_acceptance && !reading.accepted_at ? () => { setReading(null); accept(reading) } : undefined}
        />
      )}
    </div>
  )
}

export function AddDoc({ onClose, onSave, asClient, kinds, initialKind }: { onClose: () => void; onSave: (title: string, file: File, requires: boolean, visible: boolean, note: string, kind?: string) => Promise<void>; asClient?: boolean; kinds?: Array<{ key: string; label: string }>; initialKind?: string }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [requires, setRequires] = useState(true)
  const [visible, setVisible] = useState(true)
  const [kind, setKind] = useState(initialKind ?? 'other')
  const [busy, setBusy] = useState(false)
  return (
    <Modal label="Dodaj dokument" onClose={onClose}>
      <div className="eyebrow">Dokumenty</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Dodaj dokument</h2>
      <div className="stack">
        <Field label="Nazwa" value={title} onChange={setTitle} placeholder={asClient ? 'np. Umowa z agencją' : 'np. Umowa na wykonanie strony'} />
        <label className="field">
          <span className="label">Plik (najlepiej PDF)</span>
          <input className="input" type="file" accept="application/pdf,.doc,.docx,image/*" onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''))
          }} />
        </label>
        {kinds && (
          <label className="field">
            <span className="label">Kategoria</span>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </label>
        )}
        <Field label={asClient ? 'Opis (opcjonalnie)' : 'Opis dla klienta (opcjonalnie)'} value={note} onChange={setNote} textarea />
        {!asClient && <Toggle checked={requires} onChange={setRequires} label="Wymaga akceptacji klienta" />}
        {!asClient && <Toggle checked={visible} onChange={setVisible} label="Od razu widoczny dla klienta (wyłącz, żeby zapisać jako szkic)" />}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={async () => {
          if (!title.trim() || !file) return toast('Podaj nazwę i wybierz plik.')
          setBusy(true)
          try {
            await onSave(title.trim(), file, requires, visible, note.trim(), kinds ? kind : undefined)
          } catch (e) {
            toast((e as Error).message)
            setBusy(false)
          }
        }}>
          Dodaj
        </button>
      </div>
    </Modal>
  )
}

export function DocReader({ doc, isAdmin, onClose, onSaved, onAccept, onRead }: { doc: ClientDocument; isAdmin: boolean; onClose: () => void; onSaved: (c: string, title: string) => Promise<void>; onAccept?: () => void; /** zadanie „przeczytaj”: potwierdzenie lektury odhacza zadanie */ onRead?: () => void }) {
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(doc.content ?? '')
  const [title, setTitle] = useState(doc.title)
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <strong>{doc.title}</strong>
        <span className="spacer" />
        {isAdmin && (
          <button className="btn btn-sm" onClick={async () => {
            if (edit) await onSaved(text, title.trim() || doc.title)
            setEdit(!edit)
          }}>
            {edit ? 'Zapisz' : <><Icon name="edit" size={15} /> Edytuj</>}
          </button>
        )}
        <button className="btn btn-sm" onClick={() => window.print()}>
          <Icon name="print" size={15} /> PDF
        </button>
        {onAccept && (
          <button className="btn btn-sm btn-primary" onClick={onAccept}>
            ✓ Akceptuję
          </button>
        )}
        {onRead && (
          <button className="btn btn-sm btn-primary" onClick={onRead}>
            ✓ Przeczytane
          </button>
        )}
        <button className="btn btn-sm" onClick={onClose}>
          Zamknij
        </button>
      </div>
      <div className="doc-read">
        {edit && (
          <label className="field">
            <span className="label">Tytuł dokumentu (widzi go klient)</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        )}
        {edit ? (
          <textarea className="textarea" style={{ minHeight: '70vh', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13.5 }} value={text} onChange={(e) => setText(e.target.value)} />
        ) : (
          <article className="md card" style={{ padding: '32px 40px' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
        )}
      </div>
    </div>
  )
}

type NoteKind = 'internal' | 'client'
const NOTE_LABEL: Record<NoteKind, string> = {
  internal: 'Notatka wewnętrzna (klient jej nie widzi)',
  client: 'Notatka dla klienta (klient ją widzi)',
}

/** Notatki do dokumentu: wewnętrzna (document_notes) i dla klienta (client_documents.note). Dodanie, edycja, zmiana rodzaju, usunięcie. */
function DocNotes({ doc, onChanged, kinds = ['internal', 'client'] }: { doc: ClientDocument; onChanged: () => Promise<void>; kinds?: NoteKind[] }) {
  const toast = useToast()
  const [editing, setEditing] = useState<{ from: NoteKind | null; kind: NoteKind; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const value = (k: NoteKind) => (k === 'internal' ? doc.admin_note : doc.note) ?? ''
  const write = async (k: NoteKind, body: string) => {
    if (k === 'internal') {
      if (body) await saveDocumentNote(doc, body)
      else await deleteDocumentNote(doc.id)
    } else await updateDocument(doc.id, { note: body || null })
  }

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const text = editing.text.trim()
      const { from, kind } = editing
      if (from && from !== kind) {
        // zmiana rodzaju: przenosimy treść, a jeśli tam już coś jest, dopisujemy
        const existing = value(kind).trim()
        await write(kind, [existing, text].filter(Boolean).join('\n\n'))
        await write(from, '')
      } else {
        await write(kind, text)
      }
      setEditing(null)
      await onChanged()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (k: NoteKind) => {
    if (!confirm(k === 'internal' ? 'Usunąć notatkę wewnętrzną?' : 'Usunąć notatkę dla klienta? Zniknie też u klienta.')) return
    try {
      await write(k, '')
      await onChanged()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const shown = kinds.filter((k) => value(k) && editing?.from !== k)
  const free = kinds.filter((k) => !value(k))

  // przełączenie rodzaju istniejącej notatki jednym kliknięciem
  const switchKind = async (from: NoteKind, to: NoteKind) => {
    if (from === to) return
    const target = value(to).trim()
    if (to === 'client' && !confirm(doc.visible ? 'Klient od razu zobaczy tę notatkę. Zmienić na notatkę dla klienta?' : 'Klient zobaczy tę notatkę po udostępnieniu dokumentu. Zmienić na notatkę dla klienta?')) return
    if (target && !confirm('Jest już notatka tego rodzaju. Dopisać do niej tę treść?')) return
    setBusy(true)
    try {
      await write(to, [target, value(from).trim()].filter(Boolean).join('\n\n'))
      await write(from, '')
      await onChanged()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const KindSwitch = ({ current, onPick }: { current: NoteKind; onPick: (k: NoteKind) => void }) => (
    <div className="note-kind" role="radiogroup" aria-label="Rodzaj notatki">
      {kinds.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={current === k} disabled={busy} className={`note-kind-opt${current === k ? ' on' : ''}`} onClick={() => onPick(k)}>
          {k === 'internal' ? 'Wewnętrzna' : 'Dla klienta'}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {shown.map((k) => (
        <div key={k} className={`doc-note ${k === 'internal' ? 'admin-note' : 'doc-note-client'}`}>
          <div className="doc-note-head">
            <KindSwitch current={k} onPick={(to) => switchKind(k, to)} />
            <span className="muted" style={{ fontSize: 12.5 }}>{k === 'internal' ? 'klient jej nie widzi' : 'klient ją widzi'}</span>
            <span className="spacer" />
            <span className="admin-note-tools">
              <button className="link-btn" onClick={() => setEditing({ from: k, kind: k, text: value(k) })}>
                edytuj
              </button>
              {' · '}
              <button className="link-btn" onClick={() => remove(k)}>
                usuń
              </button>
            </span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{value(k)}</div>
        </div>
      ))}
      {editing && (
        <div className="admin-note admin-note-edit">
          <div className="doc-note-head">
            <KindSwitch current={editing.kind} onPick={(k) => setEditing({ ...editing, kind: k })} />
            <span className="muted" style={{ fontSize: 12.5 }}>
              {editing.kind === 'internal' ? 'Widzisz ją tylko Ty.' : doc.visible ? 'Klient zobaczy ją pod tytułem dokumentu.' : 'Klient zobaczy ją po udostępnieniu dokumentu.'}
              {editing.from && editing.from !== editing.kind && value(editing.kind) ? ' Treść zostanie dopisana do istniejącej notatki tego rodzaju.' : ''}
            </span>
          </div>
          <textarea className="textarea" style={{ minHeight: 110 }} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} autoFocus />
          <div className="row">
            <button className="btn btn-sm" onClick={() => setEditing(null)}>
              Anuluj
            </button>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={save}>
              Zapisz
            </button>
          </div>
        </div>
      )}
      {!editing && free.length > 0 && (
        <div className="row" style={{ marginTop: 6, gap: 4 }}>
          {free.map((k) => (
            <button key={k} className="btn btn-ghost btn-sm" onClick={() => setEditing({ from: null, kind: k, text: '' })}>
              <Icon name="plus" size={14} /> {k === 'internal' ? 'Notatka wewnętrzna' : 'Notatka dla klienta'}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
