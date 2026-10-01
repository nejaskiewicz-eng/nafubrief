import { useCallback, useEffect, useState } from 'react'
import { Icon, Modal, Spinner, copyText, useToast } from '../components/ui'
import {
  ACCESS_CATALOG, ADMIN_EMAIL, addAccess, addAccessFromCatalog, clearCredentials, deleteAccess, getCredentials, listAccess, listSteps,
  setCredentials, updateAccess, type AccessItem, type AccessKind, type AccessStatus, type Credentials, type Step,
} from '../lib/project'
import { Field, Toggle } from './bits'

const STATUS_LABEL: Record<AccessStatus, string> = { todo: 'Do przekazania', done: 'Przekazane', na: 'Nie dotyczy' }
const STATUS_BADGE: Record<AccessStatus, string> = { todo: 'in_progress', done: 'submitted', na: 'draft' }

export default function Access({
  clientId, isAdmin, caseId, onChanged,
}: {
  clientId: string
  isAdmin: boolean
  /** tylko dostępy tej sprawy bieżącej; nowe pozycje trafiają do niej */
  caseId?: string
  onChanged?: () => void
}) {
  const toast = useToast()
  const [items, setItems] = useState<AccessItem[] | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<AccessItem> | null>(null)
  const [catalog, setCatalog] = useState(false)

  const load = useCallback(async () => {
    const [list, st] = await Promise.all([listAccess(clientId), isAdmin ? listSteps(clientId) : Promise.resolve([])])
    setItems(caseId ? list.filter((i) => i.case_id === caseId) : list)
    setSteps(st)
    onChanged?.()
  }, [clientId, isAdmin, caseId, onChanged])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn()
      if (msg) toast(msg)
    } catch (e) {
      toast((e as Error).message)
    }
    await load()
  }

  if (!items) return <Spinner />
  const done = items.filter((i) => i.status !== 'todo').length

  return (
    <div className="ws">
      <div className="ws-savebar">
        <span style={{ fontSize: 14.5 }}>
          {isAdmin ? (
            <>
              Przekazane: <strong>{done}</strong> z {items.length}. {caseId ? 'Dopisz, do czego potrzebujesz dostępu w tej sprawie. Klientka udziela go tutaj.' : 'Dopisz, czego potrzebujesz. Klient też może dodawać swoje pozycje.'}
            </>
          ) : (
            <>
              {caseId ? 'Tu udzielasz dostępów potrzebnych w tej sprawie.' : 'Tu wymieniamy się dostępami. Ja dopisuję, czego potrzebuję, a Ty możesz dodać wszystko, co jeszcze masz.'} Gdzie się da, zaproś mnie adresem <strong>{ADMIN_EMAIL}</strong>.
            </>
          )}
        </span>
        <div className="row">
          {isAdmin && (
            <button className="btn btn-sm" onClick={() => setCatalog(true)}>
              <Icon name="plus" size={15} /> Z listy standardowej
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ kind: 'login', status: 'todo' })}>
            <Icon name="plus" size={15} /> Dodaj dostęp
          </button>
        </div>
      </div>

      {items.length === 0 && !caseId && (
        <div className="card empty">
          <h3>{isAdmin ? 'Lista dostępów jest pusta' : 'Nie ma jeszcze żadnych dostępów'}</h3>
          <p className="muted" style={{ margin: 0, maxWidth: 460 }}>
            {isAdmin ? 'Dodaj standardowy zestaw jednym kliknięciem albo własne pozycje.' : 'Gdy będę czegoś potrzebować, pojawi się tutaj. Możesz też sama lub sam dodać dostęp.'}
          </p>
        </div>
      )}

      {items.map((it) => (
        <AccessCard
          key={it.id}
          item={it}
          isAdmin={isAdmin}
          steps={steps}
          open={open === it.id}
          onToggle={() => setOpen(open === it.id ? null : it.id)}
          onEdit={() => setEditing(it)}
          run={run}
        />
      ))}

      {editing && (
        <ItemEditor
          item={editing}
          isAdmin={isAdmin}
          steps={steps}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            if (editing.id) await run(() => updateAccess(editing.id!, patch), 'Zapisano')
            else await run(() => addAccess({ ...patch, client_id: clientId, title: patch.title ?? 'Dostęp', created_by: isAdmin ? 'admin' : 'client', position: items.length, ...(caseId ? { case_id: caseId } : {}) }), 'Dodano')
            setEditing(null)
          }}
        />
      )}

      {catalog && (
        <CatalogPicker
          existing={items}
          onClose={() => setCatalog(false)}
          onAdd={async (keys) => {
            await run(() => addAccessFromCatalog(clientId, keys, items, caseId), 'Dodano')
            setCatalog(false)
          }}
        />
      )}
    </div>
  )
}

function AccessCard({
  item, isAdmin, steps, open, onToggle, onEdit, run,
}: {
  item: AccessItem
  isAdmin: boolean
  steps: Step[]
  open: boolean
  onToggle: () => void
  onEdit: () => void
  run: (fn: () => Promise<unknown>, msg?: string) => Promise<void>
}) {
  const stepIdx = steps.findIndex((s) => s.id === item.step_id)
  return (
    <section className={`card acc${item.urgent && item.status === 'todo' ? ' acc-urgent' : ''}`}>
      <button className="acc-head" onClick={onToggle} aria-expanded={open}>
        <span className={`acc-dot acc-${item.status}`}>{item.status === 'done' ? '✓' : item.status === 'na' ? '-' : ''}</span>
        <span className="acc-title">
          <strong>{item.title}</strong>
          <span className="acc-badges">
            <span className="badge sent">{item.kind === 'login' ? 'Dane logowania' : 'Zaproszenie'}</span>
            {item.urgent && item.status === 'todo' && <span className="badge urgent">Pilne</span>}
            {item.created_by === 'client' && <span className="badge draft">{isAdmin ? 'Dodane przez klienta' : 'Dodane przez Ciebie'}</span>}
            {isAdmin && stepIdx >= 0 && <span className="badge draft">Etap {stepIdx}</span>}
            {item.secret_id && <span className="badge submitted">Dane zapisane</span>}
          </span>
        </span>
        <span className={`badge ${STATUS_BADGE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
        <Icon name={open ? 'up' : 'down'} size={16} />
      </button>

      {open && (
        <div className="acc-body">
          {item.description && <p className="acc-desc">{item.description}</p>}
          {item.kind === 'login' && <CredentialsBox item={item} run={run} />}
          {item.kind === 'invite' && (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Zaproś adres <strong>{ADMIN_EMAIL}</strong>. Nie podawaj hasła do tego konta.
            </p>
          )}
          <label className="field">
            <span className="label">Notatka</span>
            <input
              className="input"
              placeholder="np. dostęp ma nasz informatyk, pan Marek"
              defaultValue={item.note ?? ''}
              onBlur={(e) => e.target.value !== (item.note ?? '') && run(() => updateAccess(item.id, { note: e.target.value || null }))}
            />
          </label>
          <div className="row">
            {item.status !== 'done' && (
              <button className="btn btn-sm btn-primary" onClick={() => run(() => updateAccess(item.id, { status: 'done' }), 'Dziękuję!')}>
                ✓ {item.kind === 'invite' ? 'Zaproszenie wysłane' : 'Przekazane'}
              </button>
            )}
            {item.status !== 'todo' && (
              <button className="btn btn-sm" onClick={() => run(() => updateAccess(item.id, { status: 'todo' }))}>
                Jeszcze nie przekazane
              </button>
            )}
            {item.status !== 'na' && (
              <button className="btn btn-sm" onClick={() => run(() => updateAccess(item.id, { status: 'na' }))}>
                Nie mam takiego konta
              </button>
            )}
            <span className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>
              <Icon name="edit" size={15} /> Edytuj
            </button>
            <button
              className="btn btn-ghost btn-sm btn-danger"
              onClick={() => confirm(`Usunąć „${item.title}”${item.secret_id ? ' razem z zapisanymi danymi logowania' : ''}?`) && run(() => deleteAccess(item.id), 'Usunięto')}
            >
              <Icon name="trash" size={15} /> Usuń
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function CredentialsBox({ item, run }: { item: AccessItem; run: (fn: () => Promise<unknown>, msg?: string) => Promise<void> }) {
  const toast = useToast()
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [loaded, setLoaded] = useState(!item.secret_id)
  const [edit, setEdit] = useState(!item.secret_id)
  const [show, setShow] = useState(false)
  const [form, setForm] = useState<Credentials>({ url: '', login: '', password: '', notes: '' })

  const reveal = async () => {
    try {
      const c = await getCredentials(item.id)
      setCreds(c)
      setForm(c ?? { url: '', login: '', password: '', notes: '' })
      setLoaded(true)
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="cred">
      <div className="cred-head">
        <Icon name="unlock" size={16} />
        <span>Dane logowania są szyfrowane. Widzimy je tylko Ty i ja.</span>
      </div>
      {!edit && item.secret_id && !loaded && (
        <button className="btn btn-sm" onClick={reveal}>
          <Icon name="eye" size={15} /> Pokaż zapisane dane
        </button>
      )}
      {!edit && loaded && creds && (
        <div className="cred-view">
          {creds.url && (
            <div>
              <span>Adres</span>
              <a href={/^https?:/.test(creds.url) ? creds.url : `https://${creds.url}`} target="_blank" rel="noopener noreferrer">
                {creds.url}
              </a>
            </div>
          )}
          {creds.login && (
            <div>
              <span>Login</span>
              <code>{creds.login}</code>
              <button className="btn btn-ghost btn-icon" aria-label="Kopiuj login" onClick={() => copyText(creds.login).then(() => toast('Skopiowano login'))}>
                <Icon name="copy" size={14} />
              </button>
            </div>
          )}
          {creds.password && (
            <div>
              <span>Hasło</span>
              <code>{show ? creds.password : '••••••••••'}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => setShow(!show)}>
                {show ? 'Ukryj' : 'Pokaż'}
              </button>
              <button className="btn btn-ghost btn-icon" aria-label="Kopiuj hasło" onClick={() => copyText(creds.password).then(() => toast('Skopiowano hasło'))}>
                <Icon name="copy" size={14} />
              </button>
            </div>
          )}
          {creds.notes && (
            <div>
              <span>Uwagi</span>
              <em>{creds.notes}</em>
            </div>
          )}
          <div className="row">
            <button className="btn btn-sm" onClick={() => setEdit(true)}>
              <Icon name="edit" size={15} /> Zmień dane
            </button>
            <button
              className="btn btn-ghost btn-sm btn-danger"
              onClick={() => confirm('Usunąć zapisane dane logowania?') && run(() => clearCredentials(item.id), 'Usunięto dane logowania')}
            >
              Usuń dane logowania
            </button>
          </div>
        </div>
      )}
      {edit && (
        <div className="cred-form">
          <div className="form-grid">
            <Field label="Adres logowania" value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="np. twojastrona.pl/wp-admin" full />
            <Field label="Login" value={form.login} onChange={(v) => setForm({ ...form, login: v })} />
            <label className="field">
              <span className="label">Hasło</span>
              <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <Field label="Uwagi (np. kod z SMS przychodzi na numer…)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} full />
          </div>
          <div className="row">
            <button
              className="btn btn-primary btn-sm"
              disabled={!form.login && !form.password && !form.url}
              onClick={async () => {
                await run(async () => {
                  await setCredentials(item.id, form)
                  if (item.status === 'todo') await updateAccess(item.id, { status: 'done' })
                }, 'Zapisano bezpiecznie')
                setCreds(form)
                setLoaded(true)
                setEdit(false)
              }}
            >
              Zapisz dane logowania
            </button>
            {item.secret_id && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>
                Anuluj
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ItemEditor({
  item, isAdmin, steps, onClose, onSave,
}: {
  item: Partial<AccessItem>
  isAdmin: boolean
  steps: Step[]
  onClose: () => void
  onSave: (patch: Partial<AccessItem>) => Promise<void>
}) {
  const [title, setTitle] = useState(item.title ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [kind, setKind] = useState<AccessKind>(item.kind ?? 'login')
  const [urgent, setUrgent] = useState(!!item.urgent)
  const [stepId, setStepId] = useState(item.step_id ?? '')
  return (
    <Modal label="Dostęp" onClose={onClose}>
      <div className="eyebrow">Dostępy</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>{item.id ? 'Edytuj dostęp' : 'Nowy dostęp'}</h2>
      <div className="stack">
        <Field label="Nazwa" value={title} onChange={setTitle} placeholder="np. Panel sklepu, konto Booksy, Canva" />
        <div className="field">
          <span className="label">Rodzaj</span>
          <div className="seg" role="radiogroup">
            <button className={kind === 'login' ? 'on' : ''} onClick={() => setKind('login')}>
              Dane logowania
            </button>
            <button className={kind === 'invite' ? 'on' : ''} onClick={() => setKind('invite')}>
              Zaproszenie
            </button>
          </div>
        </div>
        <Field
          label={isAdmin ? 'Opis i instrukcja dla klienta' : 'Opis (opcjonalnie)'}
          value={description}
          onChange={setDescription}
          textarea
          placeholder={kind === 'invite' ? `Jak zaprosić ${ADMIN_EMAIL}…` : 'Do czego służy, co jest potrzebne'}
        />
        {isAdmin && (
          <>
            <Toggle checked={urgent} onChange={setUrgent} label="Pilne (klient zobaczy to na górze listy „Do zrobienia”)" />
            <label className="field">
              <span className="label">Etap projektu</span>
              <select className="select" value={stepId} onChange={(e) => setStepId(e.target.value)}>
                <option value="">Bez etapu</option>
                {steps.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    Etap {i}: {s.title}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button
          className="btn btn-primary"
          disabled={!title.trim()}
          onClick={() =>
            onSave({
              title: title.trim(),
              description: description.trim() || null,
              kind,
              ...(isAdmin ? { urgent, step_id: stepId || null } : {}),
            })
          }
        >
          Zapisz
        </button>
      </div>
    </Modal>
  )
}

function CatalogPicker({ existing, onClose, onAdd }: { existing: AccessItem[]; onClose: () => void; onAdd: (keys: string[]) => Promise<void> }) {
  const have = new Set(existing.map((e) => e.service))
  const available = ACCESS_CATALOG.filter((c) => !have.has(c.key))
  const [picked, setPicked] = useState<string[]>(available.map((c) => c.key))
  return (
    <Modal label="Lista standardowa" onClose={onClose}>
      <div className="eyebrow">Dostępy</div>
      <h2 style={{ marginTop: 8, marginBottom: 14 }}>Dodaj z listy standardowej</h2>
      {available.length === 0 ? (
        <p className="muted">Wszystkie standardowe pozycje są już na liście.</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {available.map((c) => (
            <label key={c.key} className="switch">
              <input type="checkbox" checked={picked.includes(c.key)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.key] : picked.filter((k) => k !== c.key))} />
              {c.title} <span className="muted">({c.kind === 'login' ? 'dane logowania' : 'zaproszenie'})</span>
            </label>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Anuluj
        </button>
        <button className="btn btn-primary" disabled={!picked.length} onClick={() => onAdd(picked)}>
          Dodaj ({picked.length})
        </button>
      </div>
    </Modal>
  )
}
