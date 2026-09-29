import type { ReactNode } from 'react'

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
