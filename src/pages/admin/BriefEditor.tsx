import { useEffect, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { Icon, Spinner, StatusBadge, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import type { Brief, Question, QuestionType, Section } from '../../lib/types'
import { YES_MAYBE_NO } from '../../templates/builders'

const TYPE_LABEL: Record<QuestionType, string> = {
  text: 'Krótka odpowiedź',
  textarea: 'Długa odpowiedź',
  single: 'Jeden wybór',
  multi: 'Wielokrotny wybór',
  matrix: 'Tabela ocen (Tak / Może / Nie)',
  repeater: 'Powtarzalna grupa pól',
  date: 'Data',
}

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export default function BriefEditor() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [meta, setMeta] = useState({ title: '', intro: '' })
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getBrief(id).then((b) => {
      setBrief(b)
      setSections(b.schema.sections)
      setMeta({ title: b.title, intro: b.intro ?? '' })
    })
  }, [id])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (confirm('Masz niezapisane zmiany. Wyjść bez zapisywania?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  if (!brief) return <Spinner />

  const change = (next: Section[]) => {
    setSections(next)
    setDirty(true)
  }
  const updSection = (si: number, patch: Partial<Section>) => change(sections.map((s, i) => (i === si ? { ...s, ...patch } : s)))
  const updQ = (si: number, qi: number, patch: Partial<Question>) =>
    updSection(si, { questions: sections[si].questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) })
  const move = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= arr.length) return arr
    const a = [...arr]
    ;[a[i], a[j]] = [a[j], a[i]]
    return a
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.updateBrief(brief.id, { title: meta.title, intro: meta.intro, schema: { sections } })
      setDirty(false)
      toast('Zapisano pytania')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = (si: number) => {
    const q: Question = { id: rid('q'), type: 'textarea', label: 'Nowe pytanie' }
    updSection(si, { questions: [...sections[si].questions, q] })
    setOpen(q.id)
  }

  const total = sections.reduce((n, s) => n + s.questions.length, 0)
  const answered = Object.keys(brief.answers).length > 0

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link to="/panel">Klienci</Link> <span>/</span>
            <Link to={`/panel/klient/${brief.client_id}`}>Klient</Link> <span>/</span>
          </div>
          <h1>Edycja pytań</h1>
        </div>
        <StatusBadge status={brief.status} />
      </div>

      <div className="ed-toolbar">
        <span className="muted" style={{ fontSize: 14 }}>
          {sections.length} części · {total} pytań {dirty && <strong style={{ color: 'var(--warn)' }}>· niezapisane zmiany</strong>}
        </span>
        <div className="row">
          <Link className="btn btn-sm" to={`/panel/ankieta/${brief.id}/podglad`}>
            <Icon name="eye" size={15} /> Podgląd
          </Link>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || saving}>
            {saving ? 'Zapisuję…' : 'Zapisz zmiany'}
          </button>
        </div>
      </div>

      {answered && (
        <p className="card" style={{ padding: '12px 16px', background: 'var(--warn-50)', borderColor: '#f4e0b4', fontSize: 14 }}>
          Klient już zaczął odpowiadać. Zmiany w pytaniach są bezpieczne, ale usunięcie pytania ukryje odpowiedź na nie.
        </p>
      )}

      <div className="card ed-section">
        <div className="form-grid">
          <label className="field full">
            <span className="label">Tytuł ankiety</span>
            <input className="input" value={meta.title} onChange={(e) => { setMeta({ ...meta, title: e.target.value }); setDirty(true) }} />
          </label>
          <label className="field full">
            <span className="label">Wstęp dla klienta (ekran powitalny)</span>
            <textarea className="textarea" value={meta.intro} onChange={(e) => { setMeta({ ...meta, intro: e.target.value }); setDirty(true) }} />
          </label>
        </div>
      </div>

      {sections.map((s, si) => (
        <div className="card ed-section" key={s.id}>
          <div className="ed-section-head">
            <div style={{ display: 'grid', gap: 4 }}>
              <div className="eyebrow">Część {si + 1}</div>
              <input className="inline-input" style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--ink)' }} value={s.title} onChange={(e) => updSection(si, { title: e.target.value })} aria-label="Tytuł części" />
              <input className="inline-input muted" placeholder="Opis części (opcjonalnie)" value={s.description ?? ''} onChange={(e) => updSection(si, { description: e.target.value || undefined })} aria-label="Opis części" />
            </div>
            <div className="ed-row">
              <button className="btn btn-ghost btn-icon" aria-label="Przesuń część w górę" onClick={() => change(move(sections, si, -1))}>
                <Icon name="up" size={16} />
              </button>
              <button className="btn btn-ghost btn-icon" aria-label="Przesuń część w dół" onClick={() => change(move(sections, si, 1))}>
                <Icon name="down" size={16} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-danger"
                aria-label="Usuń część"
                onClick={() => confirm(`Usunąć część „${s.title}” (${s.questions.length} pytań)?`) && change(sections.filter((_, i) => i !== si))}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>

          {s.questions.map((q, qi) => (
            <QuestionEditor
              key={q.id}
              q={q}
              open={open === q.id}
              onToggle={() => setOpen(open === q.id ? null : q.id)}
              onChange={(patch) => updQ(si, qi, patch)}
              onMove={(d) => updSection(si, { questions: move(s.questions, qi, d) })}
              onDuplicate={() => {
                const copy = { ...structuredClone(q), id: rid('q'), label: `${q.label} (kopia)` }
                const qs = [...s.questions]
                qs.splice(qi + 1, 0, copy)
                updSection(si, { questions: qs })
                setOpen(copy.id)
              }}
              onDelete={() => updSection(si, { questions: s.questions.filter((_, i) => i !== qi) })}
            />
          ))}
          <button className="btn btn-sm" onClick={() => addQuestion(si)}>
            <Icon name="plus" size={15} /> Dodaj pytanie
          </button>
        </div>
      ))}

      <button
        className="btn"
        onClick={() => change([...sections, { id: rid('s'), title: 'Nowa część', questions: [{ id: rid('q'), type: 'textarea', label: 'Nowe pytanie' }] }])}
      >
        <Icon name="plus" /> Dodaj część
      </button>
    </>
  )
}

function QuestionEditor({
  q, open, onToggle, onChange, onMove, onDuplicate, onDelete,
}: {
  q: Question
  open: boolean
  onToggle: () => void
  onChange: (p: Partial<Question>) => void
  onMove: (d: number) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const setType = (type: QuestionType) => {
    const patch: Partial<Question> = { type }
    if ((type === 'single' || type === 'multi') && !q.options?.length) patch.options = ['Opcja 1', 'Opcja 2']
    if (type === 'matrix' && !q.rows?.length) {
      patch.rows = [{ id: 'r1', label: 'Pozycja 1' }]
      patch.columns = YES_MAYBE_NO
    }
    if (type === 'repeater' && !q.fields?.length) {
      patch.fields = [{ id: 'f1', label: 'Pole 1', type: 'text' }]
      patch.itemLabel = 'Pozycja'
    }
    onChange(patch)
  }

  return (
    <div className={`ed-q${open ? ' open' : ''}`}>
      <div className="ed-q-head" onClick={onToggle}>
        <div style={{ minWidth: 0 }}>
          <div className="ed-q-title">
            {q.label}
            {q.required && <span style={{ color: 'var(--teal-600)' }}> *</span>}
          </div>
          <div className="ed-q-type">
            {TYPE_LABEL[q.type]}
            {q.showIf && ' · warunkowe'}
          </div>
        </div>
        <div className="ed-row" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-icon" aria-label="W górę" onClick={() => onMove(-1)}>
            <Icon name="up" size={16} />
          </button>
          <button className="btn btn-ghost btn-icon" aria-label="W dół" onClick={() => onMove(1)}>
            <Icon name="down" size={16} />
          </button>
          <button className="btn btn-ghost btn-icon" aria-label="Duplikuj" onClick={onDuplicate}>
            <Icon name="copy" size={16} />
          </button>
          <button className="btn btn-ghost btn-icon btn-danger" aria-label="Usuń pytanie" onClick={() => confirm(`Usunąć pytanie „${q.label}”?`) && onDelete()}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="ed-q-body">
          <label className="field">
            <span className="label">Treść pytania</span>
            <textarea className="textarea" style={{ minHeight: 60 }} value={q.label} onChange={(e) => onChange({ label: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Podpowiedź (opcjonalnie)</span>
            <textarea className="textarea" style={{ minHeight: 60 }} value={q.help ?? ''} onChange={(e) => onChange({ help: e.target.value || undefined })} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span className="label">Typ odpowiedzi</span>
              <select className="select" value={q.type} onChange={(e) => setType(e.target.value as QuestionType)}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {(q.type === 'text' || q.type === 'textarea') && (
              <label className="field">
                <span className="label">Tekst w pustym polu</span>
                <input className="input" value={q.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value || undefined })} />
              </label>
            )}
          </div>

          {(q.type === 'single' || q.type === 'multi') && (
            <>
              <label className="field">
                <span className="label">Opcje — każda w nowej linii</span>
                <textarea className="textarea" defaultValue={(q.options ?? []).join('\n')} onBlur={(e) => onChange({ options: lines(e.target.value) })} />
              </label>
              <div className="row">
                <label className="switch">
                  <input type="checkbox" checked={!!q.allowOther} onChange={(e) => onChange({ allowOther: e.target.checked || undefined })} /> Pole „Inne”
                </label>
                {q.type === 'multi' && (
                  <label className="switch">
                    Maks. zaznaczeń
                    <input className="input" type="number" min={0} style={{ width: 80, padding: '6px 10px' }} value={q.max ?? ''} onChange={(e) => onChange({ max: Number(e.target.value) || undefined })} />
                  </label>
                )}
              </div>
            </>
          )}

          {q.type === 'matrix' && (
            <>
              <label className="field">
                <span className="label">Wiersze — każdy w nowej linii, opis po znaku „|”</span>
                <textarea
                  className="textarea"
                  style={{ minHeight: 160 }}
                  defaultValue={(q.rows ?? []).map((r) => (r.desc ? `${r.label} | ${r.desc}` : r.label)).join('\n')}
                  onBlur={(e) =>
                    onChange({
                      rows: lines(e.target.value).map((l, i) => {
                        const [label, ...d] = l.split('|')
                        return { id: q.rows?.[i]?.id ?? `r${i + 1}`, label: label.trim(), desc: d.join('|').trim() || undefined }
                      }),
                    })
                  }
                />
              </label>
              <label className="field">
                <span className="label">Kolumny (oddzielone przecinkami)</span>
                <input className="input" defaultValue={(q.columns ?? YES_MAYBE_NO).join(', ')} onBlur={(e) => onChange({ columns: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </label>
            </>
          )}

          {q.type === 'repeater' && (
            <>
              <label className="field">
                <span className="label">Nazwa pojedynczego wpisu</span>
                <input className="input" value={q.itemLabel ?? ''} onChange={(e) => onChange({ itemLabel: e.target.value })} />
              </label>
              <label className="field">
                <span className="label">Pola — każde w nowej linii (dopisz „| długie” dla dłuższego pola)</span>
                <textarea
                  className="textarea"
                  defaultValue={(q.fields ?? []).map((f) => (f.type === 'textarea' ? `${f.label} | długie` : f.label)).join('\n')}
                  onBlur={(e) =>
                    onChange({
                      fields: lines(e.target.value).map((l, i) => {
                        const [label, t] = l.split('|')
                        return { id: q.fields?.[i]?.id ?? `f${i + 1}`, label: label.trim(), type: t?.trim().startsWith('dł') ? 'textarea' : 'text' }
                      }),
                    })
                  }
                />
              </label>
            </>
          )}

          <label className="switch">
            <input type="checkbox" checked={!!q.required} onChange={(e) => onChange({ required: e.target.checked || undefined })} /> Pytanie wymagane
          </label>
          {q.showIf && (
            <p className="q-hint" style={{ margin: 0 }}>
              Pokazywane tylko, gdy odpowiedź na inne pytanie to „{q.showIf.value}”.{' '}
              <button className="btn btn-ghost btn-sm" onClick={() => onChange({ showIf: undefined })}>
                Pokazuj zawsze
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
