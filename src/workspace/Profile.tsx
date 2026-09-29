import { useEffect, useState } from 'react'
import { Icon, Spinner, useToast } from '../components/ui'
import { getProfile, newId, saveProfile, type Company, type Location, type ProfileData } from '../lib/workspace'
import { Field, SaveBar } from './bits'

const emptyCompany = (): Company => ({
  id: newId(), name: '', industry: '', nip: '', regon: '', address: '', invoice_name: '', invoice_address: '', invoice_email: '', notes: '',
})
const emptyLocation = (): Location => ({ id: newId(), name: '', address: '', phone: '', email: '', hours: '', accessibility: '' })

const SOCIAL: Array<[keyof ProfileData, string, string]> = [
  ['website', 'Strona internetowa', 'https://'],
  ['facebook', 'Facebook', 'https://facebook.com/…'],
  ['instagram', 'Instagram', 'https://instagram.com/…'],
  ['tiktok', 'TikTok', 'https://tiktok.com/@…'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/…'],
  ['youtube', 'YouTube', 'https://youtube.com/…'],
  ['google_business', 'Wizytówka Google (Mapy)', 'https://maps.google.com/…'],
  ['booking', 'System rezerwacji (np. Booksy)', 'https://…'],
]

export default function Profile({ clientId }: { clientId: string }) {
  const toast = useToast()
  const [data, setData] = useState<ProfileData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProfile(clientId).then((p) =>
      setData({ ...p, companies: p.companies?.length ? p.companies : [emptyCompany()], locations: p.locations?.length ? p.locations : [emptyLocation()] }),
    )
  }, [clientId])

  if (!data) return <Spinner />

  const set = (patch: Partial<ProfileData>) => {
    setData({ ...data, ...patch })
    setDirty(true)
  }
  const setCompany = (i: number, patch: Partial<Company>) => set({ companies: data.companies!.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const setLocation = (i: number, patch: Partial<Location>) => set({ locations: data.locations!.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  const save = async () => {
    setSaving(true)
    try {
      await saveProfile(clientId, data)
      setDirty(false)
      toast('Zapisano profil')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ws">
      <SaveBar dirty={dirty} saving={saving} onSave={save} hint="Dane z profilu wykorzystam na stronie, w dokumentach i w wizytówkach." />

      <section className="card ws-card">
        <h2>Osoba do kontaktu</h2>
        <p className="muted ws-lead">Z kim mam się kontaktować w sprawie projektu?</p>
        <div className="form-grid">
          <Field label="Imię i nazwisko" value={data.contact_person} onChange={(v) => set({ contact_person: v })} />
          <Field label="Stanowisko lub funkcja" value={data.contact_role} onChange={(v) => set({ contact_role: v })} placeholder="np. właścicielka" />
          <Field label="Telefon" value={data.contact_phone} onChange={(v) => set({ contact_phone: v })} />
          <Field label="E-mail" value={data.contact_email} onChange={(v) => set({ contact_email: v })} />
        </div>
      </section>

      <section className="card ws-card">
        <h2>Firmy</h2>
        <p className="muted ws-lead">Jeśli prowadzisz kilka firm (np. każdy salon jest osobną firmą), dodaj każdą osobno.</p>
        {data.companies!.map((c, i) => (
          <div className="ws-item" key={c.id}>
            <div className="ws-item-head">
              <strong>{c.name || `Firma ${i + 1}`}</strong>
              {data.companies!.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => confirm('Usunąć tę firmę z profilu?') && set({ companies: data.companies!.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={15} /> Usuń
                </button>
              )}
            </div>
            <div className="form-grid">
              <Field label="Pełna nazwa firmy" value={c.name} onChange={(v) => setCompany(i, { name: v })} full />
              <Field label="Branża" value={c.industry} onChange={(v) => setCompany(i, { industry: v })} placeholder="np. salon optyczny, gabinet kosmetyczny" />
              <Field label="NIP" value={c.nip} onChange={(v) => setCompany(i, { nip: v })} />
              <Field label="REGON" value={c.regon} onChange={(v) => setCompany(i, { regon: v })} />
              <Field label="Adres siedziby" value={c.address} onChange={(v) => setCompany(i, { address: v })} />
            </div>
            <h3 className="ws-sub">Dane do faktury</h3>
            <div className="form-grid">
              <Field label="Nazwa na fakturze" value={c.invoice_name} onChange={(v) => setCompany(i, { invoice_name: v })} placeholder="jeśli inna niż nazwa firmy" />
              <Field label="E-mail do wysyłki faktur" value={c.invoice_email} onChange={(v) => setCompany(i, { invoice_email: v })} />
              <Field label="Adres na fakturze" value={c.invoice_address} onChange={(v) => setCompany(i, { invoice_address: v })} placeholder="jeśli inny niż adres siedziby" full />
              <Field label="Uwagi" value={c.notes} onChange={(v) => setCompany(i, { notes: v })} textarea full />
            </div>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => set({ companies: [...data.companies!, emptyCompany()] })}>
          <Icon name="plus" size={15} /> Dodaj firmę
        </button>
      </section>

      <section className="card ws-card">
        <h2>Salony i lokalizacje</h2>
        <p className="muted ws-lead">Każde miejsce, w którym obsługujesz klientów. Salony wybierzesz potem przy usługach i godzinach pracy zespołu.</p>
        {data.locations!.map((l, i) => (
          <div className="ws-item" key={l.id}>
            <div className="ws-item-head">
              <strong>{l.name || `Salon ${i + 1}`}</strong>
              {data.locations!.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => confirm('Usunąć ten salon z profilu?') && set({ locations: data.locations!.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={15} /> Usuń
                </button>
              )}
            </div>
            <div className="form-grid">
              <Field label="Nazwa salonu" value={l.name} onChange={(v) => setLocation(i, { name: v })} placeholder="np. Salon Centrum" />
              <Field label="Adres" value={l.address} onChange={(v) => setLocation(i, { address: v })} />
              <Field label="Telefon" value={l.phone} onChange={(v) => setLocation(i, { phone: v })} />
              <Field label="E-mail" value={l.email} onChange={(v) => setLocation(i, { email: v })} />
              <Field label="Godziny otwarcia" value={l.hours} onChange={(v) => setLocation(i, { hours: v })} textarea placeholder={'Pn-Pt 9:00-18:00\nSb 9:00-14:00'} />
              <Field label="Dostępność dla osób z niepełnosprawnościami" value={l.accessibility} onChange={(v) => setLocation(i, { accessibility: v })} textarea placeholder="np. wejście bez schodów, parking dla osób z niepełnosprawnościami" />
            </div>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => set({ locations: [...data.locations!, emptyLocation()] })}>
          <Icon name="plus" size={15} /> Dodaj salon
        </button>
      </section>

      <section className="card ws-card">
        <h2>Strona, social media i linki</h2>
        <p className="muted ws-lead">Wklej pełne adresy profili. Zostaw puste te, których nie masz.</p>
        <div className="form-grid">
          {SOCIAL.map(([k, label, ph]) => (
            <Field key={k} label={label} value={data[k] as string | undefined} onChange={(v) => set({ [k]: v } as Partial<ProfileData>)} placeholder={ph} />
          ))}
        </div>
        <h3 className="ws-sub">Inne linki</h3>
        {(data.other_links ?? []).map((l, i) => (
          <div className="ws-row" key={i}>
            <input className="input" placeholder="Opis, np. katalog oprawek" value={l.label} onChange={(e) => set({ other_links: data.other_links!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <input className="input" placeholder="https://" value={l.url} onChange={(e) => set({ other_links: data.other_links!.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            <button className="btn btn-ghost btn-icon" aria-label="Usuń link" onClick={() => set({ other_links: data.other_links!.filter((_, j) => j !== i) })}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => set({ other_links: [...(data.other_links ?? []), { label: '', url: '' }] })}>
          <Icon name="plus" size={15} /> Dodaj link
        </button>
      </section>
    </div>
  )
}
