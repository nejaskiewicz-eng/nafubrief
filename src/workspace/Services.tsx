import { useCallback, useEffect, useState } from 'react'
import { Icon, Modal, Spinner, useToast } from '../components/ui'
import { deleteService, getProfile, listServices, saveService, type Location, type Service } from '../lib/workspace'
import { Empty, Field, Toggle } from './bits'

export default function Services({ clientId }: { clientId: string }) {
  const toast = useToast()
  const [list, setList] = useState<Service[] | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [editing, setEditing] = useState<Partial<Service> | null>(null)

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([listServices(clientId), getProfile(clientId)])
    setList(s)
    setLocations((p.locations ?? []).filter((l) => l.name))
  }, [clientId])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  if (!list) return <Spinner />

  const quick = async (s: Service, patch: Partial<Service>) => {
    setList(list.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))
    await saveService({ ...s, ...patch }).catch((e) => toast((e as Error).message))
  }
  const groups = [...new Set(list.map((s) => s.category || 'Bez kategorii'))]

  return (
    <div className="ws">
      <div className="ws-savebar">
        <span className="muted" style={{ fontSize: 14 }}>
          Usługi, ceny i miejsca. Osobno decydujesz, co widać na stronie, a co w kalendarzu rezerwacji online.
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ show_on_site: true, show_in_calendar: false, locations: locations.map((l) => l.id) })}>
          <Icon name="plus" size={15} /> Dodaj usługę
        </button>
      </div>

      {list.length === 0 ? (
        <Empty title="Dodaj pierwszą usługę" text="Nazwa, cena, czas trwania i salony, w których jest dostępna. Na tej podstawie przygotuję cennik i kalendarz rezerwacji.">
          <button className="btn btn-primary" onClick={() => setEditing({ show_on_site: true, show_in_calendar: false, locations: locations.map((l) => l.id) })}>
            <Icon name="plus" size={16} /> Dodaj usługę
          </button>
        </Empty>
      ) : (
        groups.map((g) => (
          <section className="card ws-card" key={g}>
            <h2>{g}</h2>
            <div className="svc-list">
              {list
                .filter((s) => (s.category || 'Bez kategorii') === g)
                .map((s) => (
                  <div className="svc-row" key={s.id}>
                    <button className="svc-main" onClick={() => setEditing(s)}>
                      <strong>{s.name}</strong>
                      <span className="muted">
                        {[s.price, s.duration_min ? `${s.duration_min} min` : null, s.locations.map((id) => locations.find((l) => l.id === id)?.name).filter(Boolean).join(', ')]
                          .filter(Boolean)
                          .join(' · ') || 'Uzupełnij szczegóły'}
                      </span>
                    </button>
                    <div className="svc-toggles">
                      <Toggle checked={s.show_on_site} onChange={(v) => quick(s, { show_on_site: v })} label="Na stronie" />
                      <Toggle checked={s.show_in_calendar} onChange={(v) => quick(s, { show_in_calendar: v })} label="W kalendarzu" />
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))
      )}

      {editing && (
        <ServiceEditor
          clientId={clientId}
          service={editing}
          locations={locations}
          categories={[...new Set(list.map((s) => s.category).filter(Boolean) as string[])]}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function ServiceEditor({
  clientId, service, locations, categories, onClose, onSaved,
}: {
  clientId: string
  service: Partial<Service>
  locations: Location[]
  categories: string[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [s, setS] = useState<Partial<Service>>(service)
  const set = (p: Partial<Service>) => setS({ ...s, ...p })
  const locs = s.locations ?? []

  return (
    <Modal label="Usługa" onClose={onClose}>
      <div className="eyebrow">Usługi</div>
      <h2 style={{ marginTop: 8, marginBottom: 16 }}>{service.id ? s.name : 'Nowa usługa'}</h2>
      <div className="form-grid">
        <Field label="Nazwa usługi" value={s.name} onChange={(v) => set({ name: v })} full placeholder="np. Badanie wzroku z doborem okularów" />
        <label className="field">
          <span className="label">Kategoria</span>
          <input className="input" list="svc-cats" value={s.category ?? ''} onChange={(e) => set({ category: e.target.value })} placeholder="np. Badania" />
          <datalist id="svc-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <Field label="Cena" value={s.price} onChange={(v) => set({ price: v })} placeholder="np. 150 zł, od 200 zł, bezpłatnie" />
        <Field label="Czas trwania (minuty)" type="number" value={s.duration_min?.toString() ?? ''} onChange={(v) => set({ duration_min: v ? Number(v) : null })} />
        <Field label="Opis dla klientów" value={s.description} onChange={(v) => set({ description: v })} textarea full placeholder="Na czym polega, dla kogo, co zawiera" />
      </div>

      <h3 className="ws-sub">Gdzie jest dostępna</h3>
      {locations.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>Dodaj salony w zakładce „Profil firmy”, żeby przypisać do nich usługi.</p>
      ) : (
        <div className="chips-filter">
          {locations.map((l) => (
            <button key={l.id} className={`chip${locs.includes(l.id) ? ' on' : ''}`} onClick={() => set({ locations: locs.includes(l.id) ? locs.filter((x) => x !== l.id) : [...locs, l.id] })}>
              {l.name}
            </button>
          ))}
        </div>
      )}

      <h3 className="ws-sub">Widoczność</h3>
      <div className="stack" style={{ gap: 10 }}>
        <Toggle checked={!!s.show_on_site} onChange={(v) => set({ show_on_site: v })} label="Pokaż na stronie (w ofercie i cenniku)" />
        <Toggle checked={!!s.show_in_calendar} onChange={(v) => set({ show_in_calendar: v })} label="Pokaż w kalendarzu rezerwacji online" />
      </div>

      <div className="modal-actions">
        {service.id && (
          <button
            className="btn btn-danger"
            style={{ marginRight: 'auto' }}
            onClick={async () => {
              if (!confirm(`Usunąć usługę „${service.name}”?`)) return
              await deleteService(service.id!)
              await onSaved()
              onClose()
            }}
          >
            <Icon name="trash" size={15} /> Usuń
          </button>
        )}
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (!s.name?.trim()) return toast('Wpisz nazwę usługi.')
            try {
              await saveService({ ...s, client_id: clientId, name: s.name.trim(), locations: locs })
              await onSaved()
              onClose()
            } catch (e) {
              toast((e as Error).message)
            }
          }}
        >
          Zapisz
        </button>
      </div>
    </Modal>
  )
}
