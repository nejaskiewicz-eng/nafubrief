import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, Modal, Spinner, useToast } from '../components/ui'
import {
  DAYS, deleteFile, deleteMember, getProfile, listFiles, listServices, listTeam, saveMember, signedUrls, uploadFile, uploadPhoto,
  type ClientFile, type Location, type ScheduleRow, type TeamMember,
} from '../lib/workspace'
import { Empty, Field } from './bits'

export default function Team({ clientId }: { clientId: string }) {
  const toast = useToast()
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [locations, setLocations] = useState<Location[]>([])
  const [serviceNames, setServiceNames] = useState<string[]>([])
  const [editing, setEditing] = useState<TeamMember | 'new' | null>(null)

  const load = useCallback(async () => {
    const [t, p, s] = await Promise.all([listTeam(clientId), getProfile(clientId), listServices(clientId)])
    setTeam(t)
    setLocations((p.locations ?? []).filter((l) => l.name))
    setServiceNames(s.map((x) => x.name))
    setPhotos(await signedUrls(t.map((m) => m.photo_path!).filter(Boolean)))
  }, [clientId])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  if (!team) return <Spinner />
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? 'salon'

  return (
    <div className="ws">
      <div className="ws-savebar">
        <span className="muted" style={{ fontSize: 14 }}>
          Osoby, które pokażemy na stronie. Godziny pracy przydadzą się też w kalendarzu rezerwacji.
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={15} /> Dodaj osobę
        </button>
      </div>

      {team.length === 0 ? (
        <Empty title="Dodaj pierwszą osobę z zespołu" text="Zdjęcie, stanowisko, kilka słów o sobie, kwalifikacje i godziny pracy. Klienci lubią wiedzieć, kto ich przyjmie.">
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> Dodaj osobę
          </button>
        </Empty>
      ) : (
        <div className="team-grid">
          {team.map((m) => (
            <button className="card team-card" key={m.id} onClick={() => setEditing(m)}>
              <div className="team-photo">{m.photo_path && photos[m.photo_path] ? <img src={photos[m.photo_path]} alt="" /> : <span>{m.name.slice(0, 1)}</span>}</div>
              <div className="team-body">
                <strong>{m.name}</strong>
                {m.role && <span className="muted">{m.role}</span>}
                {m.schedule.length > 0 && (
                  <span className="team-sched">
                    {m.schedule.map((r, i) => (
                      <span key={i}>
                        {locName(r.location)}: {r.days.join(', ')} {r.from && r.to ? `${r.from}-${r.to}` : ''}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <Icon name="edit" size={16} />
            </button>
          ))}
        </div>
      )}

      {editing && (
        <MemberEditor
          clientId={clientId}
          member={editing === 'new' ? null : editing}
          photoUrl={editing !== 'new' && editing.photo_path ? photos[editing.photo_path] : undefined}
          locations={locations}
          serviceNames={serviceNames}
          position={team.length}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await load()
          }}
        />
      )}
    </div>
  )
}

function MemberEditor({
  clientId, member, photoUrl, locations, serviceNames, position, onClose, onSaved,
}: {
  clientId: string
  member: TeamMember | null
  photoUrl?: string
  locations: Location[]
  serviceNames: string[]
  position: number
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [m, setM] = useState<Partial<TeamMember>>(member ?? { name: '', schedule: [], position })
  const [photo, setPhoto] = useState<string | undefined>(photoUrl)
  const [certs, setCerts] = useState<ClientFile[]>([])
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const certInput = useRef<HTMLInputElement>(null)
  const set = (p: Partial<TeamMember>) => setM({ ...m, ...p })
  const schedule = (m.schedule ?? []) as ScheduleRow[]
  const setRow = (i: number, p: Partial<ScheduleRow>) => set({ schedule: schedule.map((r, j) => (j === i ? { ...r, ...p } : r)) })

  useEffect(() => {
    if (m.id) listFiles(clientId, 'certificate', m.id).then(setCerts)
  }, [clientId, m.id])

  const persist = async (patch: Partial<TeamMember> = {}) => {
    const saved = await saveMember({ ...m, ...patch, client_id: clientId, name: (m.name ?? '').trim() || 'Nowa osoba' })
    setM(saved)
    return saved
  }

  const save = async () => {
    if (!m.name?.trim()) return toast('Wpisz imię i nazwisko.')
    setBusy(true)
    try {
      await persist()
      await onSaved()
      onClose()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const addService = (name: string) => {
    const list = (m.services ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!list.includes(name)) set({ services: [...list, name].join(', ') })
  }

  return (
    <Modal label="Osoba z zespołu" onClose={onClose}>
      <div className="eyebrow">Zespół</div>
      <h2 style={{ marginTop: 8, marginBottom: 16 }}>{member ? m.name : 'Nowa osoba'}</h2>

      <div className="member-photo-row">
        <div className="team-photo big">{photo ? <img src={photo} alt="" /> : <span>{(m.name || '?').slice(0, 1)}</span>}</div>
        <div>
          <button className="btn btn-sm" onClick={() => photoInput.current?.click()} disabled={busy}>
            {photo ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
          </button>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>Najlepiej portret na jasnym tle, dobrej jakości.</p>
        </div>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setBusy(true)
            try {
              const path = await uploadPhoto(clientId, f)
              set({ photo_path: path })
              setPhoto(URL.createObjectURL(f))
            } catch (err) {
              toast((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        />
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <Field label="Imię i nazwisko" value={m.name} onChange={(v) => set({ name: v })} />
        <Field label="Stanowisko" value={m.role} onChange={(v) => set({ role: v })} placeholder="np. optometrystka" />
        <Field label="Kilka słów o sobie (bio)" value={m.bio} onChange={(v) => set({ bio: v })} textarea full placeholder="Kim jest, od kiedy pracuje, co lubi w swojej pracy" />
        <Field label="Kwalifikacje i wykształcenie" value={m.qualifications} onChange={(v) => set({ qualifications: v })} textarea full placeholder="np. mgr optometrii, 12 lat doświadczenia, kursy…" />
        <Field label="Specjalizacje" value={m.specializations} onChange={(v) => set({ specializations: v })} full placeholder="np. soczewki kontaktowe, badanie dzieci" />
        <Field label="Usługi, które wykonuje" value={m.services} onChange={(v) => set({ services: v })} full placeholder="wpisz po przecinku albo wybierz poniżej" />
      </div>
      {serviceNames.length > 0 && (
        <div className="chips-filter" style={{ marginTop: 8 }}>
          {serviceNames.map((s) => (
            <button key={s} className="chip" onClick={() => addService(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}

      <h3 className="ws-sub">Dni i godziny pracy</h3>
      {locations.length === 0 && <p className="muted" style={{ fontSize: 14 }}>Najpierw dodaj salony w zakładce „Profil firmy”, żeby przypisać do nich godziny pracy.</p>}
      {schedule.map((r, i) => (
        <div className="sched-row" key={i}>
          <select className="select" value={r.location} onChange={(e) => setRow(i, { location: e.target.value })}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="days">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`day${r.days.includes(d) ? ' on' : ''}`}
                onClick={() => setRow(i, { days: r.days.includes(d) ? r.days.filter((x) => x !== d) : DAYS.filter((x) => x === d || r.days.includes(x)) })}
              >
                {d}
              </button>
            ))}
          </div>
          <input className="input" type="time" value={r.from} onChange={(e) => setRow(i, { from: e.target.value })} aria-label="od" />
          <input className="input" type="time" value={r.to} onChange={(e) => setRow(i, { to: e.target.value })} aria-label="do" />
          <button className="btn btn-ghost btn-icon" aria-label="Usuń" onClick={() => set({ schedule: schedule.filter((_, j) => j !== i) })}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}
      {locations.length > 0 && (
        <button className="btn btn-sm" onClick={() => set({ schedule: [...schedule, { location: locations[0].id, days: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt'], from: '09:00', to: '17:00' }] })}>
          <Icon name="plus" size={15} /> Dodaj godziny pracy
        </button>
      )}

      <h3 className="ws-sub">Certyfikaty i dyplomy</h3>
      {certs.map((c) => (
        <div className="cert-row" key={c.id}>
          <Icon name="doc" size={16} />
          <span>{c.name}</span>
          <button
            className="btn btn-ghost btn-icon"
            aria-label="Usuń"
            onClick={async () => {
              await deleteFile(c)
              setCerts(certs.filter((x) => x.id !== c.id))
            }}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}
      <button
        className="btn btn-sm"
        disabled={busy}
        onClick={async () => {
          if (!m.name?.trim()) return toast('Najpierw wpisz imię i nazwisko.')
          if (!m.id) await persist()
          certInput.current?.click()
        }}
      >
        <Icon name="plus" size={15} /> Dodaj certyfikat lub dyplom
      </button>
      <input
        ref={certInput}
        type="file"
        multiple
        hidden
        accept="image/*,application/pdf"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (!files.length || !m.id) return
          setBusy(true)
          try {
            for (const f of files) {
              const cf = await uploadFile(clientId, f, { kind: 'certificate', memberId: m.id })
              setCerts((c) => [cf, ...c])
            }
          } catch (err) {
            toast((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      />

      <div className="modal-actions">
        {member && (
          <button
            className="btn btn-danger"
            style={{ marginRight: 'auto' }}
            onClick={async () => {
              if (!confirm(`Usunąć ${member.name} z zespołu?`)) return
              await deleteMember(member)
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
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          Zapisz
        </button>
      </div>
    </Modal>
  )
}
