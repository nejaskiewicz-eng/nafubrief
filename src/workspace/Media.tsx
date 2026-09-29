import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, Modal, Spinner, fmtDate, useToast } from '../components/ui'
import {
  MEDIA_CATEGORIES, addLink, deleteFile, fmtSize, listFiles, signedUrls, updateFile, uploadFile, type ClientFile,
} from '../lib/workspace'
import { Empty, Field } from './bits'

const isImage = (f: ClientFile) => !!f.mime?.startsWith('image/')
const isVideo = (f: ClientFile) => !!f.mime?.startsWith('video/')

export default function Media({ clientId }: { clientId: string }) {
  const toast = useToast()
  const [files, setFiles] = useState<ClientFile[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<string>('Wszystkie')
  const [category, setCategory] = useState(MEDIA_CATEGORIES[0])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [drag, setDrag] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const list = await listFiles(clientId, 'media')
    setFiles(list)
    setUrls(await signedUrls(list.filter((f) => f.path && (isImage(f) || isVideo(f))).map((f) => f.path!)))
  }, [clientId])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  const upload = async (list: FileList | File[]) => {
    const arr = Array.from(list)
    if (!arr.length) return
    setProgress({ done: 0, total: arr.length })
    const errors: string[] = []
    for (let i = 0; i < arr.length; i++) {
      try {
        await uploadFile(clientId, arr[i], { kind: 'media', category })
      } catch (e) {
        errors.push((e as Error).message)
      }
      setProgress({ done: i + 1, total: arr.length })
    }
    setProgress(null)
    await load()
    toast(errors.length ? errors[0] : `Wgrano ${arr.length} ${arr.length === 1 ? 'plik' : 'pliki'}`)
  }

  const open = async (f: ClientFile) => {
    if (f.url) return window.open(f.url, '_blank', 'noopener')
    const u = urls[f.path!] ?? (await signedUrls([f.path!]))[f.path!]
    if (u) window.open(u, '_blank', 'noopener')
  }

  if (!files) return <Spinner />
  const cats = ['Wszystkie', ...MEDIA_CATEGORIES.filter((c) => files.some((f) => f.category === c))]
  const shown = filter === 'Wszystkie' ? files : files.filter((f) => f.category === filter)

  return (
    <div className="ws">
      <div
        className={`drop${drag ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          upload(e.dataTransfer.files)
        }}
      >
        <div className="drop-icon">
          <Icon name="download" size={26} />
        </div>
        <div>
          <strong>Przeciągnij tutaj zdjęcia, filmy i dokumenty</strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            albo wybierz je z komputera lub telefonu. Jeden plik może mieć do 50 MB. Większe filmy dodaj jako link.
          </p>
        </div>
        <div className="drop-actions">
          <label className="field" style={{ minWidth: 220 }}>
            <span className="label">Kategoria wgrywanych plików</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="row">
            <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={!!progress}>
              {progress ? `Wgrywam ${progress.done}/${progress.total}…` : 'Wybierz pliki'}
            </button>
            <button className="btn" onClick={() => setLinkOpen(true)}>
              <Icon name="link" size={16} /> Dodaj link
            </button>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.ai,.eps,.svg,.psd,.txt"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {files.length === 0 ? (
        <Empty title="Baza mediów jest pusta" text="Wgraj logo, zdjęcia salonów i zespołu, filmy, dokumenty. Wszystko w jednym miejscu, gotowe do wykorzystania na stronie." />
      ) : (
        <>
          <div className="chips-filter">
            {cats.map((c) => (
              <button key={c} className={`chip${filter === c ? ' on' : ''}`} onClick={() => setFilter(c)}>
                {c}
                <span>{c === 'Wszystkie' ? files.length : files.filter((f) => f.category === c).length}</span>
              </button>
            ))}
          </div>
          <div className="media-grid">
            {shown.map((f) => (
              <div className="media-tile card" key={f.id}>
                <button className="media-thumb" onClick={() => open(f)} title="Otwórz">
                  {isImage(f) && f.path && urls[f.path] ? (
                    <img src={urls[f.path]} alt={f.name} loading="lazy" />
                  ) : isVideo(f) && f.path && urls[f.path] ? (
                    <video src={urls[f.path]} muted preload="metadata" />
                  ) : (
                    <span className="media-ext">{f.url ? 'LINK' : (f.name.split('.').pop() ?? 'PLIK').toUpperCase().slice(0, 5)}</span>
                  )}
                </button>
                <div className="media-info">
                  <div className="media-name" title={f.name}>
                    {f.name}
                  </div>
                  <div className="media-meta">
                    {f.url ? 'link zewnętrzny' : fmtSize(f.size)} · {fmtDate(f.created_at).split(',')[0]}
                  </div>
                  <select
                    className="select media-cat"
                    value={f.category ?? ''}
                    onChange={async (e) => {
                      await updateFile(f.id, { category: e.target.value || null })
                      setFiles(files.map((x) => (x.id === f.id ? { ...x, category: e.target.value || null } : x)))
                    }}
                  >
                    <option value="">Bez kategorii</option>
                    {MEDIA_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  {f.note && <div className="media-note">{f.note}</div>}
                </div>
                <button
                  className="btn btn-ghost btn-icon media-del"
                  aria-label={`Usuń ${f.name}`}
                  onClick={async () => {
                    if (!confirm(`Usunąć „${f.name}”?`)) return
                    await deleteFile(f)
                    setFiles(files.filter((x) => x.id !== f.id))
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {linkOpen && (
        <LinkModal
          onClose={() => setLinkOpen(false)}
          onSave={async (name, url, note) => {
            await addLink(clientId, name, url, category, note)
            setLinkOpen(false)
            await load()
          }}
        />
      )}
    </div>
  )
}

function LinkModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, url: string, note: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  return (
    <Modal label="Dodaj link" onClose={onClose}>
      <div className="eyebrow">Baza mediów</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Dodaj link do plików</h2>
      <p className="muted" style={{ marginTop: 0 }}>Np. folder na Dysku Google, Dropbox, WeTransfer albo film na YouTube.</p>
      <div className="stack">
        <Field label="Nazwa" value={name} onChange={setName} placeholder="np. Sesja zdjęciowa 2025" />
        <Field label="Link" value={url} onChange={setUrl} placeholder="https://" />
        <Field label="Opis (opcjonalnie)" value={note} onChange={setNote} textarea />
        {err && <p style={{ color: 'var(--danger)', margin: 0 }}>{err}</p>}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!/^https?:\/\//i.test(url.trim())) return setErr('Link musi zaczynać się od https://')
            onSave(name.trim() || url.trim(), url.trim(), note.trim()).catch((e) => setErr((e as Error).message))
          }}
        >
          Dodaj
        </button>
      </div>
    </Modal>
  )
}
