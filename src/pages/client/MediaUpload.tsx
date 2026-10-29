import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CONTACT, Icon, Loading, fmtDate } from '../../components/ui'
import { MEDIA_CATEGORIES, fmtSize, type ClientFile } from '../../lib/workspace'
import { Empty } from '../../workspace/bits'
import { Notice } from './BriefForm'

// Strona dla firmy zewnętrznej z linkiem: wgrywa pliki do bazy mediów klienta i widzi tylko to, co sama wgrała.

type LinkFile = ClientFile & { preview: string | null }
interface Info {
  client: string
  label: string
  expires_at: string | null
  files: LinkFile[]
}

const MAX = 5 * 1024 * 1024 * 1024
const isImage = (f: ClientFile) => !!f.mime?.startsWith('image/')
const isVideo = (f: ClientFile) => !!f.mime?.startsWith('video/')

async function call<T>(token: string, action: string, data: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/.netlify/functions/media-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action, ...data }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(out.error || 'Coś poszło nie tak. Spróbuj ponownie.'), { status: res.status })
  return out as T
}

/** Wgranie jednego pliku pod jednorazowy adres z postępem (fetch nie podaje postępu wysyłania) */
function put(url: string, file: File, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('x-upsert', 'false')
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (key) xhr.setRequestHeader('apikey', key)
    xhr.upload.onprogress = (e) => onProgress(e.loaded)
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Nie udało się wgrać „${file.name}” (${xhr.status}).`)))
    xhr.onerror = () => reject(new Error(`Przerwane połączenie przy „${file.name}”. Spróbuj jeszcze raz.`))
    const body = new FormData()
    body.append('cacheControl', '3600')
    body.append('', file)
    xhr.send(body)
  })
}

export default function MediaUpload() {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [fail, setFail] = useState<string | null>(null)
  const [category, setCategory] = useState(MEDIA_CATEGORIES[0])
  const [filter, setFilter] = useState('Wszystkie')
  const [progress, setProgress] = useState<{ name: string; index: number; total: number; loaded: number; size: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setInfo(await call<Info>(token, 'info'))
    } catch (e) {
      setFail((e as Error).message)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  // nie zamykaj karty w trakcie wgrywania
  useEffect(() => {
    if (!progress) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [progress])

  const upload = async (list: FileList | File[]) => {
    const arr = Array.from(list)
    if (!arr.length || progress) return
    const errs: string[] = []
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]
      if (file.size > MAX) {
        errs.push(`„${file.name}” ma ponad 5 GB. Wyślij go linkiem, np. WeTransfer, i daj nam znać.`)
        continue
      }
      setProgress({ name: file.name, index: i + 1, total: arr.length, loaded: 0, size: file.size })
      try {
        const { path, url } = await call<{ path: string; url: string }>(token, 'sign', { name: file.name })
        await put(url, file, (loaded) => setProgress((p) => (p ? { ...p, loaded } : p)))
        await call(token, 'add', { path, name: file.name, category })
      } catch (e) {
        errs.push((e as Error).message)
      }
    }
    setProgress(null)
    setErrors(errs)
    await load()
  }

  if (fail) return <Notice title="Link nie działa" text={fail} />
  if (!info) return <Loading />

  const files = info.files
  const cats = ['Wszystkie', ...MEDIA_CATEGORIES.filter((c) => files.some((f) => f.category === c))]
  const shown = filter === 'Wszystkie' ? files : files.filter((f) => f.category === filter)
  const pct = progress && progress.size ? Math.round((progress.loaded / progress.size) * 100) : 0

  return (
    <>
      <header className="brand-band cz-head">
        <div className="wrap">
          <img src="/brand/logo-outline.webp" alt="NAFU design" className="logo" />
          <div className="eyebrow" style={{ color: 'var(--teal)', marginTop: 18 }}>
            Baza mediów
          </div>
          <h1>{info.client}</h1>
          <p style={{ color: 'rgba(255,255,255,.8)', margin: '-8px 0 22px', maxWidth: 680 }}>
            Dostęp dla: <strong>{info.label}</strong>. Wgraj tutaj zdjęcia, grafiki i filmy. Trafią prosto do bazy mediów klienta.
            Widzisz tylko pliki wgrane tym linkiem.
            {info.expires_at && ` Link działa do ${fmtDate(info.expires_at).split(',')[0]}.`}
          </p>
        </div>
      </header>

      <main className="wrap cz-main">
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
              <strong>Przeciągnij tutaj zdjęcia, grafiki i filmy</strong>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                albo wybierz je z komputera. Możesz zaznaczyć wiele plików naraz. Jeden plik może mieć do 5 GB. Nie zamykaj karty, dopóki
                wgrywanie się nie skończy.
              </p>
            </div>
            <div className="drop-actions">
              <label className="field" style={{ minWidth: 220 }}>
                <span className="label">Kategoria wgrywanych plików</span>
                <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!!progress}>
                  {MEDIA_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={!!progress}>
                {progress ? `Wgrywam ${progress.index}/${progress.total}…` : 'Wybierz pliki'}
              </button>
            </div>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              accept="image/*,video/*,application/pdf,.zip,.ai,.eps,.svg,.psd,.indd,.tif,.tiff,.heic,.raw,.cr2,.nef,.mov,.mp4"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {progress && (
            <div className="card" style={{ padding: 16, display: 'grid', gap: 8 }} aria-live="polite">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {progress.index}/{progress.total}: {progress.name}
                </strong>
                <span className="muted">
                  {fmtSize(progress.loaded)} z {fmtSize(progress.size)} · {pct}%
                </span>
              </div>
              <div className="progress">
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="card" role="alert" style={{ padding: 16, color: 'var(--danger)' }}>
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}

          {files.length === 0 ? (
            <Empty title="Nic jeszcze nie wgrano" text="Pliki wgrane tym linkiem pojawią się tutaj. Możesz potem zmienić im kategorię albo je usunąć." />
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
                    <a className="media-thumb" href={f.preview ?? undefined} target="_blank" rel="noopener" title="Otwórz">
                      {isImage(f) && f.preview ? (
                        <img src={f.preview} alt={f.name} loading="lazy" />
                      ) : isVideo(f) && f.preview ? (
                        <video src={f.preview} muted preload="metadata" />
                      ) : (
                        <span className="media-ext">{(f.name.split('.').pop() ?? 'PLIK').toUpperCase().slice(0, 5)}</span>
                      )}
                    </a>
                    <div className="media-info">
                      <div className="media-name" title={f.name}>
                        {f.name}
                      </div>
                      <div className="media-meta">
                        {fmtSize(f.size)} · {fmtDate(f.created_at).split(',')[0]}
                      </div>
                      <select
                        className="select media-cat"
                        value={f.category ?? ''}
                        onChange={async (e) => {
                          const category = e.target.value || null
                          await call(token, 'update', { id: f.id, category })
                          setInfo({ ...info, files: files.map((x) => (x.id === f.id ? { ...x, category } : x)) })
                        }}
                      >
                        <option value="">Bez kategorii</option>
                        {MEDIA_CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon media-del"
                      aria-label={`Usuń ${f.name}`}
                      onClick={async () => {
                        if (!confirm(`Usunąć „${f.name}”?`)) return
                        await call(token, 'delete', { id: f.id })
                        setInfo({ ...info, files: files.filter((x) => x.id !== f.id) })
                      }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <footer className="wrap page-foot">
        <span>
          © {new Date().getFullYear()} NAFU Design · {CONTACT.names} · {CONTACT.city}
        </span>
        <span className="row">
          <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </span>
      </footer>
    </>
  )
}
