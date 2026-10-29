import type { ReactNode } from 'react'
import { Icon } from '../components/ui'

export function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  full,
  type = 'text',
}: {
  label: string
  value?: string | null
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
  full?: boolean
  type?: string
}) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span className="label">{label}</span>
      {textarea ? (
        <textarea className="textarea" style={{ minHeight: 84 }} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

export function SaveBar({ dirty, saving, onSave, hint }: { dirty: boolean; saving: boolean; onSave: () => void; hint?: ReactNode }) {
  return (
    <div className="ws-savebar">
      <span className="muted" style={{ fontSize: 14 }}>
        {dirty ? <strong style={{ color: 'var(--warn)' }}>Masz niezapisane zmiany</strong> : hint}
      </span>
      <button className="btn btn-primary btn-sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? 'Zapisuję…' : 'Zapisz'}
      </button>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={`tgl${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="tgl-track" aria-hidden>
        <span className="tgl-dot" />
      </span>
      <span>{label}</span>
    </label>
  )
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <img src="/brand/badge-arc.webp" alt="" />
      <h3>{title}</h3>
      <p className="muted" style={{ margin: 0, maxWidth: 460 }}>
        {text}
      </p>
      {children}
    </div>
  )
}

/** Foldery bazy mediów (np. salony): wybór folderu do przeglądania; '' = wszystkie, NO_FOLDER = pliki bez folderu */
export const NO_FOLDER = '\u0000'
export function FolderBar({
  folders, files, value, onChange,
}: {
  folders: string[]
  files: { folder?: string | null }[]
  value: string
  onChange: (v: string) => void
}) {
  if (!folders.length) return null
  const count = (f: string) => files.filter((x) => (f === NO_FOLDER ? !x.folder || !folders.includes(x.folder) : x.folder === f)).length
  const loose = count(NO_FOLDER)
  const items: Array<[string, string, number]> = [
    ['', 'Wszystkie', files.length],
    ...folders.map((f): [string, string, number] => [f, f, count(f)]),
    ...(loose ? [[NO_FOLDER, 'Bez folderu', loose] as [string, string, number]] : []),
  ]
  return (
    <div className="folder-bar" role="tablist" aria-label="Foldery">
      {items.map(([key, label, n]) => (
        <button key={label} role="tab" aria-selected={value === key} className={`folder-btn${value === key ? ' on' : ''}`} onClick={() => onChange(key)}>
          <Icon name="folder" size={20} />
          {label}
          <small>{n}</small>
        </button>
      ))}
    </div>
  )
}
