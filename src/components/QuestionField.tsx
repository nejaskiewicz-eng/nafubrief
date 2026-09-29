import type { AnswerValue, Answers, Question } from '../lib/types'
import { otherKey } from '../lib/format'
import { Check, Icon } from './ui'

interface Props {
  q: Question
  answers: Answers
  onChange: (id: string, value: AnswerValue | undefined) => void
  error?: boolean
}

const OTHER = '__other'

export function QuestionField({ q, answers, onChange, error }: Props) {
  const value = answers[q.id]
  const labelId = `ql-${q.id}`

  return (
    <div className={`card q${error ? ' error' : ''}`} id={`q-${q.id}`} role="group" aria-labelledby={labelId}>
      <p className="q-label" id={labelId}>
        {q.label}
        {q.required && <span className="req" aria-label="wymagane">*</span>}
      </p>
      {q.help && <p className="q-help">{q.help}</p>}
      <div className="q-body">
        <Control q={q} value={value} answers={answers} onChange={onChange} labelId={labelId} />
      </div>
    </div>
  )
}

function Control({ q, value, answers, onChange, labelId }: Props & { value: AnswerValue | undefined; labelId: string }) {
  switch (q.type) {
    case 'text':
      return (
        <input
          className="input"
          aria-labelledby={labelId}
          value={(value as string) ?? ''}
          placeholder={q.placeholder}
          onChange={(e) => onChange(q.id, e.target.value)}
        />
      )
    case 'date':
      return (
        <input
          type="date"
          className="input"
          style={{ maxWidth: 240 }}
          aria-labelledby={labelId}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(q.id, e.target.value)}
        />
      )
    case 'textarea':
      return (
        <textarea
          className="textarea"
          aria-labelledby={labelId}
          value={(value as string) ?? ''}
          placeholder={q.placeholder ?? 'Napisz własnymi słowami…'}
          onChange={(e) => onChange(q.id, e.target.value)}
        />
      )
    case 'single':
      return <SingleChoice q={q} value={value as string | undefined} answers={answers} onChange={onChange} />
    case 'multi':
      return <MultiChoice q={q} value={(value as string[]) ?? []} answers={answers} onChange={onChange} />
    case 'matrix':
      return <Matrix q={q} value={(value as Record<string, string>) ?? {}} onChange={onChange} />
    case 'repeater':
      return <Repeater q={q} value={(value as Array<Record<string, string>>) ?? [{}]} onChange={onChange} />
  }
}

const isLong = (opts: string[]) => opts.some((o) => o.length > 60)

function SingleChoice({ q, value, answers, onChange }: { q: Question; value?: string; answers: Answers; onChange: Props['onChange'] }) {
  const opts = q.options ?? []
  const all = q.allowOther ? [...opts, OTHER] : opts
  return (
    <>
      <div className={`choices${isLong(opts) ? ' long' : ''}`} role="radiogroup">
        {all.map((o) => {
          const checked = value === o
          return (
            <label key={o} className={`choice radio${checked ? ' checked' : ''}`}>
              <input
                type="radio"
                name={q.id}
                checked={checked}
                onChange={() => onChange(q.id, o)}
                onClick={() => checked && onChange(q.id, undefined)}
              />
              <span className="mark">
                <Check />
              </span>
              <span>{o === OTHER ? 'Inne' : o}</span>
            </label>
          )
        })}
      </div>
      {value === OTHER && (
        <input
          className="input other-input"
          autoFocus
          placeholder="Wpisz swoją odpowiedź"
          value={(answers[otherKey(q.id)] as string) ?? ''}
          onChange={(e) => onChange(otherKey(q.id), e.target.value)}
        />
      )}
    </>
  )
}

function MultiChoice({ q, value, answers, onChange }: { q: Question; value: string[]; answers: Answers; onChange: Props['onChange'] }) {
  const opts = q.options ?? []
  const limitReached = !!q.max && value.length >= q.max
  const toggle = (o: string) => onChange(q.id, value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <>
      <div className={`choices${isLong(opts) ? ' long' : ''}`}>
        {opts.map((o) => {
          const checked = value.includes(o)
          const disabled = !checked && limitReached
          return (
            <label key={o} className={`choice${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}`}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(o)} />
              <span className="mark">
                <Check />
              </span>
              <span>{o}</span>
            </label>
          )
        })}
      </div>
      {q.allowOther && (
        <input
          className="input other-input"
          placeholder="Inne (wpisz, jeśli czegoś brakuje)"
          value={(answers[otherKey(q.id)] as string) ?? ''}
          onChange={(e) => onChange(otherKey(q.id), e.target.value)}
        />
      )}
      {q.max && (
        <p className="q-hint">
          Wybrano {value.length} z maksymalnie {q.max}
        </p>
      )}
    </>
  )
}

function Matrix({ q, value, onChange }: { q: Question; value: Record<string, string>; onChange: Props['onChange'] }) {
  const cols = q.columns ?? ['Tak', 'Może', 'Nie']
  return (
    <div className="matrix">
      {(q.rows ?? []).map((r) => (
        <div className="m-row" key={r.id}>
          <div>
            <div className="t">{r.label}</div>
            {r.desc && <div className="d">{r.desc}</div>}
          </div>
          <div className="seg" role="radiogroup" aria-label={r.label}>
            {cols.map((c) => {
              const on = value[r.id] === c
              return (
                <button
                  type="button"
                  key={c}
                  data-v={c}
                  role="radio"
                  aria-checked={on}
                  className={on ? 'on' : ''}
                  onClick={() => {
                    const next = { ...value }
                    if (on) delete next[r.id]
                    else next[r.id] = c
                    onChange(q.id, next)
                  }}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Repeater({ q, value, onChange }: { q: Question; value: Array<Record<string, string>>; onChange: Props['onChange'] }) {
  const items = value.length ? value : [{}]
  const set = (i: number, f: string, v: string) => onChange(q.id, items.map((it, j) => (j === i ? { ...it, [f]: v } : it)))
  return (
    <>
      {items.map((it, i) => (
        <div className="rep-item" key={i}>
          <div className="rep-head">
            <span>
              {q.itemLabel ?? 'Pozycja'} {i + 1}
            </span>
            {items.length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(q.id, items.filter((_, j) => j !== i))}>
                <Icon name="trash" size={15} /> Usuń
              </button>
            )}
          </div>
          {(q.fields ?? []).map((f) => (
            <label className="field" key={f.id}>
              <span className="label">{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea className="textarea" style={{ minHeight: 80 }} value={it[f.id] ?? ''} onChange={(e) => set(i, f.id, e.target.value)} />
              ) : (
                <input className="input" value={it[f.id] ?? ''} onChange={(e) => set(i, f.id, e.target.value)} />
              )}
            </label>
          ))}
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => onChange(q.id, [...items, {}])}>
        <Icon name="plus" size={16} /> Dodaj {(q.itemLabel ?? 'pozycję').toLowerCase()}
      </button>
    </>
  )
}
