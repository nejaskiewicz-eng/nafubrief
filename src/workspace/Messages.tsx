import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, Spinner, fmtDate, useToast } from '../components/ui'
import { listMessages, markRead, sendMessage, signedUrls, type Message } from '../lib/workspace'

export default function Messages({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const toast = useToast()
  const [list, setList] = useState<Message[] | null>(null)
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setList(await listMessages(clientId))
    markRead(clientId, isAdmin).catch(() => {})
  }, [clientId, isAdmin])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
    const t = window.setInterval(() => load().catch(() => {}), 20000)
    return () => clearInterval(t)
  }, [load, toast])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [list?.length])

  const send = async () => {
    if (!body.trim() && !file) return
    setBusy(true)
    try {
      await sendMessage(clientId, body.trim() || (file ? `Plik: ${file.name}` : ''), isAdmin, file ?? undefined)
      setBody('')
      setFile(null)
      await load()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const openFile = async (path: string | null, url: string | null) => {
    if (url) return window.open(url, '_blank', 'noopener')
    if (!path) return
    const u = (await signedUrls([path]))[path]
    if (u) window.open(u, '_blank', 'noopener')
  }

  if (!list) return <Spinner />

  return (
    <div className="ws">
      <div className="card chat">
        <div className="chat-list">
          {list.length === 0 && (
            <p className="muted" style={{ textAlign: 'center', padding: 24 }}>
              {isAdmin ? 'Brak wiadomości. Napisz do klienta, np. z prośbą o materiały.' : 'Masz pytanie albo chcesz coś przekazać? Napisz tutaj, odpowiem najszybciej, jak to możliwe.'}
            </p>
          )}
          {list.map((m) => {
            const mine = m.from_admin === isAdmin
            return (
              <div key={m.id} className={`msg${mine ? ' mine' : ''}`}>
                <div className="msg-bubble">
                  <div className="msg-body">{m.body}</div>
                  {m.file && (
                    <button className="msg-file" onClick={() => openFile(m.file!.path, m.file!.url)}>
                      <Icon name="doc" size={15} /> {m.file.name}
                    </button>
                  )}
                </div>
                <div className="msg-meta">
                  {m.from_admin ? 'Natalia, NAFU Design' : 'Klient'} · {fmtDate(m.created_at)}
                  {mine && m.read_at && ' · przeczytane'}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>
        <div className="chat-input">
          <textarea
            className="textarea"
            placeholder="Napisz wiadomość…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
            }}
          />
          <div className="row">
            <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
              <Icon name="plus" size={15} /> {file ? file.name : 'Załącz plik'}
            </button>
            {file && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>
                Usuń załącznik
              </button>
            )}
            <span className="spacer" />
            <button className="btn btn-primary" onClick={send} disabled={busy || (!body.trim() && !file)}>
              {busy ? 'Wysyłam…' : 'Wyślij'}
            </button>
          </div>
          <input ref={fileInput} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
    </div>
  )
}
