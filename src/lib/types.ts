export type QuestionType =
  | 'text'
  | 'textarea'
  | 'single'
  | 'multi'
  | 'matrix'
  | 'repeater'
  | 'date'

export interface MatrixRow {
  id: string
  label: string
  desc?: string
}

export interface RepeaterField {
  id: string
  label: string
  type: 'text' | 'textarea'
}

export interface Question {
  id: string
  type: QuestionType
  label: string
  help?: string
  placeholder?: string
  required?: boolean
  options?: string[]
  /** Dodaje pole „Inne:” do pytań wyboru */
  allowOther?: boolean
  /** Maksymalna liczba zaznaczeń (multi) */
  max?: number
  rows?: MatrixRow[]
  columns?: string[]
  fields?: RepeaterField[]
  /** Nazwa pojedynczego wpisu w powtarzalnej grupie, np. „Lokalizacja” */
  itemLabel?: string
  /** Pokaż pytanie tylko, gdy odpowiedź na inne pytanie ma daną wartość */
  showIf?: { id: string; value: string }
}

export interface Section {
  id: string
  title: string
  description?: string
  questions: Question[]
}

export interface SurveySchema {
  sections: Section[]
}

export type TemplateKey = 'legal' | 'strategy' | 'technical' | 'visual'

export interface Template {
  key: TemplateKey
  title: string
  short: string
  description: string
  intro: string
  minutes: number
  accent: string
  schema: SurveySchema
}

export type AnswerValue =
  | string
  | string[]
  | Record<string, string>
  | Array<Record<string, string>>

export type Answers = Record<string, AnswerValue>

export type BriefStatus = 'draft' | 'sent' | 'in_progress' | 'submitted'

/** Forma zwracania się do klienta */
export type AddressForm = 'ty' | 'pani' | 'pan' | 'panstwo'

export interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  notes: string | null
  portal_token: string
  /** krótki adres, np. optyka-perfect */
  slug: string
  /** konto klienta (logowanie do ankiet) */
  user_id: string | null
  login_email: string | null
  /** jak się zwracać: na Ty albo oficjalnie */
  address_form: AddressForm | null
  /** zwrot w powitaniu, np. „Olu”, „Pani Aleksandro” */
  salutation: string | null
  /** ton i sposób prowadzenia rozmów */
  tone_notes: string | null
  created_at: string
}

export interface Brief {
  id: string
  client_id: string
  template_key: string
  title: string
  description: string | null
  intro: string | null
  schema: SurveySchema
  answers: Answers
  status: BriefStatus
  token: string
  /** krótka nazwa w adresie, np. prawny */
  slug: string
  position: number
  /** pilna: klient widzi ją wyróżnioną i na górze listy */
  urgent: boolean
  /** etap harmonogramu, do którego należy ankieta */
  step_id: string | null
  /** kolejność w etapie */
  step_position: number
  /** sprawa bieżąca, do której należy ankieta */
  case_id?: string | null
  opened_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface Summary {
  id: string
  client_id: string
  status: 'pending' | 'done' | 'error'
  content: string | null
  error: string | null
  model: string | null
  created_at: string
}

/** Co widzi klient pod linkiem */
export interface PublicBrief {
  /** ankieta w sprawie bieżącej albo własna: na ekranie powitalnym nagłówkiem jest jej tytuł, a nie hasło o nowej stronie */
  own_title?: boolean
  status: BriefStatus
  title: string
  description: string | null
  intro: string | null
  schema: SurveySchema
  answers: Answers
  client_name: string
  submitted_at: string | null
}

export interface PublicPortal {
  client_name: string
  client_slug: string
  briefs: Array<{
    title: string
    description: string | null
    slug: string
    template_key: string
  }>
}
