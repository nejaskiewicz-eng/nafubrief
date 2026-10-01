import type { AddressForm } from '../lib/types'

export const ADDRESS_LABEL: Record<AddressForm, string> = {
  ty: 'Na Ty',
  pani: 'Oficjalnie: Pani',
  pan: 'Oficjalnie: Pan',
  panstwo: 'Oficjalnie: Państwo',
}

const TONE_PRESETS: Array<[string, string]> = [
  ['Po koleżeńsku', 'Naturalnie i luźno, jak do koleżanki, ale profesjonalnie i z zachowaniem powagi współpracy. Po ludzku, klarownie, konkretnie.'],
  ['Uprzejmie i oficjalnie', 'Uprzejmie i oficjalnie, z pełnymi formami grzecznościowymi. Rzeczowo, bez potocznych zwrotów.'],
  ['Krótko i rzeczowo', 'Krótko i rzeczowo: najpierw decyzja albo zadanie, potem szczegóły. Bez wstępów.'],
]

export interface Tone {
  address_form?: AddressForm | null
  salutation?: string | null
  tone_notes?: string | null
}

/** Wybór formy zwracania się do klienta i tonu rozmów (przy zakładaniu klienta i w jego danych) */
export function ToneFields({ value, onChange }: { value: Tone; onChange: (v: Tone) => void }) {
  const form = value.address_form ?? null
  return (
    <div className="tone-fields full">
      <span className="label">Jak się zwracać do klienta? *</span>
      <div className="seg" role="radiogroup" aria-label="Forma zwracania się">
        {(Object.keys(ADDRESS_LABEL) as AddressForm[]).map((k) => (
          <button type="button" key={k} className={form === k ? 'on' : ''} onClick={() => onChange({ ...value, address_form: k })}>
            {ADDRESS_LABEL[k]}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="label">Zwrot w powitaniu</span>
        <input
          className="input"
          value={value.salutation ?? ''}
          placeholder={form === 'ty' ? 'np. Olu' : form === 'pan' ? 'np. Panie Michale' : form === 'panstwo' ? 'np. Szanowni Państwo' : 'np. Pani Aleksandro'}
          onChange={(e) => onChange({ ...value, salutation: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="label">Ton i sposób prowadzenia rozmów</span>
        <textarea
          className="textarea"
          style={{ minHeight: 70 }}
          value={value.tone_notes ?? ''}
          placeholder="np. naturalnie, konkretnie, bez żargonu"
          onChange={(e) => onChange({ ...value, tone_notes: e.target.value })}
        />
      </label>
      <div className="row" style={{ gap: 6 }}>
        {TONE_PRESETS.map(([label, text]) => (
          <button type="button" key={label} className="btn btn-ghost btn-sm" onClick={() => onChange({ ...value, tone_notes: text })}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Krótki opis ustawień do nagłówka karty klienta */
export function toneSummary(t: Tone): string {
  if (!t.address_form) return 'Nie ustawiono formy zwracania się'
  return [ADDRESS_LABEL[t.address_form], t.salutation ? `„${t.salutation}”` : null].filter(Boolean).join(', ')
}
