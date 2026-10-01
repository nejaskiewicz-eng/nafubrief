import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon, Modal, Spinner, StatusBadge, fmtDate, useToast } from '../components/ui'
import { api } from '../lib/api'
import { renderMarkdown } from '../lib/markdown'
import {
  CASE_BADGE, CASE_STATUS, CASE_TYPES, PRIORITY_LABEL, SECTIONS, caseType, caseTypeLabel, acceptCase, addCaseFile, addCaseLink, deleteTip, listCaseMedia, listTips, saveTip, toggleTip, addCaseBrief, caseUnread, inviteToCase, closeCase, createCase, deleteCase, deleteCaseMessage, editCaseMessage,
  linkItem, listCaseItems, listCaseMessages, listCases, markCaseRead, reopenCase, requestAcceptance, returnCase, sendCaseMessage, updateCase,
  type Case, type CaseItems, type CaseMessage, type CasePriority, type CaseSection, type CaseTip,
} from '../lib/cases'
import { addTask, deleteTask, listAccess, listDocuments, listTasks, toggleTask, updateDocument, updateTask, type ClientDocument, type Task } from '../lib/project'
import type { Brief, Client } from '../lib/types'
import { deleteFile, fmtSize, signedUrls, updateFile, type ClientFile } from '../lib/workspace'
import Access from './Access'
import { Empty, Field, Toggle } from './bits'
import Documents, { DocReader } from './Documents'

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

  const rank: Record<CasePriority, number> = { very_urgent: 0, urgent: 1, important: 2, normal: 3 }
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
          onSave={async (title, description, due, priority, type, typeLabel) => {
            const tpl = caseType(type)
            const c = await createCase({
              client_id: client.id, title, description: description || null, due_date: due || null, priority, created_by: isAdmin ? 'admin' : 'client',
              type, type_label: type === 'other' ? typeLabel || null : null, ...(tpl ? { sections: tpl.sections } : {}),
            })
            // szablon rodzaju sprawy: zadania startowe jako ukryte szkice (tylko gdy sprawę zakłada administratorka)
            if (isAdmin && tpl?.tasks?.length) {
              for (const [i, t] of tpl.tasks.entries()) await addTask({ client_id: client.id, case_id: c.id, title: t.title, note: t.note, assignee: t.assignee, visible: false, position: i })
            }
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
              {caseTypeLabel(c) && <span className="badge case-type">{caseTypeLabel(c)}</span>}
              <span className={`badge ${CASE_BADGE[c.status]}`}>{CASE_STATUS[c.status]}</span>
              {c.priority !== 'normal' && c.status !== 'closed' && <span className={`badge ${c.priority === 'important' ? 'important' : 'urgent'}`}>{PRIORITY_LABEL[c.priority]}</span>}
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

function NewCase({ isAdmin, onClose, onSave }: { isAdmin: boolean; onClose: () => void; onSave: (title: string, description: string, due: string, priority: CasePriority, type: string, typeLabel: string) => Promise<void> }) {
  const toast = useToast()
  const [type, setType] = useState('current')
  const [typeLabel, setTypeLabel] = useState('')
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
        <TypePick value={type} onChange={setType} label={typeLabel} onLabel={setTypeLabel} showSections={isAdmin} />
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
            if (type === 'other' && !typeLabel.trim()) return toast('Wpisz rodzaj sprawy.')
            setBusy(true)
            try {
              await onSave(title.trim(), description.trim(), due, priority, type, typeLabel.trim())
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
  const [inviting, setInviting] = useState<{ note: string; reminder: boolean } | null>(null)
  // przewodnik: przejście do sekcji i dokument otwarty z zadania
  const [jump, setJump] = useState<{ k: CaseSection; n: number } | null>(null)
  const [reader, setReader] = useState<{ doc: ClientDocument; task?: Task } | null>(null)
  // opis sprawy edytowany w miejscu, w dużym polu (wprowadzenie do sprawy bywa długie)
  const [descDraft, setDescDraft] = useState<string | null>(null)
  const canEditCase = isAdmin || (c.created_by === 'client' && c.status === 'open')
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

  // dokument otwierany prosto z zadania albo z przewodnika
  const openDoc = async (doc: ClientDocument, task?: Task) => {
    if (doc.content) return setReader({ doc, task })
    const p = doc.file?.path
    if (!p) return
    const u = (await signedUrls([p]))[p]
    if (u) window.open(u, '_blank', 'noopener')
  }
  const go = (k: CaseSection) => setJump({ k, n: Date.now() })
  const guide = items ? buildGuide({ c, client, items, isAdmin, go, openDoc }) : []

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
          <button className="btn btn-primary btn-sm" onClick={() => setInviting({ note: '', reminder: false })}>
            <Icon name="mail" size={15} /> {c.invited_at ? 'Wyślij ponownie' : 'Wyślij powiadomienie e-mail'}
          </button>
        </div>
      )}

      <section className="card case-head">
        <div className="meta">
          {caseTypeLabel(c) && <span className="badge case-type">{caseTypeLabel(c)}</span>}
          <span className={`badge ${CASE_BADGE[c.status]}`}>{CASE_STATUS[c.status]}</span>
          {c.priority !== 'normal' && <span className={`badge ${c.priority === 'important' ? 'important' : 'urgent'}`}>{PRIORITY_LABEL[c.priority]}</span>}
          {c.created_by === 'client' && <span className="badge draft">{isAdmin ? 'Założona przez klienta' : 'Założona przez Ciebie'}</span>}
          {c.due_date && <span>termin {fmtDay(c.due_date)}</span>}
          <span>założona {fmtDate(c.created_at)}</span>
        </div>
        <h2>{c.title}</h2>
        {descDraft !== null ? (
          <div className="case-desc-edit">
            <textarea className="textarea" value={descDraft} onChange={(e) => setDescDraft(e.target.value)} autoFocus />
            <div className="row">
              <span className="muted" style={{ fontSize: 13 }}>Formatowanie: ## nagłówek, **pogrubienie**, lista od myślnika. Pusty wiersz zaczyna nowy akapit.</span>
              <span className="spacer" />
              <button className="btn btn-sm" onClick={() => setDescDraft(null)}>
                Anuluj
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={async () => {
                  await run(() => updateCase(c.id, { description: descDraft.trim() || null }), 'Zapisano opis')
                  setDescDraft(null)
                }}
              >
                Zapisz
              </button>
            </div>
          </div>
        ) : (
          <>
            {c.description && <div className="case-desc md" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.description, { breaks: true }) }} />}
            {canEditCase && !locked && (
              <button className="btn btn-ghost btn-sm case-desc-btn" onClick={() => setDescDraft(c.description ?? '')}>
                <Icon name="edit" size={14} /> {c.description ? 'Edytuj opis' : 'Dodaj opis'}
              </button>
            )}
          </>
        )}
      </section>

      {!items ? (
        <Spinner />
      ) : (
        <>
          {!locked && (
            <Guide
              steps={guide}
              isAdmin={isAdmin}
              hidden={isAdmin ? items.tasks.filter((t) => t.assignee === 'client' && !t.visible).length + items.briefs.filter((b) => b.status === 'draft').length + items.documents.filter((d) => !d.visible).length : 0}
              onRemind={isAdmin && guide.some((s) => !s.done) ? () => setInviting({ reminder: true, note: `Do zrobienia w tej sprawie:\n${guide.filter((s) => !s.done).slice(0, 8).map((s) => `- ${s.label}`).join('\n')}` }) : undefined}
            />
          )}
          {(c.sections ?? []).map((k) => {
            const el: Record<CaseSection, ReactNode> = {
              tasks: (
                <TasksBlock client={client} c={c} tasks={items.tasks} documents={items.documents} onOpenDoc={openDoc} isAdmin={isAdmin} locked={locked} run={run} />
              ),
              tips: (
                <TipsBlock c={c} isAdmin={isAdmin} locked={locked} />
              ),
              briefs: (
                <BriefsBlock client={client} c={c} briefs={items.briefs} isAdmin={isAdmin} locked={locked} run={run} />
              ),
              contracts: (
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
              ),
              documents: (
                <section className="card case-sec">
                <SecHead title="Dokumenty" hint={isAdmin ? 'Dokumenty w tej sprawie z obu stron. Szkice są widoczne tylko dla Ciebie, dopóki ich nie udostępnisz. Klient też może dodawać.' : 'Dokumenty w tej sprawie: ode mnie i od Ciebie.'} />
                {isAdmin && !locked && (
                  <LinkExisting
                    label="Podepnij dokument"
                    load={async () => (await listDocuments(client.id)).filter((d) => !d.case_id).map((d) => ({ id: d.id, label: d.title }))}
                    onPick={(id) => run(() => linkItem('client_documents', id, c.id), 'Podpięto dokument')}
                  />
                )}
                <Documents client={client} isAdmin={isAdmin} caseId={c.id} only="other" locked={locked} key={`d-${items.documents.length}`} />
              </section>
              ),
              access: (
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
              ),
              media: (
                <MediaBlock c={c} isAdmin={isAdmin} locked={locked} />
              ),
              chat: (
                <CaseChat c={c} isAdmin={isAdmin} />
              ),
              closing: (
                <Closing c={c} isAdmin={isAdmin} run={run} />
              ),
            }
            return <CaseStep key={`${c.id}-${k}`} k={k} jump={jump}>{el[k]}</CaseStep>
          })}
        </>
      )}

      {inviting && (
        <InviteCase
          c={c}
          client={client}
          initialNote={inviting.note}
          reminder={inviting.reminder}
          onClose={() => setInviting(null)}
          onSend={async (note, test) => {
            const to = await inviteToCase(c.id, note, test, inviting.reminder)
            if (!test) setInviting(null)
            await run(async () => {}, test ? `Wysłano test na ${to}` : inviting.reminder ? `Wysłano przypomnienie na ${to}` : `Wysłano powiadomienie na ${to}`)
          }}
        />
      )}
      {reader && (
        <DocReader
          doc={reader.doc}
          isAdmin={isAdmin}
          onClose={() => setReader(null)}
          onSaved={async (content, title) => {
            await run(() => updateDocument(reader.doc.id, { content, title }), 'Zapisano zmiany')
            setReader({ ...reader, doc: { ...reader.doc, content, title } })
          }}
          onRead={
            !isAdmin && !locked && reader.task && !reader.task.done_at && reader.task.assignee === 'client'
              ? async () => {
                  const t = reader.task!
                  setReader(null)
                  await run(() => toggleTask(t, false), 'Zadanie odhaczone')
                }
              : undefined
          }
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

/** Sekcja sprawy jako krok: startuje zwinięta, numer kroku liczy CSS (tylko sekcje faktycznie pokazane) */
const StepCtx = createContext<{ open: boolean; toggle: () => void } | null>(null)

/* ---------- przewodnik: co teraz ---------- */

type GuideStep = { key: string; label: string; hint?: string; done: boolean; action?: { label: string; onClick?: () => void; to?: string } }

/** Lista rzeczy, które czekają na klienta w tej sprawie, w kolejności sekcji. Liczy się tylko to, co klient widzi. */
function buildGuide({ c, client, items, isAdmin, go, openDoc }: { c: Case; client: Client; items: CaseItems; isAdmin: boolean; go: (k: CaseSection) => void; openDoc: (d: ClientDocument, t?: Task) => void }): GuideStep[] {
  const steps: GuideStep[] = []
  for (const k of c.sections ?? []) {
    if (k === 'tasks') {
      for (const t of items.tasks.filter((x) => x.assignee === 'client' && x.visible)) {
        const doc = t.document_id ? items.documents.find((d) => d.id === t.document_id && d.visible) : undefined
        steps.push({
          key: `t-${t.id}`, label: t.title, hint: t.due_date ? `do ${fmtDay(t.due_date)}` : undefined, done: !!t.done_at,
          action: doc ? { label: doc.content ? 'Czytaj' : 'Otwórz', onClick: () => openDoc(doc, t) } : { label: 'Pokaż', onClick: () => go('tasks') },
        })
      }
    } else if (k === 'briefs') {
      for (const b of items.briefs.filter((x) => x.status !== 'draft')) {
        steps.push({
          key: `b-${b.id}`, label: `Ankieta: ${b.title}`, done: b.status === 'submitted',
          action: isAdmin ? { label: 'Pokaż', onClick: () => go('briefs') } : { label: b.status === 'in_progress' ? 'Dokończ' : 'Wypełnij', to: `/${client.slug}/${b.slug}` },
        })
      }
    } else if (k === 'contracts' || k === 'documents') {
      const list = items.documents.filter((d) => d.visible && d.requires_acceptance && d.from_admin !== false && (k === 'contracts' ? d.kind === 'contract' : d.kind !== 'contract'))
      for (const d of list) {
        steps.push({
          key: `d-${d.id}`, label: `${k === 'contracts' ? 'Umowa do akceptacji' : 'Dokument do akceptacji'}: ${d.title}`, done: !!d.accepted_at,
          action: { label: 'Pokaż', onClick: () => go(k) },
        })
      }
    } else if (k === 'access') {
      const list = items.access.filter((a) => a.status !== 'na')
      const todo = list.filter((a) => a.status === 'todo').length
      if (list.length) steps.push({ key: 'access', label: `Dostępy: przekazane ${list.length - todo} z ${list.length}`, done: todo === 0, action: { label: 'Pokaż', onClick: () => go('access') } })
    }
  }
  return steps
}

function GuideAction({ a, primary }: { a: NonNullable<GuideStep['action']>; primary?: boolean }) {
  const cls = `btn btn-sm${primary ? ' btn-primary' : ''}`
  return a.to ? (
    <Link className={cls} to={a.to}>
      {a.label}
    </Link>
  ) : (
    <button className={cls} onClick={a.onClick}>
      {a.label}
    </button>
  )
}

function Guide({ steps, isAdmin, hidden, onRemind }: { steps: GuideStep[]; isAdmin: boolean; hidden: number; onRemind?: () => void }) {
  if (steps.length === 0 && !(isAdmin && hidden > 0)) return null
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  return (
    <section className="card case-guide">
      <div className="case-guide-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{isAdmin ? 'Co czeka na klienta' : 'Co teraz'}</div>
          <h3>{steps.length === 0 ? 'Klient nie ma jeszcze nic do zrobienia' : next ? next.label : isAdmin ? 'Klient ma wszystko zrobione' : 'Wszystko zrobione. Dziękuję!'}</h3>
          {next?.hint && <p className="muted">{next.hint}</p>}
        </div>
        {!isAdmin && next?.action && <GuideAction a={next.action} primary />}
        {onRemind && (
          <button className="btn btn-sm" onClick={onRemind}>
            <Icon name="mail" size={15} /> Przypomnij e-mailem
          </button>
        )}
      </div>
      {steps.length > 0 && (
        <>
          <div className="case-guide-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
            <span style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
          </div>
          <ol className="case-guide-list">
            {steps.map((s) => (
              <li key={s.key} className={s.done ? 'done' : s === next ? 'next' : ''}>
                <span className="case-guide-dot">{s.done ? '✓' : ''}</span>
                <span className="case-guide-label">
                  {s.label}
                  {s.hint && !s.done && <span className="muted"> · {s.hint}</span>}
                </span>
                {!s.done && s.action && s !== next && <GuideAction a={s.action} />}
              </li>
            ))}
          </ol>
          <p className="muted case-guide-sum">Zrobione: {done} z {steps.length}</p>
        </>
      )}
      {isAdmin && hidden > 0 && <p className="muted case-guide-sum">Ukryte przed klientem: {hidden}. Szkice i ukryte zadania nie pojawiają się u klienta, dopóki ich nie pokażesz.</p>}
    </section>
  )
}

function CaseStep({ k, jump, children }: { k: CaseSection; jump: { k: CaseSection; n: number } | null; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // przejście z przewodnika: rozwiń sekcję i przewiń do niej
  useEffect(() => {
    if (jump?.k !== k) return
    setOpen(true)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [jump, k])
  return (
    <div ref={ref} className={`case-step${open ? ' open' : ''}`}>
      <StepCtx.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>{children}</StepCtx.Provider>
    </div>
  )
}

function SecHead({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  const step = useContext(StepCtx)
  return (
    <div className="case-sec-head">
      <div className={step ? 'case-step-title' : undefined} onClick={step?.toggle} role={step ? 'button' : undefined}>
        {step && <span className="case-step-no" />}
        <h3>{title}</h3>
        {hint && <p className="muted">{hint}</p>}
      </div>
      {children && <div className="row case-sec-tools">{children}</div>}
      {step && (
        <button className="btn btn-sm case-step-toggle" onClick={step.toggle} aria-expanded={step.open}>
          {step.open ? 'Zwiń' : 'Rozwiń'} <Icon name={step.open ? 'up' : 'down'} size={14} />
        </button>
      )}
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

function TasksBlock({ client, c, tasks, documents, onOpenDoc, isAdmin, locked, run }: { client: Client; c: Case; tasks: Task[]; documents: ClientDocument[]; onOpenDoc: (d: ClientDocument, t: Task) => void; isAdmin: boolean; locked: boolean; run: (fn: () => Promise<unknown>, msg?: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
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
        <TaskForm
          submitLabel="Dodaj"
          documents={documents}
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            await run(() => addTask({ client_id: client.id, case_id: c.id, ...v, position: tasks.length }), 'Dodano zadanie')
            setAdding(false)
          }}
        />
      )}

      {tasks.map((t) => {
        if (editing === t.id)
          return (
            <TaskForm
              key={t.id}
              initial={t}
              documents={documents}
              submitLabel="Zapisz"
              onCancel={() => setEditing(null)}
              onSave={async (v) => {
                await run(() => updateTask(t.id, v), 'Zapisano zadanie')
                setEditing(null)
              }}
            />
          )
        const canTick = !locked && (isAdmin || t.assignee === 'client')
        // dokument do przeczytania: klient widzi przycisk tylko wtedy, gdy dokument jest dla niego widoczny
        const doc = t.document_id ? documents.find((d) => d.id === t.document_id) : undefined
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
            {doc && (isAdmin || doc.visible) && (
              <button className={`btn btn-sm${t.done_at || isAdmin ? '' : ' btn-primary'}`} onClick={() => onOpenDoc(doc, t)}>
                <Icon name="eye" size={14} /> {doc.content ? 'Czytaj' : 'Otwórz'}
              </button>
            )}
            {isAdmin && doc && !doc.visible && <span className="badge draft">Dokument jest szkicem</span>}
            {isAdmin && !t.visible && <span className="badge draft">Ukryte przed klientem</span>}
            {t.due_date && <span className="muted" style={{ fontSize: 12.5 }}>do {fmtDay(t.due_date)}</span>}
            {t.done_at && <span className="muted" style={{ fontSize: 12.5 }}>potwierdzone {fmtDate(t.done_at)}</span>}
            {isAdmin && (
              <span className="st-item-tools">
                {!locked && (
                  <button className="btn btn-ghost btn-icon" aria-label="Edytuj zadanie" title="Edytuj" onClick={() => setEditing(t.id)}>
                    <Icon name="edit" size={14} />
                  </button>
                )}
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

type TaskValues = Pick<Task, 'title' | 'note' | 'due_date' | 'assignee' | 'visible' | 'document_id'>

/** Formularz zadania: dodawanie i edycja */
function TaskForm({ initial, submitLabel, documents, onSave, onCancel }: { initial?: Task; submitLabel: string; documents: ClientDocument[]; onSave: (v: TaskValues) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [due, setDue] = useState(initial?.due_date ?? '')
  const [assignee, setAssignee] = useState<'client' | 'nafu'>(initial?.assignee ?? 'client')
  const [visible, setVisible] = useState(initial?.visible ?? true)
  const [docId, setDocId] = useState(initial?.document_id ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <div className="case-form">
      <Field label="Zadanie" value={title} onChange={setTitle} placeholder="np. Sprawdzić personel w Rejestrze Sprawców i KRK" />
      <Field label="Opis (widzi klient, jeśli zadanie jest widoczne)" value={note} onChange={setNote} textarea />
      {documents.length > 0 && (
        <label className="field">
          <span className="label">Dokument do przeczytania (przy zadaniu pojawi się przycisk „Czytaj”)</span>
          <select className="select" value={docId} onChange={(e) => setDocId(e.target.value)}>
            <option value="">bez dokumentu</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}{d.visible ? '' : ' (szkic)'}
              </option>
            ))}
          </select>
        </label>
      )}
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
        <button className="btn btn-sm" onClick={onCancel}>
          Anuluj
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!title.trim() || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave({ title: title.trim(), note: note.trim() || null, due_date: due || null, assignee, visible, document_id: docId || null })
            } finally {
              setBusy(false)
            }
          }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
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

function InviteCase({ c, client, initialNote, reminder, onClose, onSend }: { c: Case; client: Client; initialNote?: string; reminder?: boolean; onClose: () => void; onSend: (note: string, test: boolean) => Promise<void> }) {
  const toast = useToast()
  const [note, setNote] = useState(initialNote ?? '')
  const [busy, setBusy] = useState(false)
  const to = client.login_email || client.email
  return (
    <Modal label="Powiadomienie o sprawie" onClose={onClose}>
      <div className="eyebrow">Sprawy bieżące</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>{reminder ? 'Przypomnienie o sprawie' : 'Prośba o dołączenie do sprawy'}</h2>
      <div className="stack">
        <p style={{ margin: 0 }}>
          Do: <strong>{to || 'brak adresu e-mail klienta'}</strong>
          <br />
          Temat: <strong>{reminder ? (client.address_form === 'ty' ? `${client.salutation ? `${client.salutation}, p` : 'P'}rzypomnienie o sprawie: ${c.title}` : `Przypomnienie o sprawie: ${c.title}`) : client.address_form === 'ty' ? `${client.salutation ? `${client.salutation}, n` : 'N'}owa sprawa w panelu: ${c.title}` : `Sprawa wymagająca ${client.address_form === 'pani' ? 'Pani' : client.address_form === 'pan' ? 'Pana' : 'Państwa'} udziału: ${c.title}`}</strong>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {reminder ? `W e-mailu będzie temat${c.due_date ? ', termin' : ''}, poniższa lista i przycisk „Otwórz sprawę”. Listę możesz zmienić.` : `W e-mailu będzie temat, pierwszy akapit opisu${c.due_date ? ', termin' : ''} i przycisk „Otwórz sprawę” prowadzący prosto do niej w strefie klienta.`}
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
  const [type, setType] = useState(c.type ?? '')
  const [typeLabel, setTypeLabel] = useState(c.type_label ?? '')
  return (
    <Modal label="Edytuj sprawę" onClose={onClose}>
      <div className="eyebrow">Sprawy bieżące</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Edytuj sprawę</h2>
      <div className="stack">
        <TypePick value={type} onChange={setType} label={typeLabel} onLabel={setTypeLabel} />
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
          onClick={() => onSave({ title: title.trim(), description: description.trim() || null, priority, type: type || null, type_label: type === 'other' ? typeLabel.trim() || null : null, ...(isAdmin ? { due_date: due || null } : {}) })}
        >
          Zapisz
        </button>
      </div>
    </Modal>
  )
}

/** Wybór rodzaju sprawy. Przy zakładaniu rodzaj ustawia sekcje startowe; w istniejącej sprawie zmienia tylko etykietę. */
function TypePick({ value, onChange, label, onLabel, showSections }: { value: string; onChange: (v: string) => void; label: string; onLabel: (v: string) => void; showSections?: boolean }) {
  const tpl = caseType(value)
  return (
    <div className="field">
      <span className="label">Rodzaj sprawy</span>
      <div className="case-types" role="radiogroup" aria-label="Rodzaj sprawy">
        {CASE_TYPES.map((t) => (
          <button key={t.key} type="button" role="radio" aria-checked={value === t.key} title={t.hint} className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {value === 'other' && <input className="input" style={{ marginTop: 8 }} value={label} onChange={(e) => onLabel(e.target.value)} placeholder="Wpisz rodzaj sprawy" aria-label="Własny rodzaj sprawy" />}
      {showSections && tpl && (
        <span className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Sekcje na start: {tpl.sections.map((k) => SECTIONS.find((s) => s.key === k)?.label).filter(Boolean).join(', ')}
          {tpl.tasks?.length ? `. Zadania-szkice: ${tpl.tasks.length}` : ''}. Wszystko zmienisz potem w sprawie.
        </span>
      )}
    </div>
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
  const [order, setOrder] = useState<CaseSection[]>(c.sections ?? [])
  const [drag, setDrag] = useState<CaseSection | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const startOrder = useRef<CaseSection[]>([])
  const liveOrder = useRef<CaseSection[]>([])
  useEffect(() => {
    if (!drag) setOrder(c.sections ?? [])
  }, [c.sections]) // eslint-disable-line react-hooks/exhaustive-deps
  const label = (k: CaseSection) => SECTIONS.find((s) => s.key === k)
  const off = SECTIONS.map((s) => s.key).filter((k) => !order.includes(k))
  const save = (next: CaseSection[]) => {
    setOrder(next)
    run(() => updateCase(c.id, { sections: next }))
  }
  const move = (k: CaseSection, to: number) => {
    const rest = order.filter((x) => x !== k)
    rest.splice(Math.max(0, Math.min(to, rest.length)), 0, k)
    save(rest)
  }

  // Przeciąganie na zdarzeniach wskaźnika: działa tak samo myszą, gładzikiem i palcem.
  const onPointerDown = (e: { button: number; target: EventTarget; preventDefault(): void }, k: CaseSection) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('input, button, a, label')) return
    e.preventDefault()
    startOrder.current = order
    liveOrder.current = order
    setDrag(k)
    const onMove = (ev: PointerEvent) => {
      const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-sec]') ?? [])
      setOrder((cur) => {
        const others = cur.filter((x) => x !== k)
        let idx = others.length
        for (let i = 0; i < others.length; i++) {
          const row = rows.find((r) => r.dataset.sec === others[i])
          if (!row) continue
          const box = row.getBoundingClientRect()
          if (ev.clientY < box.top + box.height / 2) {
            idx = i
            break
          }
        }
        const next = [...others]
        next.splice(idx, 0, k)
        if (next.join() === cur.join()) return cur
        liveOrder.current = next
        return next
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.classList.remove('is-sorting')
      setDrag(null)
      const final = liveOrder.current
      if (final.join() !== startOrder.current.join()) run(() => updateCase(c.id, { sections: final }))
    }
    document.body.classList.add('is-sorting')
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className={`case-sections${open ? ' is-open' : ''}`}>
      <button className="case-sections-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <strong>Sekcje w tej sprawie</strong>
          <span className="muted"> · {order.map((k) => label(k)?.label).join(', ') || 'brak'}</span>
        </span>
        <Icon name={open ? 'up' : 'down'} size={16} />
      </button>
      {open && (
        <div className="case-sections-list" ref={listRef}>
          <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>Złap wiersz i przeciągnij, żeby zmienić kolejność. Klient widzi tylko włączone sekcje, w tej samej kolejności.</p>
          {order.map((k, i) => (
            <div
              key={k}
              data-sec={k}
              className={`case-sections-item draggable${drag === k ? ' dragging' : ''}`}
              onPointerDown={(e) => onPointerDown(e, k)}
            >
              <span className="drag-handle" aria-hidden>⋮⋮</span>
              <input type="checkbox" checked onChange={() => save(order.filter((x) => x !== k))} aria-label={`Wyłącz sekcję ${label(k)?.label}`} />
              <span style={{ flex: 1 }}>
                <strong>{label(k)?.label}</strong>
                <span className="muted"> - {label(k)?.hint}</span>
              </span>
              <button className="btn btn-ghost btn-icon" aria-label="Wyżej" disabled={i === 0} onClick={() => move(k, i - 1)}>
                <Icon name="up" size={14} />
              </button>
              <button className="btn btn-ghost btn-icon" aria-label="Niżej" disabled={i === order.length - 1} onClick={() => move(k, i + 1)}>
                <Icon name="down" size={14} />
              </button>
            </div>
          ))}
          {off.length > 0 && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Wyłączone</div>}
          {off.map((k) => (
            <label key={k} className="case-sections-item off">
              <span className="drag-handle" aria-hidden />
              <input type="checkbox" checked={false} onChange={() => save([...order, k])} />
              <span>
                <strong>{label(k)?.label}</strong>
                <span className="muted"> - {label(k)?.hint}</span>
              </span>
            </label>
          ))}
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
  const [editing, setEditing] = useState<{ id: string; name: string; note: string } | null>(null)
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
      {[
        { key: 'studio', title: isAdmin ? 'Dodane przeze mnie' : 'Od Natalii', list: files.filter((f) => f.from_admin !== false) },
        { key: 'client', title: isAdmin ? 'Dodane przez klienta' : 'Dodane przez Ciebie', list: files.filter((f) => f.from_admin === false) },
      ].filter((g) => g.list.length > 0).map((g) => (
      <div key={g.key} className="doc-group">
      <div className={`doc-group-title ${g.key}`}>
        {g.title} <span className="muted">({g.list.length})</span>
      </div>
      <div className="case-media">
        {g.list.map((f) => {
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
              {editing?.id === f.id ? (
                <figcaption>
                  <Field label="Nagłówek" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
                  <Field label="Opis" value={editing.note} onChange={(v) => setEditing({ ...editing, note: v })} textarea />
                  <div className="case-media-meta">
                    <span />
                    <button className="link-btn" onClick={() => setEditing(null)}>
                      anuluj
                    </button>
                    <button
                      className="link-btn"
                      disabled={!editing.name.trim()}
                      onClick={async () => {
                        try {
                          await updateFile(f.id, { name: editing.name.trim(), note: editing.note.trim() || null })
                          setEditing(null)
                          await load()
                        } catch (e) {
                          toast((e as Error).message)
                        }
                      }}
                    >
                      zapisz
                    </button>
                  </div>
                </figcaption>
              ) : (
              <figcaption>
                <strong className="case-media-title">{f.name}</strong>
                {f.note && <p className="case-media-note">{f.note}</p>}
                <div className="case-media-meta">
                  <span className="muted">{f.size ? fmtSize(f.size) : ''}</span>
                  {(isAdmin || (!locked && f.from_admin === false)) && (
                    <>
                      <button className="link-btn" onClick={() => setEditing({ id: f.id, name: f.name, note: f.note ?? '' })}>
                        opisz
                      </button>
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
                    </>
                  )}
                </div>
              </figcaption>
              )}
            </figure>
          )
        })}
      </div>
      </div>
      ))}
    </section>
  )
}
