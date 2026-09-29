import type { Answers, AnswerValue, Question, Section, SurveySchema } from './types'

export const otherKey = (id: string) => `${id}__other`

/** Czy pytanie jest widoczne przy danych odpowiedziach */
export function isVisible(q: Question, answers: Answers, schema: SurveySchema): boolean {
  if (!q.showIf) return true
  const exists = schema.sections.some((s) => s.questions.some((x) => x.id === q.showIf!.id))
  if (!exists) return true
  const v = answers[q.showIf.id]
  if (Array.isArray(v)) return (v as unknown[]).includes(q.showIf.value)
  return v === q.showIf.value
}

export function isAnswered(q: Question, answers: Answers): boolean {
  const v = answers[q.id]
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) {
    if (q.type === 'repeater') return (v as Array<Record<string, string>>).some((row) => Object.values(row).some((x) => x?.trim()))
    return v.length > 0 || !!(answers[otherKey(q.id)] as string | undefined)?.trim()
  }
  return Object.values(v).some((x) => typeof x === 'string' && x.trim())
}

export function sectionProgress(section: Section, answers: Answers, schema: SurveySchema) {
  const visible = section.questions.filter((q) => isVisible(q, answers, schema))
  const done = visible.filter((q) => isAnswered(q, answers)).length
  return { done, total: visible.length }
}

export function surveyProgress(schema: SurveySchema, answers: Answers) {
  let done = 0
  let total = 0
  for (const s of schema.sections) {
    const p = sectionProgress(s, answers, schema)
    done += p.done
    total += p.total
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

export function missingRequired(schema: SurveySchema, answers: Answers) {
  const out: Array<{ section: Section; question: Question }> = []
  for (const section of schema.sections)
    for (const question of section.questions)
      if (question.required && isVisible(question, answers, schema) && !isAnswered(question, answers))
        out.push({ section, question })
  return out
}

/** Odpowiedź w formie czytelnego tekstu (lub null, gdy brak) */
export function answerToText(q: Question, answers: Answers): string | null {
  if (!isAnswered(q, answers)) return null
  const v = answers[q.id] as AnswerValue
  const other = (answers[otherKey(q.id)] as string | undefined)?.trim()
  switch (q.type) {
    case 'single': {
      const base = v as string
      return base === '__other' ? `Inne: ${other ?? ''}` : base
    }
    case 'multi': {
      const list = [...((v as string[]) ?? [])]
      if (other) list.push(`Inne: ${other}`)
      return list.map((x) => `- ${x}`).join('\n')
    }
    case 'matrix': {
      const m = v as Record<string, string>
      return (q.rows ?? [])
        .filter((r) => m[r.id])
        .map((r) => `- ${r.label}: **${m[r.id]}**`)
        .join('\n')
    }
    case 'repeater': {
      const rows = (v as Array<Record<string, string>>).filter((row) => Object.values(row).some((x) => x?.trim()))
      return rows
        .map((row, i) =>
          [`**${q.itemLabel ?? 'Pozycja'} ${i + 1}**`, ...(q.fields ?? []).map((f) => `  - ${f.label}: ${row[f.id]?.trim() || '—'}`)].join('\n'),
        )
        .join('\n')
    }
    default:
      return String(v)
  }
}

/** Cała ankieta jako Markdown — do podglądu, kopiowania i dla agenta AI */
export function briefToMarkdown(title: string, schema: SurveySchema, answers: Answers, opts: { includeEmpty?: boolean } = {}) {
  const lines: string[] = [`# ${title}`, '']
  schema.sections.forEach((s, si) => {
    lines.push(`## ${si + 1}. ${s.title}`, '')
    s.questions.forEach((q) => {
      if (!isVisible(q, answers, schema)) return
      const a = answerToText(q, answers)
      if (!a && !opts.includeEmpty) return
      lines.push(`**${q.label}**`)
      lines.push(a ?? '_brak odpowiedzi_', '')
    })
  })
  return lines.join('\n')
}
