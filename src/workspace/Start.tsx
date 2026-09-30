import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Spinner, useToast } from '../components/ui'
import {
  addTask, deleteStep, deleteTask, listAccess, listDocuments, listReviews, listSteps, listTasks, saveStep, toggleTask,
  ACCESS_SERVICES, type Step, type Task,
} from '../lib/project'
import type { Brief, Client } from '../lib/types'
import { getProfile, listFiles, listServices, listTeam } from '../lib/workspace'
import { Field } from './bits'

export type WsTab = 'start' | 'podglad' | 'profil' | 'media' | 'zespol' | 'uslugi' | 'dostepy' | 'dokumenty' | 'wiadomosci'

interface Gap {
  key: string
  text: string
  tab?: WsTab
  href?: string
  urgent?: boolean
}

const fmtDay = (d: string | null) => (d ? new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '')

/** Automatyczna lista braków: co klient ma jeszcze uzupełnić */
async function computeGaps(client: Client, briefs: Brief[]): Promise<Gap[]> {
  const [profile, files, team, services, access, docs, reviews] = await Promise.all([
    getProfile(client.id), listFiles(client.id, 'media'), listTeam(client.id), listServices(client.id),
    listAccess(client.id), listDocuments(client.id), listReviews(client.id),
  ])
  const gaps: Gap[] = []
  const open = briefs.filter((b) => b.status !== 'draft' && b.status !== 'submitted').sort((a, b) => Number(b.urgent) - Number(a.urgent))
  open.forEach((b) =>
    gaps.push({ key: `brief-${b.id}`, text: `${b.status === 'in_progress' ? 'Dokończ' : 'Wypełnij'} ankietę „${b.title}”`, href: `/${client.slug}/${b.slug}`, urgent: b.urgent }),
  )
  reviews.filter((r) => r.status === 'pending').forEach((r) =>
    gaps.push({ key: `rev-${r.id}`, text: `${r.kind === 'concept' ? 'Obejrzyj koncept' : 'Sprawdź podgląd'} „${r.title}” i daj znać, czy akceptujesz`, tab: 'podglad' }),
  )
  docs.filter((d) => d.visible && d.requires_acceptance && !d.accepted_at).forEach((d) =>
    gaps.push({ key: `doc-${d.id}`, text: `Przeczytaj i zaakceptuj dokument „${d.title}”`, tab: 'dokumenty' }),
  )
  const companies = (profile.companies ?? []).filter((c) => c.name)
  if (!companies.length) gaps.push({ key: 'company', text: 'Uzupełnij dane firmy w profilu', tab: 'profil' })
  if (!profile.contact_phone && !profile.contact_email) gaps.push({ key: 'contact', text: 'Podaj osobę i dane do kontaktu', tab: 'profil' })
  const locs = (profile.locations ?? []).filter((l) => l.name)
  if (!locs.length) gaps.push({ key: 'locations', text: 'Dodaj salony (adresy i godziny otwarcia)', tab: 'profil' })
  else if (locs.some((l) => !l.hours)) gaps.push({ key: 'hours', text: 'Uzupełnij godziny otwarcia salonów', tab: 'profil' })
  if (!files.some((f) => f.category === 'Logo i identyfikacja')) gaps.push({ key: 'logo', text: 'Wgraj logo (najlepiej w plikach źródłowych)', tab: 'media' })
  if (files.filter((f) => f.category === 'Zdjęcia salonu').length < 3) gaps.push({ key: 'photos', text: 'Wgraj zdjęcia salonu (z zewnątrz i wnętrz)', tab: 'media' })
  if (!team.length) gaps.push({ key: 'team', text: 'Dodaj osoby z zespołu', tab: 'zespol' })
  else if (team.some((m) => !m.photo_path)) gaps.push({ key: 'team-photo', text: 'Dodaj zdjęcia osób z zespołu', tab: 'zespol' })
  if (!services.length) gaps.push({ key: 'services', text: 'Dodaj usługi z cenami', tab: 'uslugi' })
  const doneAccess = new Set(access.filter((a) => a.status !== 'todo').map((a) => a.service))
  const missing = ACCESS_SERVICES.filter((s) => !doneAccess.has(s.key)).length
  if (missing) gaps.push({ key: 'access', text: `Udostępnij mi dostępy do kont (zostało: ${missing})`, tab: 'dostepy' })
  return gaps
}

export default function Start({
  client, briefs, isAdmin, onGo,
}: {
  client: Client
  briefs: Brief[]
  isAdmin: boolean
  /** administratorka: przełączenie zakładki w kartotece */
  onGo?: (tab: WsTab) => void
}) {
  const toast = useToast()
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [gaps, setGaps] = useState<Gap[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', due: '' })

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([listSteps(client.id), listTasks(client.id)])
    setSteps(s)
    setTasks(t)
    computeGaps(client, briefs).then(setGaps).catch(() => setGaps([]))
  }, [client, briefs])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  if (!steps) return <Spinner />

  const current = steps.findIndex((s) => s.status === 'current')
  const doneCount = steps.filter((s) => s.status === 'done').length
  const openTasks = tasks.filter((t) => !t.done_at)
  const doneTasks = tasks.filter((t) => t.done_at)

  const go = (g: Gap) => {
    if (isAdmin) {
      if (g.tab && onGo) onGo(g.tab)
      return null
    }
    return g.href ?? `/${client.slug}/${g.tab}`
  }

  const setCurrent = async (i: number) => {
    const next = steps.map((s, j) => ({ ...s, status: (j < i ? 'done' : j === i ? 'current' : 'todo') as Step['status'] }))
    setSteps(next)
    await Promise.all(next.map((s) => saveStep(s)))
  }

  return (
    <div className="ws">
      {/* Harmonogram */}
      <section className="card ws-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Harmonogram projektu</h2>
          {isAdmin && (
            <button className="btn btn-sm" onClick={() => setEditing(!editing)}>
              <Icon name="edit" size={15} /> {editing ? 'Gotowe' : 'Edytuj etapy'}
            </button>
          )}
        </div>
        {!editing ? (
          <>
            <div className="stepper-head">
              <span>
                {doneCount === steps.length ? (
                  <strong>Wszystkie etapy zakończone</strong>
                ) : (
                  <>
                    Etap <strong>{Math.max(current, 0) + 1}</strong> z {steps.length}
                  </>
                )}
              </span>
              <div className="progress" aria-hidden>
                <span style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }} />
              </div>
            </div>
            <ol className="stepper">
              {steps.map((s, i) => (
                <li key={s.id} className={`st st-${s.status}`}>
                  <span className="st-dot" aria-hidden>
                    {s.status === 'done' ? '✓' : i + 1}
                  </span>
                  <div className="st-card">
                    <div className="st-top">
                      <strong>{s.title}</strong>
                      <span className={`st-state is-${s.status}`}>{s.status === 'done' ? 'Zakończony' : s.status === 'current' ? 'W trakcie' : 'Przed nami'}</span>
                    </div>
                    {(s.due_date || s.note) && (
                      <div className="st-meta">
                        {s.due_date && <span>Termin: {fmtDay(s.due_date)}</span>}
                        {s.note && <span>{s.note}</span>}
                      </div>
                    )}
                    {isAdmin && s.status !== 'current' && (
                      <button className="btn btn-ghost btn-sm st-set" onClick={() => setCurrent(i)}>
                        Ustaw jako obecny etap
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {steps.map((s, i) => (
              <div className="step-edit" key={s.id}>
                <input className="input" value={s.title} onChange={(e) => setSteps(steps.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} onBlur={() => saveStep(s)} />
                <input className="input" type="date" value={s.due_date ?? ''} onChange={(e) => {
                  const u = { ...s, due_date: e.target.value || null }
                  setSteps(steps.map((x) => (x.id === s.id ? u : x)))
                  saveStep(u)
                }} />
                <input className="input" placeholder="Notatka dla klienta" value={s.note ?? ''} onChange={(e) => setSteps(steps.map((x) => (x.id === s.id ? { ...x, note: e.target.value } : x)))} onBlur={() => saveStep(s)} />
                <button className="btn btn-ghost btn-icon" aria-label="Usuń etap" onClick={async () => {
                  if (!confirm(`Usunąć etap „${s.title}”?`)) return
                  await deleteStep(s.id)
                  load()
                }}>
                  <Icon name="trash" size={15} />
                </button>
                <span className="muted" style={{ fontSize: 12 }}>{i + 1}</span>
              </div>
            ))}
            <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={async () => {
              await saveStep({ client_id: client.id, title: 'Nowy etap', position: steps.length, status: 'todo' })
              load()
            }}>
              <Icon name="plus" size={15} /> Dodaj etap
            </button>
          </div>
        )}

      </section>

      {/* Do zrobienia */}
      <section className="card ws-card">
        <h2>{isAdmin ? 'Do zrobienia po stronie klienta' : 'Do zrobienia'}</h2>
        <p className="muted ws-lead">
          {isAdmin ? 'Twoje zadania dla klienta i automatycznie wykryte braki.' : 'Tyle zostało, żebym mogła ruszyć pełną parą. Kliknij punkt, żeby przejść do miejsca, gdzie to uzupełnisz.'}
        </p>

        {openTasks.map((t) => (
          <div className="todo" key={t.id}>
            <button className="todo-check" aria-label="Oznacz jako zrobione" onClick={async () => {
              await toggleTask(t)
              load()
            }} />
            <div className="todo-body">
              <strong>{t.title}</strong>
              {(t.note || t.due_date) && <span className="muted">{[t.note, t.due_date ? `do ${fmtDay(t.due_date)}` : null].filter(Boolean).join(' · ')}</span>}
            </div>
            {isAdmin && (
              <button className="btn btn-ghost btn-icon" aria-label="Usuń zadanie" onClick={async () => {
                await deleteTask(t.id)
                load()
              }}>
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        ))}

        {gaps === null ? (
          <Spinner />
        ) : (
          gaps.map((g) => {
            const href = isAdmin ? null : go(g)
            const inner = (
              <>
                <span className={`todo-auto${g.urgent ? ' urgent' : ''}`}>{g.urgent ? '!' : '•'}</span>
                <div className="todo-body">
                  <strong>{g.text}</strong>
                  {g.urgent && <span className="badge urgent" style={{ justifySelf: 'start' }}>Pilne</span>}
                </div>
                <Icon name="back" size={15} />
              </>
            )
            return href ? (
              <Link className="todo link" key={g.key} to={href}>
                {inner}
              </Link>
            ) : (
              <button className="todo link" key={g.key} onClick={() => go(g)}>
                {inner}
              </button>
            )
          })
        )}
        {gaps && gaps.length === 0 && openTasks.length === 0 && (
          <p style={{ margin: 0, color: 'var(--ok)', fontWeight: 600 }}>{isAdmin ? 'Klient ma wszystko uzupełnione.' : 'Wszystko gotowe, dziękuję! Resztą zajmę się ja.'}</p>
        )}

        {isAdmin && (
          <div className="task-add">
            <Field label="Nowe zadanie dla klienta" value={newTask.title} onChange={(v) => setNewTask({ ...newTask, title: v })} placeholder="np. Prześlij zdjęcia nowej kolekcji" />
            <Field label="Termin" type="date" value={newTask.due} onChange={(v) => setNewTask({ ...newTask, due: v })} />
            <button className="btn btn-primary btn-sm" disabled={!newTask.title.trim()} onClick={async () => {
              await addTask(client.id, newTask.title.trim(), undefined, newTask.due || undefined)
              setNewTask({ title: '', due: '' })
              load()
            }}>
              <Icon name="plus" size={15} /> Dodaj
            </button>
          </div>
        )}

        {doneTasks.length > 0 && (
          <details className="done-list">
            <summary>Zrobione ({doneTasks.length})</summary>
            {doneTasks.map((t) => (
              <div className="todo done" key={t.id}>
                <button className="todo-check on" aria-label="Przywróć" onClick={async () => {
                  await toggleTask(t)
                  load()
                }}>
                  ✓
                </button>
                <div className="todo-body">
                  <strong>{t.title}</strong>
                </div>
              </div>
            ))}
          </details>
        )}
      </section>
    </div>
  )
}
