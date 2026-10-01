import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon, Modal, Spinner, StatusBadge, fmtDate, useToast } from '../components/ui'
import { api } from '../lib/api'
import {
  CASE_BADGE, CASE_STATUS, PRIORITY_LABEL, SECTIONS, acceptCase, addCaseFile, addCaseLink, deleteTip, listCaseMedia, listTips, saveTip, toggleTip, addCaseBrief, caseUnread, inviteToCase, closeCase, createCase, deleteCase, deleteCaseMessage, editCaseMessage,
  linkItem, listCaseItems, listCaseMessages, listCases, markCaseRead, reopenCase, requestAcceptance, returnCase, sendCaseMessage, updateCase,
  type Case, type CaseItems, type CaseMessage, type CasePriority, type CaseSection, type CaseTip,
} from '../lib/cases'
import { addTask, deleteTask, listAccess, listDocuments, listTasks, toggleTask, updateDocument, updateTask, type Task } from '../lib/project'
import type { Brief, Client } from '../lib/types'
import { deleteFile, fmtSize, signedUrls, type ClientFile } from '../lib/workspace'
import Access from './Access'
import { Empty, Field, Toggle } from './bits'
import Documents from './Documents'

const fmtDay = (d: string | null) => (d ? new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/** Sprawy bieżące: lista spraw klienta i widok jednej sprawy (adres ?sprawa=id) */
export default function Cases({ client, isAdmin }: { client: Client; isAdmin: boolean }) {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [cases, setCases] = useState<Case[] | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [creating, setCreating] = useState(false)
  const openId = params.get('sprawa')

  const load = useCallback(async () => {
    const [list, un] = await Promise.all([listCases(client.id), caseUnread(client.id, isAdmin).catch(() => ({}))])
    setCases(list)
    setUnread(un)
  }, [client.id, isAdmin])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  const open = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('sprawa', id)
    else next.delete('sprawa')
    setParams(next)
  }

  if (!cases) return <Spinner />
  const current = openId ? cases.find((c) => c.id === openId) : null
  if (current) return <CaseView key={current.id} client={client} c={current} isAdmin={isAdmin} onBack={() => open(null)} onChanged={load} />

  const rank: Record<CasePriority, number> = { very_urgent: 0, urgent: 1, normal: 2 }
  const active = cases.filter((c) => c.status !== 'closed').sort((a, b) => rank[a.priority] - rank[b.priority])
  const closed = cases.filter((c) => c.status === 'closed')

  return (
    <div className="ws">
      <div className="ws-savebar">
        <span className="muted" style={{ fontSize: 14 }}>
          {isAdmin
            ? 'Każdy temat osobno: ankieta, dokumenty, zadania, dostępy i rozmowa w jednym miejscu. Klient akceptuje, Ty zamykasz z podsumowaniem.'
            : 'Tu prowadzimy osobne tematy, np. dokumenty prawne. Możesz też założyć własną sprawę, gdy coś potrzebujesz ustalić.'}
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} /> Nowa sprawa
        </button>
      </div>

      {cases.length === 0 && (
        <Empty
          title={isAdmin ? 'Brak spraw' : 'Nie ma jeszcze spraw'}
          text={isAdmin ? 'Załóż sprawę, gdy temat wymaga kilku kroków i akceptacji klienta.' : 'Gdy zaczniemy nowy temat, pojawi się tutaj. Możesz też założyć sprawę sama lub sam.'}
        />
      )}
      {active.length > 0 && <CaseList title="W toku" list={active} unread={unread} isAdmin={isAdmin} onOpen={open} />}
      {closed.length > 0 && <CaseList title="Zamknięte" list={closed} unread={unread} isAdmin={isAdmin} onOpen={open} />}

      {creating && (
        <NewCase
          isAdmin={isAdmin}
          onClose={() => setCreating(false)}
          onSave={async (title, description, due, priority) => {
            const c = await createCase({ client_id: client.id, title, description: description || null, due_date: due || null, priority, created_by: isAdmin ? 'admin' : 'client' })
            setCreating(false)
            await load()
            open(c.id)
          }}
        />
      )}
    </div>
  )
}

function CaseList({ title, list, unread, isAdmin, onOpen }: { title: string; list: Case[]; unread: Record<string, number>; isAdmin: boolean; onOpen: (id: string) => void }) {
  return (
    <div className="card">
      <div className="eyebrow" style={{ padding: '4px 4px 10px' }}>{title}</div>
      {list.map((c) => (
        <button className="brief-row case-row" key={c.id} onClick={() => onOpen(c.id)}>
          <div className="brief-icon" style={{ background: c.status === 'closed' ? '#8aa0a7' : 'linear-gradient(135deg,#0a7189,#02afca)' }}>
            <Icon name="doc" size={20} />
          </div>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <h3>{c.title}</h3>
            <div className="meta">
              <span className={`badge ${CASE_BADGE[c.status]}`}>{CASE_STATUS[c.status]}</span>
              {c.priority !== 'normal' && c.status !== 'closed' && <span className="badge urgent">{PRIORITY_LABEL[c.priority]}</span>}
              {c.created_by === 'client' && <span className="badge draft">{isAdmin ? 'Założona przez klienta' : 'Założona przez Ciebie'}</span>}
              {c.due_date && c.status !== 'closed' && <span>termin {fmtDay(c.due_date)}</span>}
              <span>zmiana {fmtDate(c.updated_at)}</span>
            </div>
          </div>
          <div className="actions">
            {unread[c.id] > 0 && <span className="tab-dot">{unread[c.id]}</span>}
            <span className="btn btn-sm">Otwórz</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function NewCase({ isAdmin, onClose, onSave }: { isAdmin: boolean; onClose: () => void; onSave: (title: string, description: string, due: string, priority: CasePriority) => Promise<void> }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<CasePriority>('normal')
  const [busy, setBusy] = useState(false)
  return (
    <Modal label="Nowa sprawa" onClose={onClose}>
      <div className="eyebrow">Sprawy bieżące</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Nowa sprawa</h2>
      <div className="stack">
        <Field label="Temat" value={title} onChange={setTitle} placeholder={isAdmin ? 'np. Dokumenty prawne dla obecnej strony' : 'np. Zmiana godzin otwarcia na stronie'} />
        <Field label="Opis" value={description} onChange={setDescription} textarea placeholder={isAdmin ? 'Co trzeba zrobić i czego potrzebuję od klienta' : 'Opisz, czego dotyczy sprawa'} />
        <PriorityPick value={priority} onChange={setPriority} />
        {isAdmin && <Field label="Termin (opcjonalnie)" type="date" value={due} onChange={setDue} />}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            if (!title.trim()) return toast('Podaj temat sprawy.')
            setBusy(true)
            try {
              await onSave(title.trim(), description.trim(), due, priority)
            } catch (e) {
              toast((e as Error).message)
              setBusy(false)
            }
          }}
        >
          Załóż sprawę
        </button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function CaseView({ client, c, isAdmin, onBack, onChanged }: { client: Client; c: Case; isAdmin: boolean; onBack: () => void; onChanged: () => Promise<void> }) {
  const toast = useToast()
  const [items, setItems] = useState<CaseItems | null>(null)
  const [editing, setEditing] = useState(false)
  const [inviting, setInviting] = useState(false)
  const canEditCase = isAdmin || (c.created_by === 'client' && c.status === 'open')
  const on = (k: CaseSection) => (c.sections ?? []).includes(k)
  const locked = c.status === 'closed'

  const loadItems = useCallback(async () => {
    setItems(await listCaseItems(c.id))
  }, [c.id])
  useEffect(() => {
    loadItems().catch((e) => toast((e as Error).message))
  }, [loadItems, toast])

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn()
      if (msg) toast(msg)
    } catch (e) {
      toast((e as Error).message)
    }
    await Promise.all([loadItems(), onChanged()])
  }

  return (
    <div className="ws case">
      <div className="ws-savebar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <Icon name="back" size={15} /> Wszystkie sprawy
        </button>
        <div className="row">
          {canEditCase && !locked && (
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              <Icon name="edit" size={15} /> Edytuj
            </button>
          )}
          {canEditCase && (
            <button
              className="btn btn-sm btn-danger"
              aria-label="Usuń sprawę"
              onClick={async () => {
                if (!confirm(`Usunąć sprawę „${c.title}”? Ankiety, dokumenty, zadania i dostępy zostaną w panelu, tylko bez przypisania do sprawy. Rozmowa zostanie usunięta.`)) return
                await run(() => deleteCase(c.id), 'Usunięto sprawę')
                onBack()
              }}
            >
              <Icon name="trash" size={15} />
            </button>
          )}
        </div>
      </div>

      {isAdmin && <SectionsPicker c={c} run={run} />}

      {isAdmin && !locked && (
        <div className="case-invite">
          <div>
            <strong>Powiadom klienta o tej sprawie</strong>
            <span className="muted">
              {c.invited_at ? ` Ostatnie powiadomienie: ${fmtDate(c.invited_at)}.` : ' E-mail z prośbą o dołączenie i linkiem prosto do sprawy.'}
            </span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setInviting(true)}>
            <Icon name="mail" size={15} /> {c.invited_at ? 'Wyślij ponownie' : 'Wyślij powiadomienie e-mail'}
          </button>
        </div>
      )}

      <section className="card case-head">
        <div className="meta">
          <span className={`badge ${CASE_BADGE[c.status]}`}>{CASE_STATUS[c.status]}</span>
          {c.priority !== 'normal' && <span className="badge urgent">{PRIORITY_LABEL[c.priority]}</span>}
          {c.created_by === 'client' && <span className="badge draft">{isAdmin ? 'Założona przez klienta' : 'Założona przez Ciebie'}</span>}
          {c.due_date && <span>termin {fmtDay(c.due_date)}</span>}
          <span>założona {fmtDate(c.created_at)}</span>
        </div>
        <h2>{c.title}</h2>
        {c.description && <p className="case-desc">{c.description}</p>}
      </section>

      {!items ? (
        <Spinner />
      ) : (
        <>
          {on('tasks') && <TasksBlock client={client} c={c} tasks={items.tasks} isAdmin={isAdmin} locked={locked} run={run} />}
          {on('tips') && <TipsBlock c={c} isAdmin={isAdmin} locked={locked} />}
          {on('briefs') && <BriefsBlock client={client} c={c} briefs={items.briefs} isAdmin={isAdmin} locked={locked} run={run} />}

          {on('contracts') && (
            <section className="card case-sec">
              <SecHead title="Umowy" hint={isAdmin ? 'Umowy w tej sprawie. Szkic widzisz tylko Ty, dopóki go nie udostępnisz.' : 'Przeczytaj i zaakceptuj umowy w tej sprawie.'} />
              {isAdmin && !locked && (
                <LinkExisting
                  label="Podepnij umowę"
                  load={async () => (await listDocuments(client.id)).filter((d) => !d.case_id).map((d) => ({ id: d.id, label: d.title }))}
                  onPick={(id) => run(async () => { await linkItem('client_documents', id, c.id); await updateDocument(id, { kind: 'contract' }) }, 'Podpięto umowę')}
                />
              )}
              <Documents client={client} isAdmin={isAdmin} caseId={c.id} only="contract" key={`k-${items.documents.length}`} />
            </section>
          )}

          {on('documents') && (
            <section className="card case-sec">
              <SecHead title="Dokumenty" hint={isAdmin ? 'Szkice są widoczne tylko dla Ciebie, dopóki ich nie udostępnisz.' : 'Przeczytaj i zaakceptuj dokumenty przygotowane w tej sprawie.'} />
              {isAdmin && !locked && (
                <LinkExisting
                  label="Podepnij dokument"
                  load={async () => (await listDocuments(client.id)).filter((d) => !d.case_id).map((d) => ({ id: d.id, label: d.title }))}
                  onPick={(id) => run(() => linkItem('client_documents', id, c.id), 'Podpięto dokument')}
                />
              )}
              <Documents client={client} isAdmin={isAdmin} caseId={c.id} only="other" key={`d-${items.documents.length}`} />
            </section>
          )}

          {on('access') && (
            <section className="card case-sec">
              <SecHead title="Dostępy" hint={isAdmin ? 'Dopisz, do czego potrzebujesz dostępu w tej sprawie.' : 'Tu udzielasz dostępów potrzebnych w tej sprawie.'} />
              {isAdmin && !locked && (
                <LinkExisting
                  label="Podepnij dostęp z listy"
                  load={async () => (await listAccess(client.id)).filter((a) => !a.case_id).map((a) => ({ id: a.id, label: a.title }))}
                  onPick={(id) => run(() => linkItem('access_items', id, c.id), 'Podpięto dostęp')}
                />
              )}
              <Access clientId={client.id} isAdmin={isAdmin} caseId={c.id} key={`a-${items.access.length}`} />
            </section>
          )}

          {on('media') && <MediaBlock c={c} isAdmin={isAdmin} locked={locked} />}
          {on('chat') && <CaseChat c={c} isAdmin={isAdmin} />}
          {on('closing') && <Closing c={c} isAdmin={isAdmin} run={run} />}
        </>
      )}

      {inviting && (
        <InviteCase
          c={c}
          client={client}
          onClose={() => setInviting(false)}
          onSend={async (note, test) => {
            const to = await inviteToCase(c.id, note, test)
            if (!test) setInviting(false)
            await run(async () => {}, test ? `Wysłano test na ${to}` : `Wysłano powiadomienie na ${to}`)
          }}
        />
      )}
      {editing && (
        <EditCase
          c={c}
          isAdmin={isAdmin}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            await run(() => updateCase(c.id, patch), 'Zapisano')
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

function SecHead({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="case-sec-head">
      <div>
        <h3>{title}</h3>
        {hint && <p className="muted">{hint}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

/** Wybór istniejącego elementu klienta, który nie należy jeszcze do żadnej sprawy */
function LinkExisting({ label, load, onPick }: { label: string; load: () => Promise<Array<{ id: string; label: string }>>; onPick: (id: string) => Promise<void> }) {
  const [opts, setOpts] = useState<Array<{ id: string; label: string }> | null>(null)
  if (!opts)
    return (
      <button className="btn btn-ghost btn-sm case-link-btn" onClick={async () => setOpts(await load())}>
        <Icon name="link" size={15} /> {label}
      </button>
    )
  if (opts.length === 0) return <p className="muted case-link-btn">Nie ma pozycji bez przypisanej sprawy.</p>
  return (
    <select
      className="select case-link-btn"
      defaultValue=""
      onChange={async (e) => {
        if (!e.target.value) return
        await onPick(e.target.value)
        setOpts(null)
      }}
    >
      <option value="">{label}…</option>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* ---------- zadania ---------- */

function TasksBlock({ client, c, tasks, isAdmin, locked, run }: { client: Client; c: Case; tasks: Task[]; isAdmin: boolean; locked: boolean; run: (fn: () => Promise<unknown>, msg?: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const [assignee, setAssignee] = useState<'client' | 'nafu'>('client')
  const [visible, setVisible] = useState(true)
  const [adding, setAdding] = useState(false)
  if (!isAdmin && tasks.length === 0) return null
  const done = tasks.filter((t) => t.done_at).length

  return (
    <section className="card case-sec">
      <SecHead title="Zadania" hint={tasks.length ? `Zrobione: ${done} z ${tasks.length}` : 'Zadania dla klienta i dla Ciebie w tej sprawie.'}>
        {isAdmin && !locked && (
          <button className="btn btn-sm" onClick={() => setAdding(!adding)}>
            <Icon name="plus" size={15} /> Zadanie
          </button>
        )}
        {isAdmin && !locked && (
          <LinkExisting
            label="Podepnij zadanie"
            load={async () => (await listTasks(client.id)).filter((t) => !t.case_id).map((t) => ({ id: t.id, label: t.title }))}
            onPick={(id) => run(() => linkItem('client_tasks', id, c.id), 'Podpięto zadanie')}
          />
        )}
      </SecHead>

      {adding && (
        <div className="case-form">
          <Field label="Zadanie" value={title} onChange={setTitle} placeholder="np. Sprawdzić personel w Rejestrze Sprawców i KRK" />
          <Field label="Opis (widzi klient, jeśli zadanie jest widoczne)" value={note} onChange={setNote} textarea />
          <div className="row">
            <div className="seg" role="radiogroup" aria-label="Kto wykonuje">
              <button className={assignee === 'client' ? 'on' : ''} onClick={() => setAssignee('client')}>
                Klient
              </button>
              <button className={assignee === 'nafu' ? 'on' : ''} onClick={() => setAssignee('nafu')}>
                Ja
              </button>
            </div>
            <input className="input st-date" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Termin" />
            <Toggle checked={visible} onChange={setVisible} label="Widoczne dla klienta" />
            <span className="spacer" />
            <button
              className="btn btn-primary btn-sm"
              disabled={!title.trim()}
              onClick={async () => {
                await run(
                  () => addTask({ client_id: client.id, case_id: c.id, title: title.trim(), note: note.trim() || null, due_date: due || null, assignee, visible, position: tasks.length }),
                  'Dodano zadanie',
                )
                setTitle('')
                setNote('')
                setDue('')
                setAdding(false)
              }}
            >
              Dodaj
            </button>
          </div>
        </div>
      )}

      {tasks.map((t) => {
        const canTick = !locked && (isAdmin || t.assignee === 'client')
        return (
          <div key={t.id} className={`st-item task${t.done_at ? ' done' : ''}${!t.visible ? ' hidden-task' : ''}`}>
            {canTick ? (
              <button className={`todo-check${t.done_at ? ' on' : ''}`} aria-label={t.done_at ? 'Oznacz jako niezrobione' : 'Potwierdź wykonanie'} onClick={() => run(() => toggleTask(t, isAdmin))}>
                {t.done_at ? '✓' : ''}
              </button>
            ) : (
              <span className={`todo-auto${t.done_at ? ' ok' : ''}`}>{t.done_at ? '✓' : '•'}</span>
            )}
            <span className="st-item-title">
              {t.title}
              {t.note && <span className="muted st-item-note">{t.note}</span>}
            </span>
            <span className={`badge ${t.assignee === 'client' ? 'sent' : 'draft'}`}>{t.assignee === 'client' ? (isAdmin ? 'Klient' : 'Twoje zadanie') : isAdmin ? 'Ja' : 'Po stronie NAFU Design'}</span>
            {isAdmin && !t.visible && <span className="badge draft">Ukryte przed klientem</span>}
            {t.due_date && <span className="muted" style={{ fontSize: 12.5 }}>do {fmtDay(t.due_date)}</span>}
            {t.done_at && <span className="muted" style={{ fontSize: 12.5 }}>potwierdzone {fmtDate(t.done_at)}</span>}
            {isAdmin && (
              <span className="st-item-tools">
                <button className="btn btn-ghost btn-sm" onClick={() => run(() => updateTask(t.id, { visible: !t.visible }))}>
                  {t.visible ? 'Ukryj' : 'Pokaż klientowi'}
                </button>
                <button className="btn btn-ghost btn-icon" aria-label="Odepnij od sprawy" title="Odepnij od sprawy" onClick={() => run(() => linkItem('client_tasks', t.id, null), 'Odpięto')}>
                  <Icon name="link" size={14} />
                </button>
                <button className="btn btn-ghost btn-icon btn-danger" aria-label="Usuń zadanie" onClick={() => confirm(`Usunąć zadanie „${t.title}”?`) && run(() => deleteTask(t.id))}>
                  <Icon name="trash" size={14} />
                </button>
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}

/* ---------- ankiety ---------- */

function BriefsBlock({ client, c, briefs, isAdmin, locked, run }: { client: Client; c: Case; briefs: Brief[]; isAdmin: boolean; locked: boolean; run: (fn: () => Promise<unknown>, msg?: string) => Promise<void> }) {
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState('')
  const shown = isAdmin ? briefs : briefs.filter((b) => b.status !== 'draft')
  if (!isAdmin && shown.length === 0) return null

  return (
    <section className="card case-sec">
      <SecHead title="Ankiety i pytania" hint={isAdmin ? 'Zadaj pytania w formie nowej ankiety albo podepnij istniejącą.' : 'Odpowiedz na pytania potrzebne w tej sprawie.'}>
        {isAdmin && !locked && (
          <button className="btn btn-sm" onClick={() => setNaming(!naming)}>
            <Icon name="plus" size={15} /> Nowe pytania
          </button>
        )}
        {isAdmin && !locked && (
          <LinkExisting
            label="Podepnij ankietę"
            load={async () => (await api.listBriefs(client.id)).filter((b) => !b.case_id).map((b) => ({ id: b.id, label: b.title }))}
            onPick={(id) => run(() => linkItem('briefs', id, c.id), 'Podpięto ankietę')}
          />
        )}
      </SecHead>

      {naming && (
        <div className="case-form">
          <Field label="Tytuł ankiety (widzi go klient)" value={title} onChange={setTitle} placeholder="np. Pytania do dokumentów prawnych" />
          <div className="row">
            <span className="muted" style={{ fontSize: 13.5 }}>Po utworzeniu otworzy się edytor pytań. Ankieta jest szkicem, dopóki jej nie wyślesz.</span>
            <span className="spacer" />
            <button
              className="btn btn-primary btn-sm"
              disabled={!title.trim()}
              onClick={async () => {
                try {
                  const b = await addCaseBrief(client.id, c.id, title.trim())
                  window.location.assign(`/panel/ankieta/${b.id}/edycja`)
                } catch (e) {
                  await run(() => Promise.reject(e))
                }
              }}
            >
              Utwórz i dodaj pytania
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 && <p className="muted" style={{ margin: 0 }}>Brak ankiet w tej sprawie.</p>}
      {shown.map((b) => (
        <div className="brief-row" key={b.id}>
          <div className="brief-icon" style={{ background: 'linear-gradient(135deg,#0a7189,#02afca)' }}>
            <Icon name="edit" size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3>{b.title}</h3>
            <div className="meta">
              <StatusBadge status={b.status} />
              {b.submitted_at && <span>wysłana {fmtDate(b.submitted_at)}</span>}
            </div>
          </div>
          <div className="actions">
            {isAdmin ? (
              <>
                {b.status === 'draft' && (
                  <>
                    <Link className="btn btn-sm" to={`/panel/ankieta/${b.id}/edycja`}>
                      <Icon name="edit" size={15} /> Pytania
                    </Link>
                    {!locked && (
                      <button className="btn btn-sm btn-primary" onClick={() => run(() => api.updateBrief(b.id, { status: 'sent' }), 'Ankieta jest widoczna dla klienta')}>
                        Wyślij klientowi
                      </button>
                    )}
                  </>
                )}
                {b.status !== 'draft' && (
                  <Link className="btn btn-sm" to={`/panel/ankieta/${b.id}`}>
                    <Icon name="eye" size={15} /> Odpowiedzi
                  </Link>
                )}
                <button className="btn btn-ghost btn-icon" aria-label="Odepnij od sprawy" title="Odepnij od sprawy" onClick={() => run(() => linkItem('briefs', b.id, null), 'Odpięto')}>
                  <Icon name="link" size={14} />
                </button>
              </>
            ) : (
              <Link className={`btn btn-sm${b.status === 'submitted' ? '' : ' btn-primary'}`} to={`/${client.slug}/${b.slug}`}>
                {b.status === 'submitted' ? 'Zobacz odpowiedzi' : b.status === 'in_progress' ? 'Dokończ' : 'Wypełnij'}
              </Link>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

/* ---------- rozmowa ---------- */

function CaseChat({ c, isAdmin }: { c: Case; isAdmin: boolean }) {
  const toast = useToast()
  const [list, setList] = useState<CaseMessage[] | null>(null)
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setList(await listCaseMessages(c.id))
    markCaseRead(c.id).catch(() => {})
  }, [c.id])
  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
    const t = window.setInterval(() => load().catch(() => {}), 20000)
    return () => clearInterval(t)
  }, [load, toast])

  const send = async () => {
    if (!body.trim() && !file) return
    setBusy(true)
    try {
      await sendCaseMessage(c, body.trim() || (file ? `Plik: ${file.name}` : ''), isAdmin, file ?? undefined)
      setBody('')
      setFile(null)
      await load()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const openFile = async (path: string | null, url: string | null) => {
    if (url) return window.open(url, '_blank', 'noopener')
    if (!path) return
    const u = (await signedUrls([path]))[path]
    if (u) window.open(u, '_blank', 'noopener')
  }

  return (
    <section className="card case-sec">
      <SecHead title="Rozmowa w sprawie" hint="Pytania, komentarze i potwierdzenia dotyczące tylko tej sprawy." />
      {!list ? (
        <Spinner />
      ) : (
        <div className="chat case-chat">
          <div className="chat-list">
            {list.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 16 }}>Brak wiadomości w tej sprawie.</p>}
            {list.map((m) => {
              const mine = m.from_admin === isAdmin
              return (
                <div key={m.id} className={`msg${mine ? ' mine' : ''}`}>
                  <div className="msg-bubble">
                    {editId === m.id ? (
                      <div className="stack">
                        <textarea className="textarea" value={editText} onChange={(e) => setEditText(e.target.value)} />
                        <div className="row">
                          <button className="btn btn-sm" onClick={() => setEditId(null)}>
                            Anuluj
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={!editText.trim()}
                            onClick={async () => {
                              try {
                                await editCaseMessage(m.id, editText.trim())
                                setEditId(null)
                                await load()
                              } catch (e) {
                                toast((e as Error).message)
                              }
                            }}
                          >
                            Zapisz
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="msg-body">{m.body}</div>
                    )}
                    {m.file && (
                      <button className="msg-file" onClick={() => openFile(m.file!.path, m.file!.url)}>
                        <Icon name="doc" size={15} /> {m.file.name}
                      </button>
                    )}
                  </div>
                  <div className="msg-meta">
                    {m.from_admin ? 'Natalia, NAFU Design' : 'Klient'} · {fmtDate(m.created_at)}
                    {m.edited_at && ' · edytowana'}
                    {mine && m.read_at && ' · przeczytane'}
                    {mine && editId !== m.id && (
                      <>
                        {' · '}
                        <button className="link-btn" onClick={() => { setEditId(m.id); setEditText(m.body) }}>
                          edytuj
                        </button>
                        {' · '}
                        <button
                          className="link-btn"
                          onClick={async () => {
                            if (!confirm('Usunąć wiadomość?')) return
                            try {
                              await deleteCaseMessage(m.id)
                              await load()
                            } catch (e) {
                              toast((e as Error).message)
                            }
                          }}
                        >
                          usuń
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="chat-input">
            <textarea
              className="textarea"
              placeholder="Napisz w tej sprawie…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
              }}
            />
            <div className="row">
              <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
                <Icon name="plus" size={15} /> {file ? file.name : 'Załącz plik'}
              </button>
              {file && (
                <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>
                  Usuń załącznik
                </button>
              )}
              <span className="spacer" />
              <button className="btn btn-primary" onClick={send} disabled={busy || (!body.trim() && !file)}>
                {busy ? 'Wysyłam…' : 'Wyślij'}
              </button>
            </div>
            <input ref={fileInput} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------- akceptacja i zamknięcie ---------- */

function Closing({ c, isAdmin, run }: { c: Case; isAdmin: boolean; run: (fn: () => Promise<unknown>, msg?: string) => Promise<void> }) {
  const [summary, setSummary] = useState(c.summary ?? '')
  useEffect(() => setSummary(c.summary ?? ''), [c.summary])
  const accepted = c.accepted_at ? `Klient zaakceptował ${fmtDate(c.accepted_at)}.` : ''

  return (
    <section className={`card case-sec case-close case-${c.status}`}>
      <SecHead title={c.status === 'closed' ? 'Podsumowanie' : 'Akceptacja i zamknięcie'} />

      {/* klient: akceptacja */}
      {!isAdmin && c.status === 'open' && <p className="muted" style={{ margin: 0 }}>Gdy wszystko będzie gotowe, poproszę Cię tutaj o akceptację.</p>}
      {!isAdmin && c.status === 'review' && (
        <>
          <p style={{ margin: 0 }}>Sprawdź, proszę, wszystko w tej sprawie i zaakceptuj albo napisz, co poprawić.</p>
          <div className="row">
            <button
              className="btn btn-sm"
              onClick={() => {
                const reason = prompt('Co trzeba poprawić przed akceptacją?')
                if (reason !== null) run(() => returnCase(c.id, reason), 'Przekazano uwagi')
              }}
            >
              Zgłaszam poprawki
            </button>
            <span className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={() => confirm('Akceptujesz wszystko w tej sprawie?') && run(() => acceptCase(c.id), 'Dziękuję, sprawa zaakceptowana')}>
              ✓ Akceptuję
            </button>
          </div>
        </>
      )}
      {!isAdmin && c.status === 'accepted' && <p className="muted" style={{ margin: 0 }}>{accepted} Zamknę sprawę i dodam podsumowanie.</p>}

      {/* administratorka: prośba o akceptację, podsumowanie, zamknięcie */}
      {isAdmin && c.status !== 'closed' && (
        <>
          <div className="row">
            {c.status === 'open' && (
              <button className="btn btn-sm" onClick={() => run(() => requestAcceptance(c.id), 'Poproszono klienta o akceptację')}>
                Poproś klienta o akceptację
              </button>
            )}
            {c.status === 'review' && (
              <>
                <span className="muted" style={{ fontSize: 14 }}>Czeka na akceptację klienta.</span>
                <button className="btn btn-ghost btn-sm" onClick={() => run(() => returnCase(c.id, ''), 'Cofnięto prośbę o akceptację')}>
                  Cofnij prośbę
                </button>
              </>
            )}
            {c.status === 'accepted' && <span className="badge sent">{accepted}</span>}
          </div>
          <Field label="Podsumowanie dla klienta (pojawi się po zamknięciu sprawy)" value={summary} onChange={setSummary} textarea />
          <div className="row">
            <span className="spacer" />
            <button
              className="btn btn-primary btn-sm"
              disabled={!summary.trim()}
              onClick={() =>
                (c.status === 'accepted' || confirm('Klient nie zaakceptował jeszcze sprawy. Zamknąć mimo to?')) &&
                run(() => closeCase(c.id, summary.trim()), 'Sprawa zamknięta')
              }
            >
              Zamknij sprawę
            </button>
          </div>
        </>
      )}

      {c.status === 'closed' && (
        <>
          {c.summary && <div className="case-summary">{c.summary}</div>}
          <div className="row">
            <span className="muted" style={{ fontSize: 14 }}>
              {accepted} Zamknięta {fmtDate(c.closed_at)}.
            </span>
            <span className="spacer" />
            {isAdmin && (
              <button className="btn btn-sm" onClick={() => run(() => reopenCase(c.id), 'Sprawa otwarta ponownie')}>
                Otwórz ponownie
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function InviteCase({ c, client, onClose, onSend }: { c: Case; client: Client; onClose: () => void; onSend: (note: string, test: boolean) => Promise<void> }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const to = client.login_email || client.email
  return (
    <Modal label="Powiadomienie o sprawie" onClose={onClose}>
      <div className="eyebrow">Sprawy bieżące</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Prośba o dołączenie do sprawy</h2>
      <div className="stack">
        <p style={{ margin: 0 }}>
          Do: <strong>{to || 'brak adresu e-mail klienta'}</strong>
          <br />
          Temat: <strong>{client.address_form === 'ty' ? `${client.salutation ? `${client.salutation}, n` : 'N'}owa sprawa w panelu: ${c.title}` : `Sprawa wymagająca ${client.address_form === 'pani' ? 'Pani' : client.address_form === 'pan' ? 'Pana' : 'Państwa'} udziału: ${c.title}`}</strong>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          W e-mailu będzie temat, opis{c.due_date ? ', termin' : ''} i przycisk „Otwórz sprawę” prowadzący prosto do niej w strefie klienta.
          {!client.user_id && ' Klient nie ma jeszcze konta w panelu: najpierw załóż je w zakładce Ankiety i dostęp.'}
        </p>
        <Field label="Dodatkowa wiadomość (opcjonalnie)" value={note} onChange={setNote} textarea placeholder="np. Proszę o akceptację dokumentów do piątku." />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn"
          disabled={busy || !to}
          onClick={async () => {
            setBusy(true)
            try {
              await onSend(note.trim(), true)
            } catch (e) {
              toast((e as Error).message)
            }
            setBusy(false)
          }}
        >
          Wyślij test do mnie
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || !to}
          onClick={async () => {
            setBusy(true)
            try {
              await onSend(note.trim(), false)
            } catch (e) {
              toast((e as Error).message)
              setBusy(false)
            }
          }}
        >
          {busy ? 'Wysyłam…' : 'Wyślij'}
        </button>
      </div>
    </Modal>
  )
}

function EditCase({ c, isAdmin, onClose, onSave }: { c: Case; isAdmin: boolean; onClose: () => void; onSave: (patch: Partial<Case>) => Promise<void> }) {
  const [title, setTitle] = useState(c.title)
  const [description, setDescription] = useState(c.description ?? '')
  const [due, setDue] = useState(c.due_date ?? '')
  const [priority, setPriority] = useState<CasePriority>(c.priority)
  return (
    <Modal label="Edytuj sprawę" onClose={onClose}>
      <div className="eyebrow">Sprawy bieżące</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Edytuj sprawę</h2>
      <div className="stack">
        <Field label="Temat" value={title} onChange={setTitle} />
        <Field label="Opis" value={description} onChange={setDescription} textarea />
        <PriorityPick value={priority} onChange={setPriority} />
        {isAdmin && <Field label="Termin" type="date" value={due} onChange={setDue} />}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          disabled={!title.trim()}
          onClick={() => onSave({ title: title.trim(), description: description.trim() || null, priority, ...(isAdmin ? { due_date: due || null } : {}) })}
        >
          Zapisz
        </button>
      </div>
    </Modal>
  )
}

function PriorityPick({ value, onChange }: { value: CasePriority; onChange: (v: CasePriority) => void }) {
  return (
    <div className="field">
      <span className="label">Kategoria</span>
      <div className="seg" role="radiogroup" aria-label="Kategoria pilności">
        {(Object.keys(PRIORITY_LABEL) as CasePriority[]).map((k) => (
          <button type="button" key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
            {PRIORITY_LABEL[k]}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- wybór sekcji sprawy ---------- */

function SectionsPicker({ c, run }: { c: Case; run: (fn: () => Promise<unknown>, msg?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const active = c.sections ?? []
  const toggle = (k: CaseSection) => {
    const next = active.includes(k) ? active.filter((x) => x !== k) : [...active, k]
    run(() => updateCase(c.id, { sections: SECTIONS.map((s) => s.key).filter((x) => next.includes(x)) }))
  }
  return (
    <div className={`case-sections${open ? ' is-open' : ''}`}>
      <button className="case-sections-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <strong>Sekcje w tej sprawie</strong>
          <span className="muted"> · {SECTIONS.filter((s) => active.includes(s.key)).map((s) => s.label).join(', ') || 'brak'}</span>
        </span>
        <Icon name={open ? 'up' : 'down'} size={16} />
      </button>
      {open && (
        <div className="case-sections-list">
          {SECTIONS.map((s) => (
            <label key={s.key} className="case-sections-item">
              <input type="checkbox" checked={active.includes(s.key)} onChange={() => toggle(s.key)} />
              <span>
                <strong>{s.label}</strong>
                <span className="muted"> - {s.hint}</span>
              </span>
            </label>
          ))}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Klient widzi tylko włączone sekcje. Wyłączenie sekcji niczego nie usuwa.</p>
        </div>
      )}
    </div>
  )
}

/* ---------- zalecenia i porady ---------- */

function TipsBlock({ c, isAdmin, locked }: { c: Case; isAdmin: boolean; locked: boolean }) {
  const toast = useToast()
  const [tips, setTips] = useState<CaseTip[] | null>(null)
  const [editing, setEditing] = useState<Partial<CaseTip> | null>(null)
  const load = useCallback(async () => setTips(await listTips(c.id)), [c.id])
  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])
  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn()
      if (msg) toast(msg)
    } catch (e) {
      toast((e as Error).message)
    }
    await load()
  }
  if (!tips) return null
  if (!isAdmin && tips.length === 0) return null
  return (
    <section className="card case-sec">
      <SecHead title="Zalecenia i porady" hint={isAdmin ? 'Co klient powinien zrobić albo wiedzieć. Klient odhacza, co już zrobił.' : 'Moje zalecenia w tej sprawie. Odhacz, co już zrobione.'}>
        {isAdmin && !locked && (
          <button className="btn btn-sm" onClick={() => setEditing({ title: '', body: '' })}>
            <Icon name="plus" size={15} /> Zalecenie
          </button>
        )}
      </SecHead>
      {tips.length === 0 && <p className="muted" style={{ margin: 0 }}>Brak zaleceń w tej sprawie.</p>}
      {tips.map((t, i) => (
        <div key={t.id} className={`case-tip${t.done_at ? ' done' : ''}`}>
          <button className={`todo-check${t.done_at ? ' on' : ''}`} disabled={locked} aria-label={t.done_at ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'} onClick={() => act(() => toggleTip(t.id))}>
            {t.done_at ? '✓' : ''}
          </button>
          <div style={{ minWidth: 0 }}>
            <strong>
              {i + 1}. {t.title}
            </strong>
            {t.body && <p className="case-tip-body">{t.body}</p>}
            {t.done_at && <span className="muted" style={{ fontSize: 12.5 }}>zrobione {fmtDate(t.done_at)}</span>}
          </div>
          {isAdmin && (
            <span className="st-item-tools">
              <button className="btn btn-ghost btn-icon" aria-label="Edytuj zalecenie" onClick={() => setEditing(t)}>
                <Icon name="edit" size={14} />
              </button>
              <button className="btn btn-ghost btn-icon btn-danger" aria-label="Usuń zalecenie" onClick={() => confirm(`Usunąć zalecenie „${t.title}”?`) && act(() => deleteTip(t.id))}>
                <Icon name="trash" size={14} />
              </button>
            </span>
          )}
        </div>
      ))}
      {editing && (
        <Modal label="Zalecenie" onClose={() => setEditing(null)}>
          <div className="eyebrow">Zalecenia i porady</div>
          <h2 style={{ marginTop: 8, marginBottom: 14 }}>{editing.id ? 'Edytuj zalecenie' : 'Nowe zalecenie'}</h2>
          <div className="stack">
            <Field label="Zalecenie" value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} placeholder="np. Zmień hasło do WordPressa po przekazaniu dostępu" />
            <Field label="Szczegóły (opcjonalnie)" value={editing.body} onChange={(v) => setEditing({ ...editing, body: v })} textarea />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(null)}>
              Anuluj
            </button>
            <button
              className="btn btn-primary"
              disabled={!editing.title?.trim()}
              onClick={async () => {
                await act(
                  () => saveTip({ id: editing.id, case_id: c.id, client_id: c.client_id, title: editing.title!.trim(), body: editing.body?.trim() || null, ...(editing.id ? {} : { position: tips.length }) }),
                  'Zapisano',
                )
                setEditing(null)
              }}
            >
              Zapisz
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

/* ---------- zdjęcia, wideo i linki ---------- */

function MediaBlock({ c, isAdmin, locked }: { c: Case; isAdmin: boolean; locked: boolean }) {
  const toast = useToast()
  const [files, setFiles] = useState<ClientFile[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const list = await listCaseMedia(c.id)
    setFiles(list)
    setUrls(await signedUrls(list.map((f) => f.path ?? '').filter(Boolean)))
  }, [c.id])
  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(list)) await addCaseFile(c, f)
      toast(list.length > 1 ? `Dodano ${list.length} pliki` : 'Dodano plik')
      await load()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  if (!files) return null
  return (
    <section className="card case-sec">
      <SecHead title="Zdjęcia, wideo i linki" hint={isAdmin ? 'Materiały wizualne i linki istotne dla tej sprawy. Klient też może dodawać.' : 'Dodaj zdjęcia, nagrania albo linki, które pomogą w tej sprawie.'}>
        {!locked && (
          <>
            <button className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}>
              <Icon name="plus" size={15} /> {busy ? 'Wysyłam…' : 'Zdjęcie lub wideo'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setLinking(!linking)}>
              <Icon name="link" size={15} /> Link
            </button>
          </>
        )}
      </SecHead>
      <input ref={input} type="file" hidden multiple accept="image/*,video/*" onChange={(e) => upload(e.target.files)} />

      {linking && (
        <div className="case-form">
          <Field label="Nazwa" value={linkName} onChange={setLinkName} placeholder="np. Nagranie z salonu (Dysk Google)" />
          <Field label="Adres" value={linkUrl} onChange={setLinkUrl} placeholder="https://" />
          <div className="row">
            <span className="spacer" />
            <button
              className="btn btn-primary btn-sm"
              disabled={!linkName.trim() || !/^https?:\/\//.test(linkUrl.trim())}
              onClick={async () => {
                try {
                  await addCaseLink(c, linkName.trim(), linkUrl.trim())
                  setLinkName('')
                  setLinkUrl('')
                  setLinking(false)
                  await load()
                } catch (e) {
                  toast((e as Error).message)
                }
              }}
            >
              Dodaj link
            </button>
          </div>
        </div>
      )}

      {files.length === 0 && !linking && <p className="muted" style={{ margin: 0 }}>Brak materiałów w tej sprawie.</p>}
      <div className="case-media">
        {files.map((f) => {
          const src = f.path ? urls[f.path] : null
          const isImg = f.mime?.startsWith('image/')
          const isVid = f.mime?.startsWith('video/')
          return (
            <figure key={f.id} className="case-media-item">
              {f.url ? (
                <a className="case-media-link" href={f.url} target="_blank" rel="noopener">
                  <Icon name="link" size={22} />
                  <span>{f.name}</span>
                </a>
              ) : isImg && src ? (
                <a href={src} target="_blank" rel="noopener">
                  <img src={src} alt={f.name} loading="lazy" />
                </a>
              ) : isVid && src ? (
                <video src={src} controls preload="metadata" />
              ) : (
                <a className="case-media-link" href={src ?? '#'} target="_blank" rel="noopener">
                  <Icon name="doc" size={22} />
                  <span>{f.name}</span>
                </a>
              )}
              <figcaption>
                <span title={f.name}>{f.name}</span>
                <span className="muted">{f.size ? fmtSize(f.size) : ''}</span>
                {(isAdmin || !locked) && (
                  <button
                    className="link-btn"
                    onClick={async () => {
                      if (!confirm(`Usunąć „${f.name}”?`)) return
                      try {
                        await deleteFile(f)
                        await load()
                      } catch (e) {
                        toast((e as Error).message)
                      }
                    }}
                  >
                    usuń
                  </button>
                )}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </section>
  )
}
