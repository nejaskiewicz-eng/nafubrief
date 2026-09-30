import { useCallback, useEffect, useState } from 'react'
import { Icon, Modal, Spinner, copyText, fmtDate, useToast } from '../components/ui'
import { renderMarkdown } from '../lib/markdown'
import { acceptDocument, addDocument, deleteDocument, listDocuments, updateDocument, type ClientDocument } from '../lib/project'
import type { Client } from '../lib/types'
import { signedUrls } from '../lib/workspace'
import { Empty, Field, Toggle } from './bits'

export default function Documents({ client, isAdmin }: { client: Client; isAdmin: boolean }) {
  const toast = useToast()
  const [docs, setDocs] = useState<ClientDocument[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [reading, setReading] = useState<ClientDocument | null>(null)

  const load = useCallback(async () => setDocs(await listDocuments(client.id)), [client.id])
  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  if (!docs) return <Spinner />

  const openFile = async (d: ClientDocument) => {
    if (d.content) return setReading(d)
    const p = d.file?.path
    if (!p) return
    const u = (await signedUrls([p]))[p]
    if (u) window.open(u, '_blank', 'noopener')
  }
  const accept = async (d: ClientDocument) => {
    if (!confirm(`Potwierdzasz, że zapoznałaś/eś się z dokumentem „${d.title}” i go akceptujesz?`)) return
    try {
      await acceptDocument(d.id)
      toast('Dziękuję, dokument zaakceptowany')
      load()
    } catch (e) {
      toast((e as Error).message)
    }
  }
  const command = `Przygotuj dokumenty prawne dla klienta ${client.slug} (NAFU Brief).`

  return (
    <div className="ws">
      {isAdmin && (
        <div className="script-note">
          <div>
            <strong>Dokumenty prawne przygotujesz w Claude, z Twoimi skillami prawnymi</strong>
            <p>
              Skopiuj polecenie i wklej je w Claude (projekt nafu-brief). Claude pobierze ankietę prawną, profil, salony, zespół i usługi klienta, przygotuje szkice na Twoich skillach i doda je tutaj jako <b>szkice widoczne tylko dla Ciebie</b>. Po sprawdzeniu klikasz „Udostępnij klientowi”.
            </p>
            <code className="script-code">{command}</code>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => copyText(command).then(() => toast('Skopiowano polecenie'))}>
            <Icon name="copy" size={15} /> Kopiuj polecenie
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="ws-savebar">
          <span className="muted" style={{ fontSize: 14 }}>Umowy, gotowe dokumenty i inne pliki dla klienta, z akceptacją online.</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Dodaj dokument
          </button>
        </div>
      )}

      {docs.length === 0 ? (
        <Empty title={isAdmin ? 'Brak dokumentów' : 'Tu znajdziesz dokumenty'} text={isAdmin ? 'Dodaj umowę albo przygotuj dokumenty prawne w Claude.' : 'Umowa i dokumenty do Twojej strony pojawią się tutaj. Dostaniesz ode mnie wiadomość.'} />
      ) : (
        <div className="card">
          {docs.map((d) => (
            <div className="brief-row" key={d.id}>
              <div className="brief-icon" style={{ background: d.visible ? 'linear-gradient(135deg,#0a7189,#02afca)' : '#8aa0a7' }}>
                <Icon name="doc" size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3>{d.title}</h3>
                <div className="meta">
                  {isAdmin && !d.visible && <span className="badge draft">Szkic, widoczny tylko dla Ciebie</span>}
                  {d.requires_acceptance ? (
                    d.accepted_at ? (
                      <span className="badge submitted">Zaakceptowany {fmtDate(d.accepted_at)}</span>
                    ) : (
                      d.visible && <span className="badge in_progress">Czeka na akceptację</span>
                    )
                  ) : (
                    <span className="badge sent">Do wiadomości</span>
                  )}
                  <span>dodano {fmtDate(d.created_at)}</span>
                </div>
                {d.note && <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{d.note}</p>}
              </div>
              <div className="actions">
                <button className="btn btn-sm" onClick={() => openFile(d)}>
                  <Icon name="eye" size={15} /> {d.content ? 'Czytaj' : 'Otwórz'}
                </button>
                {!isAdmin && d.requires_acceptance && !d.accepted_at && (
                  <button className="btn btn-sm btn-primary" onClick={() => accept(d)}>
                    ✓ Akceptuję
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button
                      className={`btn btn-sm ${d.visible ? '' : 'btn-primary'}`}
                      onClick={async () => {
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
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddDoc
          onClose={() => setAdding(false)}
          onSave={async (title, file, requires, visible, note) => {
            await addDocument(client.id, title, file, { requiresAcceptance: requires, visible, note })
            setAdding(false)
            load()
          }}
        />
      )}
      {reading && (
        <DocReader
          doc={reading}
          isAdmin={isAdmin}
          onClose={() => setReading(null)}
          onSaved={async (content) => {
            await updateDocument(reading.id, { content })
            toast('Zapisano zmiany')
            load()
          }}
          onAccept={!isAdmin && reading.requires_acceptance && !reading.accepted_at ? () => { setReading(null); accept(reading) } : undefined}
        />
      )}
    </div>
  )
}

function AddDoc({ onClose, onSave }: { onClose: () => void; onSave: (title: string, file: File, requires: boolean, visible: boolean, note: string) => Promise<void> }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [requires, setRequires] = useState(true)
  const [visible, setVisible] = useState(true)
  const [busy, setBusy] = useState(false)
  return (
    <Modal label="Dodaj dokument" onClose={onClose}>
      <div className="eyebrow">Dokumenty</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Dodaj dokument</h2>
      <div className="stack">
        <Field label="Nazwa" value={title} onChange={setTitle} placeholder="np. Umowa na wykonanie strony" />
        <label className="field">
          <span className="label">Plik (najlepiej PDF)</span>
          <input className="input" type="file" accept="application/pdf,.doc,.docx,image/*" onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''))
          }} />
        </label>
        <Field label="Opis dla klienta (opcjonalnie)" value={note} onChange={setNote} textarea />
        <Toggle checked={requires} onChange={setRequires} label="Wymaga akceptacji klienta" />
        <Toggle checked={visible} onChange={setVisible} label="Od razu widoczny dla klienta (wyłącz, żeby zapisać jako szkic)" />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={async () => {
          if (!title.trim() || !file) return toast('Podaj nazwę i wybierz plik.')
          setBusy(true)
          try {
            await onSave(title.trim(), file, requires, visible, note.trim())
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

function DocReader({ doc, isAdmin, onClose, onSaved, onAccept }: { doc: ClientDocument; isAdmin: boolean; onClose: () => void; onSaved: (c: string) => Promise<void>; onAccept?: () => void }) {
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(doc.content ?? '')
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <strong>{doc.title}</strong>
        <span className="spacer" />
        {isAdmin && (
          <button className="btn btn-sm" onClick={async () => {
            if (edit) await onSaved(text)
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
        <button className="btn btn-sm" onClick={onClose}>
          Zamknij
        </button>
      </div>
      <div className="doc-read">
        {edit ? (
          <textarea className="textarea" style={{ minHeight: '70vh', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13.5 }} value={text} onChange={(e) => setText(e.target.value)} />
        ) : (
          <article className="md card" style={{ padding: '32px 40px' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
        )}
      </div>
    </div>
  )
}
