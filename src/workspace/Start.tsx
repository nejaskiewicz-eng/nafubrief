import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Spinner, StatusBadge, useToast } from '../components/ui'
import { api } from '../lib/api'
import type { TemplateKey } from '../lib/types'
import {
  addTask, deleteStep, deleteTask, listAccess, listDocuments, listReviews, listSteps, listTasks, saveOrder, saveStep, toggleTask, updateTask,
  type AccessItem, type Step, type StepStatus, type Task,
} from '../lib/project'
import type { Brief, Client } from '../lib/types'
import { getProfile, listFiles, listServices, listTeam } from '../lib/workspace'

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
  access.filter((a) => a.status === 'todo' && a.urgent).forEach((a) =>
    gaps.push({ key: `acc-${a.id}`, text: `${a.kind === 'login' ? 'Przekaż dane logowania' : 'Udostępnij dostęp'}: ${a.title}`, tab: 'dostepy', urgent: true }),
  )
  const missing = access.filter((a) => a.status === 'todo' && !a.urgent).length
  if (missing) gaps.push({ key: 'access', text: `Udostępnij pozostałe dostępy (zostało: ${missing})`, tab: 'dostepy' })
  return gaps.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))
}

type Tpl = { key: TemplateKey; title: string }

const STATUS_LABEL: Record<StepStatus, string> = { done: 'Zakończony', current: 'W trakcie', todo: 'Przed nami' }

/** Zamiana miejscami w tablicy */
function swap<T>(arr: T[], i: number, d: number): T[] | null {
  const j = i + d
  if (j < 0 || j >= arr.length) return null
  const a = [...arr]
  ;[a[i], a[j]] = [a[j], a[i]]
  return a
}

export default function Start({
  client, briefs, isAdmin, onGo, onBriefsChanged, templates = [],
}: {
  client: Client
  briefs: Brief[]
  isAdmin: boolean
  /** administratorka: przełączenie zakładki w kartotece */
  onGo?: (tab: WsTab) => void
  /** administratorka: po dodaniu lub przepięciu ankiety */
  onBriefsChanged?: () => Promise<void> | void
  /** administratorka: szablony do dodania nowej ankiety do etapu */
  templates?: Tpl[]
}) {
  const toast = useToast()
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [access, setAccess] = useState<AccessItem[]>([])
  const [gaps, setGaps] = useState<Gap[] | null>(null)

  const load = useCallback(async () => {
    const [s, t, a] = await Promise.all([listSteps(client.id), listTasks(client.id), listAccess(client.id)])
    setSteps(s)
    setTasks(t)
    setAccess(a)
    computeGaps(client, briefs).then(setGaps).catch(() => setGaps([]))
  }, [client, briefs])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message)
    }
    await load()
  }

  if (!steps) return <Spinner />

  const current = steps.findIndex((s) => s.status === 'current')
  const doneCount = steps.filter((s) => s.status === 'done').length
  const clientOpen = tasks.filter((t) => t.visible && t.assignee === 'client' && !t.done_at)

  const go = (g: Gap) => {
    if (isAdmin) {
      if (g.tab && onGo) onGo(g.tab)
      return null
    }
    return g.href ?? `/${client.slug}/${g.tab}`
  }

  return (
    <div className="ws">
      <section className="card ws-card">
        <h2>Harmonogram projektu</h2>
        <div className="stepper-head">
          <span>
            {steps.length && doneCount === steps.length ? (
              <strong>Wszystkie etapy zakończone</strong>
            ) : current >= 0 ? (
              <>
                Obecny etap: <strong>{current}. {steps[current].title}</strong>
              </>
            ) : (
              'Projekt przed startem'
            )}
          </span>
          <div className="progress" aria-hidden>
            <span style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }} />
          </div>
        </div>

        <ol className="stepper">
          {steps.map((s, i) => (
            <StepItem
              key={s.id}
              step={s}
              index={i}
              steps={steps}
              client={client}
              isAdmin={isAdmin}
              briefs={briefs.filter((b) => b.step_id === s.id && (isAdmin || b.status !== 'draft')).sort((a, b) => a.step_position - b.step_position)}
              allBriefs={briefs}
              tasks={tasks.filter((t) => t.step_id === s.id)}
              access={access.filter((a) => a.step_id === s.id)}
              templates={templates}
              run={run}
              onBriefsChanged={onBriefsChanged}
              onMove={(d) => {
                const n = swap(steps, i, d)
                if (n) run(() => saveOrder('project_steps', n.map((x) => x.id)))
              }}
            />
          ))}
        </ol>

        {isAdmin && (
          <button
            className="btn btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => run(() => saveStep({ client_id: client.id, title: 'Nowy etap', position: steps.length, status: 'todo' }))}
          >
            <Icon name="plus" size={15} /> Dodaj etap
          </button>
        )}
      </section>

      <section className="card ws-card">
        <h2>{isAdmin ? 'Czego brakuje od klienta' : 'Do zrobienia'}</h2>
        <p className="muted ws-lead">
          {isAdmin
            ? 'Otwarte zadania klienta ze wszystkich etapów i automatycznie wykryte braki.'
            : 'Tyle zostało, żebym mogła ruszyć pełną parą. Kliknij punkt, żeby przejść do miejsca, gdzie to uzupełnisz.'}
        </p>
        {clientOpen.map((t) => (
          <div className="todo" key={t.id}>
            <button className="todo-check" aria-label="Oznacz jako zrobione" onClick={() => run(() => toggleTask(t, isAdmin))} />
            <div className="todo-body">
              <strong>{t.title}</strong>
              {(t.note || t.due_date) && <span className="muted">{[t.note, t.due_date ? `do ${fmtDay(t.due_date)}` : null].filter(Boolean).join(' · ')}</span>}
            </div>
            <span />
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
        {gaps && gaps.length === 0 && clientOpen.length === 0 && (
          <p style={{ margin: 0, color: 'var(--ok)', fontWeight: 600 }}>{isAdmin ? 'Klient ma wszystko uzupełnione.' : 'Wszystko gotowe, dziękuję! Resztą zajmę się ja.'}</p>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function StepItem({
  step, index, steps, client, isAdmin, briefs, allBriefs, tasks, access = [], templates, run, onBriefsChanged, onMove,
}: {
  step: Step
  index: number
  steps: Step[]
  client: Client
  isAdmin: boolean
  briefs: Brief[]
  allBriefs: Brief[]
  tasks: Task[]
  access?: AccessItem[]
  templates: Tpl[]
  run: (fn: () => Promise<unknown>) => Promise<void>
  onBriefsChanged?: () => Promise<void> | void
  onMove: (d: number) => void
}) {
  const [title, setTitle] = useState(step.title)
  const [note, setNote] = useState(step.note ?? '')
  useEffect(() => {
    setTitle(step.title)
    setNote(step.note ?? '')
  }, [step.title, step.note])

  const visibleTasks = isAdmin ? tasks : tasks.filter((t) => t.visible)
  const briefChanged = async (fn: () => Promise<unknown>) => {
    await run(fn)
    await onBriefsChanged?.()
  }

  return (
    <li className={`st st-${step.status}${isAdmin ? ' st-admin' : ''}`}>
      <span className="st-dot" aria-hidden>
        {step.status === 'done' ? '✓' : index}
      </span>
      <div className="st-card">
        {isAdmin ? (
          <>
            <div className="st-edit-top">
              <input
                className="inline-input st-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== step.title && run(() => saveStep({ ...step, title: title.trim() }))}
                aria-label="Nazwa etapu"
              />
              <div className="st-tools">
                <select
                  className={`select st-status is-${step.status}`}
                  value={step.status}
                  onChange={(e) => run(() => saveStep({ ...step, status: e.target.value as StepStatus }))}
                  aria-label="Status etapu"
                >
                  {(['todo', 'current', 'done'] as StepStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {STATUS_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  className="input st-date"
                  type="date"
                  value={step.due_date ?? ''}
                  onChange={(e) => run(() => saveStep({ ...step, due_date: e.target.value || null }))}
                  aria-label="Termin etapu"
                />
                <button className="btn btn-ghost btn-icon" aria-label="Etap wyżej" disabled={index === 0} onClick={() => onMove(-1)}>
                  <Icon name="up" size={15} />
                </button>
                <button className="btn btn-ghost btn-icon" aria-label="Etap niżej" disabled={index === steps.length - 1} onClick={() => onMove(1)}>
                  <Icon name="down" size={15} />
                </button>
                <button
                  className="btn btn-ghost btn-icon btn-danger"
                  aria-label="Usuń etap"
                  onClick={() => {
                    if (!confirm(`Usunąć etap „${step.title}” razem z jego zadaniami? Ankiety zostaną, tylko bez przypisania do etapu.`)) return
                    run(() => deleteStep(step.id)).then(() => onBriefsChanged?.())
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
            <input
              className="inline-input st-note-input"
              placeholder="Notatka dla klienta (opcjonalnie)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== (step.note ?? '') && run(() => saveStep({ ...step, note: note || null }))}
            />
          </>
        ) : (
          <>
            <div className="st-top">
              <strong>{step.title}</strong>
              <span className={`st-state is-${step.status}`}>{STATUS_LABEL[step.status]}</span>
            </div>
            {(step.due_date || step.note) && (
              <div className="st-meta">
                {step.due_date && <span>Termin: {fmtDay(step.due_date)}</span>}
                {step.note && <span>{step.note}</span>}
              </div>
            )}
          </>
        )}

        {(briefs.length > 0 || visibleTasks.length > 0 || access.length > 0 || isAdmin) && (
          <div className="st-items">
            {briefs.map((b, i) => (
              <div className="st-item" key={b.id}>
                <Icon name="doc" size={15} />
                <span className="st-item-title">{b.title}</span>
                {b.urgent && b.status !== 'submitted' && <span className="badge urgent">Pilne</span>}
                <StatusBadge status={b.status} />
                {!isAdmin && b.status !== 'submitted' && (
                  <Link className="btn btn-primary btn-sm" to={`/${client.slug}/${b.slug}`}>
                    {b.status === 'in_progress' ? 'Kontynuuj' : 'Wypełnij'}
                  </Link>
                )}
                {isAdmin && (
                  <ItemTools
                    first={i === 0}
                    last={i === briefs.length - 1}
                    steps={steps}
                    stepId={step.id}
                    onMove={(d) => {
                      const n = swap(briefs, i, d)
                      if (n) briefChanged(() => Promise.all(n.map((x, k) => api.updateBrief(x.id, { step_position: k }))))
                    }}
                    onStep={(id) => briefChanged(() => api.updateBrief(b.id, { step_id: id, step_position: 999 }))}
                  />
                )}
              </div>
            ))}

            {access.map((a) => (
              <div className="st-item" key={a.id}>
                <Icon name="unlock" size={15} />
                <span className="st-item-title">{a.title}</span>
                {a.urgent && a.status === 'todo' && <span className="badge urgent">Pilne</span>}
                <span className={`badge ${a.status === 'todo' ? 'in_progress' : a.status === 'done' ? 'submitted' : 'draft'}`}>
                  {a.status === 'todo' ? 'Do przekazania' : a.status === 'done' ? 'Przekazane' : 'Nie dotyczy'}
                </span>
                {!isAdmin && a.status === 'todo' && (
                  <Link className="btn btn-primary btn-sm" to={`/${client.slug}/dostepy`}>
                    Przekaż
                  </Link>
                )}
              </div>
            ))}

            {visibleTasks.map((t, i) => (
              <TaskItem
                key={t.id}
                task={t}
                isAdmin={isAdmin}
                steps={steps}
                first={i === 0}
                last={i === visibleTasks.length - 1}
                run={run}
                onMove={(d) => {
                  const n = swap(visibleTasks, i, d)
                  if (n) run(() => saveOrder('client_tasks', n.map((x) => x.id)))
                }}
              />
            ))}

            {isAdmin && (
              <AddToStep
                step={step}
                client={client}
                otherBriefs={allBriefs.filter((b) => b.step_id !== step.id)}
                templates={templates}
                position={tasks.length}
                run={run}
                onBriefsChanged={onBriefsChanged}
              />
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function ItemTools({
  first, last, steps, stepId, onMove, onStep,
}: {
  first: boolean
  last: boolean
  steps: Step[]
  stepId: string
  onMove: (d: number) => void
  onStep: (id: string) => void
}) {
  return (
    <span className="st-item-tools">
      <button className="btn btn-ghost btn-icon" aria-label="Wyżej" disabled={first} onClick={() => onMove(-1)}>
        <Icon name="up" size={14} />
      </button>
      <button className="btn btn-ghost btn-icon" aria-label="Niżej" disabled={last} onClick={() => onMove(1)}>
        <Icon name="down" size={14} />
      </button>
      <select className="select st-move" value={stepId} onChange={(e) => onStep(e.target.value)} aria-label="Przenieś do etapu">
        {steps.map((x, k) => (
          <option key={x.id} value={x.id}>
            Etap {k}: {x.title}
          </option>
        ))}
      </select>
    </span>
  )
}

function TaskItem({
  task, isAdmin, steps, first, last, run, onMove,
}: {
  task: Task
  isAdmin: boolean
  steps: Step[]
  first: boolean
  last: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  onMove: (d: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [note, setNote] = useState(task.note ?? '')
  useEffect(() => {
    setTitle(task.title)
    setNote(task.note ?? '')
  }, [task.title, task.note])
  const canTick = isAdmin || task.assignee === 'client'

  return (
    <div className={`st-item task${task.done_at ? ' done' : ''}${!task.visible ? ' hidden-task' : ''}`}>
      {canTick ? (
        <button
          className={`todo-check${task.done_at ? ' on' : ''}`}
          aria-label={task.done_at ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'}
          onClick={() => run(() => toggleTask(task, isAdmin))}
        >
          {task.done_at ? '✓' : ''}
        </button>
      ) : (
        <span className={`todo-auto${task.done_at ? ' ok' : ''}`} aria-label={task.done_at ? 'Zrobione' : 'W toku'}>
          {task.done_at ? '✓' : '•'}
        </span>
      )}
      {isAdmin ? (
        <input
          className="inline-input st-item-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && run(() => updateTask(task.id, { title: title.trim() }))}
          aria-label="Treść zadania"
        />
      ) : (
        <span className="st-item-title">
          {task.title}
          {task.note && <span className="muted st-item-note">{task.note}</span>}
        </span>
      )}
      <span className={`badge ${task.assignee === 'client' ? 'sent' : 'draft'}`}>{task.assignee === 'client' ? (isAdmin ? 'Klient' : 'Twoje zadanie') : isAdmin ? 'Ja' : 'Po stronie NAFU Design'}</span>
      {isAdmin && !task.visible && <span className="badge draft">Ukryte przed klientem</span>}
      {task.due_date && <span className="muted" style={{ fontSize: 12.5 }}>do {fmtDay(task.due_date)}</span>}
      {isAdmin && (
        <span className="st-item-tools">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>
            {open ? 'Zwiń' : 'Więcej'}
          </button>
          <button className="btn btn-ghost btn-icon" aria-label="Wyżej" disabled={first} onClick={() => onMove(-1)}>
            <Icon name="up" size={14} />
          </button>
          <button className="btn btn-ghost btn-icon" aria-label="Niżej" disabled={last} onClick={() => onMove(1)}>
            <Icon name="down" size={14} />
          </button>
          <button className="btn btn-ghost btn-icon btn-danger" aria-label="Usuń zadanie" onClick={() => confirm(`Usunąć zadanie „${task.title}”?`) && run(() => deleteTask(task.id))}>
            <Icon name="trash" size={14} />
          </button>
        </span>
      )}
      {isAdmin && open && (
        <div className="task-more">
          <label className="field">
            <span className="label">Opis (widzi klient, jeśli zadanie jest widoczne)</span>
            <textarea className="textarea" style={{ minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (task.note ?? '') && run(() => updateTask(task.id, { note: note || null }))} />
          </label>
          <div className="row">
            <div className="seg" role="radiogroup" aria-label="Kto wykonuje">
              <button className={task.assignee === 'client' ? 'on' : ''} onClick={() => run(() => updateTask(task.id, { assignee: 'client' }))}>
                Klient
              </button>
              <button className={task.assignee === 'nafu' ? 'on' : ''} onClick={() => run(() => updateTask(task.id, { assignee: 'nafu' }))}>
                Ja
              </button>
            </div>
            <label className="switch">
              <input type="checkbox" checked={task.visible} onChange={(e) => run(() => updateTask(task.id, { visible: e.target.checked }))} /> Widoczne dla klienta
            </label>
            <input className="input st-date" type="date" value={task.due_date ?? ''} onChange={(e) => run(() => updateTask(task.id, { due_date: e.target.value || null }))} aria-label="Termin" />
            <select className="select st-move" value={task.step_id ?? ''} onChange={(e) => run(() => updateTask(task.id, { step_id: e.target.value, position: 999 }))} aria-label="Przenieś do etapu">
              {steps.map((x, k) => (
                <option key={x.id} value={x.id}>
                  Etap {k}: {x.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

function AddToStep({
  step, client, otherBriefs, templates, position, run, onBriefsChanged,
}: {
  step: Step
  client: Client
  otherBriefs: Brief[]
  templates: Tpl[]
  position: number
  run: (fn: () => Promise<unknown>) => Promise<void>
  onBriefsChanged?: () => Promise<void> | void
}) {
  const toast = useToast()
  const [mode, setMode] = useState<null | 'task' | 'brief'>(null)
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState<'client' | 'nafu'>('client')
  const [visible, setVisible] = useState(true)

  if (!mode)
    return (
      <div className="st-add-row">
        <button className="btn btn-ghost btn-sm" onClick={() => setMode('task')}>
          <Icon name="plus" size={14} /> Zadanie
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode('brief')}>
          <Icon name="plus" size={14} /> Ankieta
        </button>
      </div>
    )

  if (mode === 'brief')
    return (
      <div className="st-add">
        <select
          className="select"
          defaultValue=""
          onChange={async (e) => {
            const v = e.target.value
            if (!v) return
            await run(async () => {
              if (v.startsWith('new:')) {
                await api.addBriefs(client.id, [v.slice(4) as TemplateKey], step.id)
                toast('Dodano ankietę jako szkic. Sprawdź pytania i zatwierdź ją w „Ankiety i dostęp”.')
              } else {
                await api.updateBrief(v, { step_id: step.id, step_position: 999 })
              }
            })
            setMode(null)
            await onBriefsChanged?.()
          }}
        >
          <option value="">Wybierz ankietę…</option>
          {otherBriefs.length > 0 && (
            <optgroup label="Przenieś ankietę klienta">
              {otherBriefs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Nowa ankieta">
            {templates.map((t) => (
              <option key={t.key} value={`new:${t.key}`}>
                {t.title}
              </option>
            ))}
          </optgroup>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
          Anuluj
        </button>
      </div>
    )

  const save = async () => {
    if (!title.trim()) return
    await run(() => addTask({ client_id: client.id, step_id: step.id, title: title.trim(), assignee, visible, position }))
    setTitle('')
  }
  return (
    <div className="st-task-form">
      <input
        className="input"
        autoFocus
        placeholder="Treść zadania, np. Prześlij zdjęcia nowej kolekcji"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <div className="row">
        <div className="seg" role="radiogroup" aria-label="Kto wykonuje">
          <button className={assignee === 'client' ? 'on' : ''} onClick={() => setAssignee('client')}>
            Klient
          </button>
          <button className={assignee === 'nafu' ? 'on' : ''} onClick={() => setAssignee('nafu')}>
            Ja
          </button>
        </div>
        <label className="switch">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Widoczne dla klienta
        </label>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
          Gotowe
        </button>
        <button className="btn btn-primary btn-sm" disabled={!title.trim()} onClick={save}>
          Dodaj
        </button>
      </div>
    </div>
  )
}
