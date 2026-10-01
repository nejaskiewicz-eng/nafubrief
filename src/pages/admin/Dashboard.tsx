import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Icon, Modal, Spinner, StatusBadge, useToast } from '../../components/ui'
import { api, type ClientInput, type ClientWithBriefs } from '../../lib/api'
import type { TemplateKey } from '../../lib/types'
import { TEMPLATES } from '../../templates'
import { ToneFields } from '../../components/ToneFields'

export default function Dashboard() {
  const [clients, setClients] = useState<ClientWithBriefs[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    api.listClients().then(setClients)
  }, [])

  const all = clients ?? []
  const briefs = all.flatMap((c) => c.briefs)
  const filtered = all.filter((c) => `${c.name} ${c.company ?? ''} ${c.industry ?? ''}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Panel</div>
          <h1>Klienci</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> Nowy klient
        </button>
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="n">{all.length}</div>
          <div className="l">klientów</div>
        </div>
        <div className="card stat">
          <div className="n">{briefs.filter((b) => b.status === 'sent' || b.status === 'in_progress').length}</div>
          <div className="l">ankiet czeka na klienta</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: 'var(--ok)' }}>{briefs.filter((b) => b.status === 'submitted').length}</div>
          <div className="l">wypełnionych ankiet</div>
        </div>
        <div className="card stat">
          <div className="n">{briefs.filter((b) => b.status === 'draft').length}</div>
          <div className="l">szkiców do sprawdzenia</div>
        </div>
      </div>

      {clients === null ? (
        <Spinner />
      ) : all.length === 0 ? (
        <div className="card empty">
          <img src="/brand/badge-arc.webp" alt="" />
          <h3>Zacznij od pierwszego klienta</h3>
          <p className="muted" style={{ margin: 0, maxWidth: 440 }}>
            Załóż konto klienta, wybierz ankiety, sprawdź pytania i wyślij linki.
          </p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Nowy klient
          </button>
        </div>
      ) : (
        <>
          {all.length > 6 && (
            <input className="input" style={{ maxWidth: 360, marginBottom: 16 }} placeholder="Szukaj klienta…" value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          <div className="grid-cards">
            {filtered.map((c) => {
              const sub = c.briefs.filter((b) => b.status === 'submitted').length
              return (
                <Link key={c.id} to={`/panel/klient/${c.id}`} className="card client-card">
                  <div>
                    <h3>{c.company || c.name}</h3>
                    <div className="sub">{[c.company ? c.name : null, c.industry].filter(Boolean).join(' · ') || '-'}</div>
                  </div>
                  <div className="progress" title={`${sub}/${c.briefs.length} wypełnionych`}>
                    <span style={{ width: `${c.briefs.length ? (sub / c.briefs.length) * 100 : 0}%` }} />
                  </div>
                  <div className="chips">
                    {c.briefs.length === 0 && <span className="muted" style={{ fontSize: 14 }}>Brak ankiet</span>}
                    {c.briefs.map((b) => (
                      <span key={b.id} title={b.title}>
                        <StatusBadge status={b.status} />
                      </span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {creating && <NewClientModal onClose={() => setCreating(false)} />}
    </>
  )
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<ClientInput>({ name: '' })
  const [picked, setPicked] = useState<TemplateKey[]>(TEMPLATES.map((t) => t.key))
  const [busy, setBusy] = useState(false)
  const set = (k: keyof ClientInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const c = await api.createClient(form, picked)
      toast('Klient utworzony. Sprawdź pytania w ankietach')
      nav(`/panel/klient/${c.id}`)
    } catch (err) {
      toast((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal label="Nowy klient" onClose={onClose}>
      <form onSubmit={create}>
        <div className="eyebrow">Nowy klient</div>
        <h2 style={{ marginTop: 8 }}>Załóż konto klienta</h2>
        <div className="form-grid" style={{ marginTop: 18 }}>
          <label className="field">
            <span className="label">Imię i nazwisko *</span>
            <input className="input" required autoFocus value={form.name} onChange={set('name')} />
          </label>
          <label className="field">
            <span className="label">Firma</span>
            <input className="input" value={form.company ?? ''} onChange={set('company')} />
          </label>
          <label className="field">
            <span className="label">E-mail</span>
            <input className="input" type="email" value={form.email ?? ''} onChange={set('email')} />
          </label>
          <label className="field">
            <span className="label">Telefon</span>
            <input className="input" value={form.phone ?? ''} onChange={set('phone')} />
          </label>
          <label className="field">
            <span className="label">Branża</span>
            <input className="input" placeholder="np. salon optyczny" value={form.industry ?? ''} onChange={set('industry')} />
          </label>
          <label className="field">
            <span className="label">Obecna strona</span>
            <input className="input" placeholder="adres www" value={form.website ?? ''} onChange={set('website')} />
          </label>
          <ToneFields value={form} onChange={(t) => setForm({ ...form, ...t })} />
        </div>

        <p className="label" style={{ margin: '22px 0 10px' }}>
          Które ankiety ma wypełnić?
        </p>
        <TemplatePicker picked={picked} onChange={setPicked} />

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.address_form}>
            {busy ? 'Tworzę…' : 'Utwórz i sprawdź pytania'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function TemplatePicker({ picked, onChange }: { picked: TemplateKey[]; onChange: (k: TemplateKey[]) => void }) {
  return (
    <div className="tpl-pick">
      {TEMPLATES.map((t) => {
        const on = picked.includes(t.key)
        const qs = t.schema.sections.reduce((n, s) => n + s.questions.length, 0)
        return (
          <label key={t.key} className={`tpl${on ? ' on' : ''}`}>
            <input
              type="checkbox"
              className="sr-only"
              checked={on}
              onChange={() => onChange(on ? picked.filter((k) => k !== t.key) : [...picked, t.key])}
            />
            <span className={`choice${on ? ' checked' : ''}`} style={{ padding: 0, border: 0, background: 'none' }}>
              <span className="mark">
                <Check />
              </span>
            </span>
            <span>
              <h4>{t.title}</h4>
              <p>{t.description}</p>
              <p style={{ fontSize: 12.5, marginTop: 6 }}>
                {t.schema.sections.length} części · {qs} pytań · ok. {t.minutes} min
              </p>
            </span>
          </label>
        )
      })}
    </div>
  )
}
