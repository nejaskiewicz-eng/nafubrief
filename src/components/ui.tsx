import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BriefStatus } from '../lib/types'

export const CONTACT = {
  email: 'n.e.jaskiewicz@gmail.com',
  phone: '+48 571 786 388',
  phoneHref: 'tel:+48571786388',
  names: 'Natalia i Hubert Jaśkiewicz',
  city: 'Bolesławiec',
}

export const STATUS_LABEL: Record<BriefStatus, string> = {
  draft: 'Szkic',
  sent: 'Gotowa do wypełnienia',
  in_progress: 'W trakcie',
  submitted: 'Wysłana',
}

export function StatusBadge({ status }: { status: BriefStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Ładowanie" />
}

export function Loading() {
  return (
    <div className="center-screen">
      <Spinner />
    </div>
  )
}

export const Check = () => (
  <svg viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2.5 6.2 5 8.6l4.5-5.2" stroke="#042028" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

type IconName = 'users' | 'plus' | 'copy' | 'link' | 'edit' | 'trash' | 'eye' | 'sparkle' | 'up' | 'down' | 'mail' | 'phone' | 'logout' | 'back' | 'print' | 'download' | 'unlock' | 'doc'

const PATHS: Record<IconName, string> = {
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 9v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  logout: 'M15 17l5-5-5-5M20 12H9M12 20H5V4h7',
  back: 'M15 18l-6-6 6-6',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  unlock: 'M7 11V7a5 5 0 0 1 9.6-2M5 11h14v10H5z',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

/* ---------- toast ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

/* ---------- modal ---------- */

export function Modal({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  )
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

export function downloadFile(name: string, content: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

export const TEMPLATE_COLORS: Record<string, string> = {
  strategy: 'linear-gradient(135deg,#0a7189,#02afca)',
  legal: 'linear-gradient(135deg,#072129,#12404d)',
  technical: 'linear-gradient(135deg,#0b4d5e,#0896b0)',
  visual: 'linear-gradient(135deg,#02afca,#6fd9ea)',
}
export const TEMPLATE_LETTER: Record<string, string> = { strategy: 'S', legal: '§', technical: 'T', visual: 'W' }
