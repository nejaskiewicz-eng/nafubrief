import { useCallback, useEffect, useState } from 'react'
import { Spinner, useToast } from '../components/ui'
import { ACCESS_SERVICES, ADMIN_EMAIL, listAccess, setAccess, type AccessItem } from '../lib/project'

const LABEL: Record<AccessItem['status'], string> = { todo: 'Do zrobienia', done: 'Zrobione', na: 'Nie dotyczy' }

export default function Access({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const toast = useToast()
  const [items, setItems] = useState<Record<string, AccessItem> | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    const list = await listAccess(clientId)
    setItems(Object.fromEntries(list.map((i) => [i.service, i])))
  }, [clientId])

  useEffect(() => {
    load().catch((e) => toast((e as Error).message))
  }, [load, toast])

  if (!items) return <Spinner />
  const status = (k: string) => items[k]?.status ?? 'todo'
  const done = ACCESS_SERVICES.filter((s) => status(s.key) !== 'todo').length

  const update = async (key: string, patch: Partial<Pick<AccessItem, 'status' | 'note'>>) => {
    setItems({ ...items, [key]: { ...(items[key] ?? { id: '', client_id: clientId, service: key, status: 'todo', note: null }), ...patch } })
    try {
      await setAccess(clientId, key, { status: status(key), note: items[key]?.note ?? null, ...patch })
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="ws">
      <div className="ws-savebar">
        <span style={{ fontSize: 14.5 }}>
          {isAdmin ? (
            <>Klient potwierdził <strong>{done}</strong> z {ACCESS_SERVICES.length} dostępów.</>
          ) : (
            <>
              Zaproś mnie do swoich kont adresem <strong>{ADMIN_EMAIL}</strong>. Nie podawaj haseł. Gotowe: <strong>{done}</strong> z {ACCESS_SERVICES.length}.
            </>
          )}
        </span>
      </div>

      {ACCESS_SERVICES.map((s) => {
        const st = status(s.key)
        const isOpen = open === s.key || (!isAdmin && st === 'todo' && open === null && s.key === ACCESS_SERVICES.find((x) => status(x.key) === 'todo')?.key)
        return (
          <section className={`card access-card ${st}`} key={s.key}>
            <button className="access-head" onClick={() => setOpen(isOpen ? '' : s.key)}>
              <span className={`access-dot ${st}`}>{st === 'done' ? '✓' : st === 'na' ? '–' : ''}</span>
              <span className="access-title">
                <strong>{s.name}</strong>
                <span className="muted">{s.why}</span>
              </span>
              <span className={`badge ${st === 'done' ? 'submitted' : st === 'na' ? 'draft' : 'in_progress'}`}>{LABEL[st]}</span>
            </button>
            {isOpen && (
              <div className="access-body">
                <ol>
                  {s.how.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ol>
                <label className="field">
                  <span className="label">Notatka (opcjonalnie)</span>
                  <input
                    className="input"
                    placeholder="np. domena jest w home.pl, dostęp ma mój informatyk"
                    defaultValue={items[s.key]?.note ?? ''}
                    onBlur={(e) => e.target.value !== (items[s.key]?.note ?? '') && update(s.key, { note: e.target.value || null })}
                  />
                </label>
                <div className="row">
                  <button className={`btn btn-sm ${st === 'done' ? 'btn-dark' : 'btn-primary'}`} onClick={() => update(s.key, { status: st === 'done' ? 'todo' : 'done' })}>
                    {st === 'done' ? 'Cofnij: jeszcze nie zrobione' : '✓ Zrobione, zaprosiłam/em'}
                  </button>
                  <button className="btn btn-sm" onClick={() => update(s.key, { status: st === 'na' ? 'todo' : 'na' })}>
                    {st === 'na' ? 'Jednak dotyczy' : 'Nie mam takiego konta'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
