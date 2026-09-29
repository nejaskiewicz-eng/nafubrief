import type { Question, RepeaterField } from '../lib/types'

type Opts = Partial<Omit<Question, 'id' | 'type' | 'label'>>

export const YES_MAYBE_NO = ['Tak', 'Może', 'Nie']
export const YES_PARTLY_NO = ['Tak', 'Częściowo', 'Nie']
export const YES_NO_DONTKNOW = ['Tak', 'Nie', 'Nie wiem']

export const text = (id: string, label: string, o: Opts = {}): Question => ({ id, type: 'text', label, ...o })
export const area = (id: string, label: string, o: Opts = {}): Question => ({ id, type: 'textarea', label, ...o })
export const date = (id: string, label: string, o: Opts = {}): Question => ({ id, type: 'date', label, ...o })

export const single = (id: string, label: string, options: string[], o: Opts = {}): Question => ({
  id, type: 'single', label, options, ...o,
})

export const multi = (id: string, label: string, options: string[], o: Opts = {}): Question => ({
  id, type: 'multi', label, options, ...o,
})

/** Tabela ocen: wiersze [nazwa, opis], kolumny np. Tak / Może / Nie */
export const matrix = (
  id: string,
  label: string,
  rows: Array<[string, string?]>,
  columns = YES_MAYBE_NO,
  o: Opts = {},
): Question => ({
  id, type: 'matrix', label, columns,
  rows: rows.map(([l, d], i) => ({ id: `r${i + 1}`, label: l, desc: d })),
  ...o,
})

export const repeater = (
  id: string,
  label: string,
  itemLabel: string,
  fields: Array<[string, RepeaterField['type']?]>,
  o: Opts = {},
): Question => ({
  id, type: 'repeater', label, itemLabel,
  fields: fields.map(([l, t], i) => ({ id: `f${i + 1}`, label: l, type: t ?? 'text' })),
  ...o,
})
