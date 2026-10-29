import { useCallback, useEffect, useState } from 'react'
import { Icon, Modal, copyText, fmtDate, useToast } from '../components/ui'
import {
  createMediaLink, listMediaLinks, mediaLinkCounts, mediaLinkUrl, setMediaLinkRevoked, type MediaLink,
} from '../lib/workspace'
import { Field } from './bits'

/** Linki do wgrywania mediów dla firm zewnętrznych (widzi tylko administratorka) */
export default function MediaLinks({ clientId, onChanged }: { clientId: string; onChanged?: () => void }) {
  const toast = useToast()
  const [links, setLinks] = useState<MediaLink[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([listMediaLinks(clientId), mediaLinkCounts(clientId)])
    setLinks(l)
    setCounts(c)
  }, [clientId])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  const copy = async (l: MediaLink) => {
    await copyText(mediaLinkUrl(l))
    toast('Skopiowano link')
  }

  const state = (l: MediaLink) =>
    l.revoked_at ? 'wyłączony' : l.expires_at && new Date(l.expires_at) < new Date() ? 'wygasł' : 'aktywny'

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18, display: 'grid', gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>Linki do wgrywania dla firm zewnętrznych</strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            Osoba z linkiem wgrywa pliki prosto do tej bazy mediów, bez konta. Widzi tylko pliki wgrane swoim linkiem, nic więcej z panelu.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Nowy link
        </button>
      </div>

      {links.map((l) => {
        const s = state(l)
        return (
          <div key={l.id} className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <strong>{l.label}</strong>{' '}
              <span className={`badge ${s === 'aktywny' ? 'submitted' : 'draft'}`}>{s}</span>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                {counts[l.id] ?? 0} plików · utworzony {fmtDate(l.created_at).split(',')[0]}
                {l.expires_at && ` · ważny do ${fmtDate(l.expires_at).split(',')[0]}`}
                {l.used_at && ` · ostatnio otwarty ${fmtDate(l.used_at)}`}
              </div>
            </div>
            <div className="row">
              {s === 'aktywny' && (
                <button className="btn btn-sm" onClick={() => copy(l)}>
                  <Icon name="copy" size={15} /> Kopiuj link
                </button>
              )}
              <button
                className="btn btn-sm btn-ghost"
                onClick={async () => {
                  if (!l.revoked_at && !confirm(`Wyłączyć link dla „${l.label}”? Wgrane pliki zostaną w bazie mediów.`)) return
                  await setMediaLinkRevoked(l.id, !l.revoked_at)
                  await load()
                }}
              >
                {l.revoked_at ? 'Włącz ponownie' : 'Wyłącz'}
              </button>
            </div>
          </div>
        )
      })}

      {adding && (
        <AddLink
          onClose={() => setAdding(false)}
          onSave={async (label, expires) => {
            const l = await createMediaLink(clientId, label, expires)
            setAdding(false)
            await load()
            onChanged?.()
            await copyText(mediaLinkUrl(l))
            toast('Link gotowy i skopiowany')
          }}
        />
      )}
    </div>
  )
}

function AddLink({ onClose, onSave }: { onClose: () => void; onSave: (label: string, expires: string | null) => Promise<void> }) {
  const inDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)
  const [label, setLabel] = useState('')
  const [until, setUntil] = useState(inDays(30))
  const [err, setErr] = useState('')
  return (
    <Modal label="Nowy link do wgrywania" onClose={onClose}>
      <div className="eyebrow">Baza mediów</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Nowy link do wgrywania</h2>
      <div className="stack">
        <Field label="Dla kogo" value={label} onChange={setLabel} placeholder="np. nazwa firmy" />
        <label className="field">
          <span className="label">Ważny do (puste = bez terminu)</span>
          <input className="input" type="date" value={until} min={inDays(1)} onChange={(e) => setUntil(e.target.value)} />
        </label>
        {err && <p style={{ color: 'var(--danger)', margin: 0 }}>{err}</p>}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!label.trim()) return setErr('Wpisz, dla kogo jest link.')
            onSave(label.trim(), until ? new Date(`${until}T23:59:59`).toISOString() : null).catch((e) => setErr((e as Error).message))
          }}
        >
          Utwórz i skopiuj
        </button>
      </div>
    </Modal>
  )
}
