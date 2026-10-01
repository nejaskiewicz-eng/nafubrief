// Przebieg projektu: harmonogram, zadania, koncept i podgląd strony, dostępy, dokumenty.
import { supabase } from './supabase'
import { uploadFile, type ClientFile } from './workspace'

const sb = () => {
  if (!supabase) throw new Error('Ta funkcja działa po podłączeniu Supabase.')
  return supabase
}
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/* ---------- harmonogram ---------- */

export type StepStatus = 'todo' | 'current' | 'done'
export interface Step {
  id: string
  client_id: string
  title: string
  note: string | null
  status: StepStatus
  due_date: string | null
  position: number
}
export const DEFAULT_STEPS = [
  'Wprowadzenie do projektu',
  'Brief i materiały',
  'Koncept i key visual',
  'Projekt strony na roboczym podglądzie',
  'Treści i poprawki',
  'Dokumenty prawne',
  'Publikacja strony',
]
export async function listSteps(clientId: string): Promise<Step[]> {
  return must(await sb().from('project_steps').select('*').eq('client_id', clientId).order('position').order('created_at'))
}
export async function saveStep(s: Partial<Step> & { client_id: string; title: string }) {
  const { id, ...rest } = s
  if (id) return must(await sb().from('project_steps').update(rest).eq('id', id))
  return must(await sb().from('project_steps').insert(rest))
}
export async function deleteStep(id: string) {
  must(await sb().from('project_steps').delete().eq('id', id))
}
/** Domyślne etapy (nowi klienci dostają je automatycznie w bazie) */
export async function createDefaultSteps(clientId: string) {
  must(
    await sb()
      .from('project_steps')
      .insert(DEFAULT_STEPS.map((title, i) => ({ client_id: clientId, title, position: i, status: i === 0 ? 'current' : 'todo' }))),
  )
}

/* ---------- zadania w etapach ---------- */

export interface Task {
  id: string
  client_id: string
  step_id: string | null
  title: string
  note: string | null
  due_date: string | null
  done_at: string | null
  position: number
  /** kto wykonuje: klient czy NAFU Design */
  assignee: 'client' | 'nafu'
  /** czy klient widzi zadanie */
  visible: boolean
  /** sprawa bieżąca, do której należy zadanie */
  case_id?: string | null
  created_at: string
}
export async function listTasks(clientId: string): Promise<Task[]> {
  return must(await sb().from('client_tasks').select('*').eq('client_id', clientId).order('position').order('created_at'))
}
export async function addTask(t: Partial<Task> & { client_id: string; title: string }) {
  must(await sb().from('client_tasks').insert(t))
}
export async function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'due_date' | 'step_id' | 'position' | 'assignee' | 'visible' | 'done_at'>>) {
  must(await sb().from('client_tasks').update(patch).eq('id', id))
}
/** Odhaczenie zadania: administratorka dowolne, klient tylko swoje (przez funkcję w bazie) */
export async function toggleTask(t: Task, isAdmin = false) {
  if (isAdmin) return updateTask(t.id, { done_at: t.done_at ? null : new Date().toISOString() })
  must(await sb().rpc('toggle_my_task', { p_task: t.id }))
}
export async function deleteTask(id: string) {
  must(await sb().from('client_tasks').delete().eq('id', id))
}
/** Zamiana miejscami dwóch elementów listy i zapis nowej kolejności */
export async function saveOrder(table: 'project_steps' | 'client_tasks', ids: string[]) {
  await Promise.all(ids.map((id, i) => sb().from(table).update({ position: i }).eq('id', id)))
}

/* ---------- koncept i podgląd ---------- */

export type ReviewStatus = 'pending' | 'approved' | 'changes'
export interface Review {
  id: string
  client_id: string
  kind: 'concept' | 'page'
  title: string
  url: string | null
  file_id: string | null
  note: string | null
  status: ReviewStatus
  decided_at: string | null
  position: number
  created_at: string
  file?: ClientFile | null
}
export interface ReviewComment {
  id: string
  review_id: string
  client_id: string
  from_admin: boolean
  body: string
  file_id: string | null
  resolved: boolean
  created_at: string
  path: string | null
  selector: string | null
  x_pct: number | null
  y_pct: number | null
  page_x: number | null
  page_y: number | null
  viewport: string | null
  pin: number | null
  file?: ClientFile | null
}
export interface PinData {
  path: string
  selector: string
  x_pct: number
  y_pct: number
  page_x: number
  page_y: number
  viewport: string
}

export async function listReviews(clientId: string): Promise<Review[]> {
  return must(await sb().from('reviews').select('*, file:client_files(*)').eq('client_id', clientId).order('kind').order('position').order('created_at'))
}
export async function saveReview(r: Partial<Review> & { client_id: string; kind: Review['kind']; title: string }) {
  const { id, file: _f, ...rest } = r
  void _f
  if (id) return must(await sb().from('reviews').update(rest).eq('id', id))
  return must(await sb().from('reviews').insert(rest))
}
export async function deleteReview(id: string) {
  must(await sb().from('reviews').delete().eq('id', id))
}
export async function addConcept(clientId: string, title: string, file: File, note?: string) {
  const f = await uploadFile(clientId, file, { kind: 'concept' })
  await saveReview({ client_id: clientId, kind: 'concept', title, file_id: f.id, note: note || null })
}
export async function decideReview(id: string, status: ReviewStatus) {
  must(await sb().rpc('decide_review', { p_review: id, p_status: status }))
}
export async function listComments(reviewId: string): Promise<ReviewComment[]> {
  return must(await sb().from('review_comments').select('*, file:client_files(*)').eq('review_id', reviewId).order('created_at'))
}
export async function addComment(
  review: Review,
  body: string,
  fromAdmin: boolean,
  opts: { file?: File; pin?: PinData; pinNo?: number } = {},
) {
  let fileId: string | null = null
  if (opts.file) fileId = (await uploadFile(review.client_id, opts.file, { kind: 'review' })).id
  must(
    await sb()
      .from('review_comments')
      .insert({
        review_id: review.id, client_id: review.client_id, body, from_admin: fromAdmin, file_id: fileId,
        ...(opts.pin ?? {}), pin: opts.pin ? opts.pinNo ?? null : null,
      }),
  )
}
export async function resolveComment(c: ReviewComment) {
  must(await sb().from('review_comments').update({ resolved: !c.resolved }).eq('id', c.id))
}
export async function deleteComment(id: string) {
  must(await sb().from('review_comments').delete().eq('id', id))
}

/* ---------- dostępy (wspólna lista klienta i administratorki) ---------- */

export const ADMIN_EMAIL = 'n.e.jaskiewicz@gmail.com'

export type AccessKind = 'invite' | 'login'
export type AccessStatus = 'todo' | 'done' | 'na'
export interface AccessItem {
  id: string
  client_id: string
  service: string | null
  title: string
  description: string | null
  kind: AccessKind
  status: AccessStatus
  note: string | null
  step_id: string | null
  urgent: boolean
  position: number
  created_by: 'admin' | 'client'
  secret_id: string | null
  /** sprawa bieżąca, do której należy pozycja */
  case_id?: string | null
  created_at: string
}
export interface Credentials {
  url: string
  login: string
  password: string
  notes: string
}

/** Standardowy zestaw, który administratorka dodaje jednym kliknięciem */
export const ACCESS_CATALOG: Array<{ key: string; title: string; kind: AccessKind; description: string }> = [
  {
    key: 'cms',
    title: 'Panel do edycji obecnej strony (CMS)',
    kind: 'login',
    description: 'Adres panelu (np. twojastrona.pl/wp-admin), login i hasło. Potrzebne, żeby zabezpieczyć i przenieść treści z obecnej strony.',
  },
  {
    key: 'google_business',
    title: 'Profil Firmy w Google (wizytówka)',
    kind: 'invite',
    description: `Wejdź na business.google.com i wybierz wizytówkę. Kliknij „Menu” → „Ustawienia profilu firmy” → „Osoby i dostęp” → „Dodaj”. Wpisz ${ADMIN_EMAIL} i wybierz rolę „Menedżer”.`,
  },
  {
    key: 'search_console',
    title: 'Google Search Console',
    kind: 'invite',
    description: `Wejdź na search.google.com/search-console i wybierz stronę. „Ustawienia” → „Użytkownicy i uprawnienia” → „Dodaj użytkownika”. Wpisz ${ADMIN_EMAIL} z uprawnieniami „Pełne”.`,
  },
  {
    key: 'analytics',
    title: 'Google Analytics',
    kind: 'invite',
    description: `Wejdź na analytics.google.com → „Administracja” → „Zarządzanie dostępem do konta” → „+”. Dodaj ${ADMIN_EMAIL} z rolą „Administrator”.`,
  },
  {
    key: 'meta',
    title: 'Facebook i Instagram (Meta Business Suite)',
    kind: 'invite',
    description: `Wejdź na business.facebook.com → „Ustawienia” → „Osoby” → „Dodaj osoby”. Wpisz ${ADMIN_EMAIL} i nadaj dostęp do strony na Facebooku i konta na Instagramie.`,
  },
  {
    key: 'domain',
    title: 'Domena (adres strony)',
    kind: 'login',
    description: 'Firma, w której jest domena (np. home.pl, OVH), i dane do panelu albo informacja, kto nim zarządza.',
  },
  {
    key: 'hosting',
    title: 'Hosting i poczta',
    kind: 'login',
    description: 'Firma, w której jest serwer strony i poczta, oraz dane do panelu hostingu.',
  },
  {
    key: 'booking',
    title: 'System rezerwacji (np. Booksy, ZnanyLekarz)',
    kind: 'login',
    description: 'Nazwa systemu i dane do logowania albo zaproszenie mnie jako współpracownika.',
  },
]

export async function listAccess(clientId: string): Promise<AccessItem[]> {
  return must(await sb().from('access_items').select('*').eq('client_id', clientId).order('urgent', { ascending: false }).order('position').order('created_at'))
}
export async function addAccess(item: Partial<AccessItem> & { client_id: string; title: string }) {
  must(await sb().from('access_items').insert(item))
}
export async function updateAccess(id: string, patch: Partial<Pick<AccessItem, 'title' | 'description' | 'kind' | 'status' | 'note' | 'step_id' | 'urgent' | 'position'>>) {
  must(await sb().from('access_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
}
export async function deleteAccess(id: string) {
  must(await sb().from('access_items').delete().eq('id', id))
}
export async function addAccessFromCatalog(clientId: string, keys: string[], existing: AccessItem[], caseId?: string) {
  const have = new Set(existing.map((e) => e.service))
  const rows = ACCESS_CATALOG.filter((c) => keys.includes(c.key) && !have.has(c.key)).map((c, i) => ({
    client_id: clientId, service: c.key, title: c.title, kind: c.kind, description: c.description, position: existing.length + i,
    ...(caseId ? { case_id: caseId } : {}),
  }))
  if (rows.length) must(await sb().from('access_items').insert(rows))
}
/** Dane logowania: zapis i odczyt z zaszyfrowanego sejfu (Supabase Vault) */
export async function getCredentials(id: string): Promise<Credentials | null> {
  return must(await sb().rpc('get_access_credentials', { p_item: id }))
}
export async function setCredentials(id: string, c: Credentials) {
  must(await sb().rpc('set_access_credentials', { p_item: id, p_url: c.url, p_login: c.login, p_password: c.password, p_notes: c.notes }))
}
export async function clearCredentials(id: string) {
  must(await sb().rpc('clear_access_credentials', { p_item: id }))
}

/* ---------- dokumenty ---------- */

export interface ClientDocument {
  id: string
  client_id: string
  title: string
  note: string | null
  /** tylko dla administratorki (osobna tabela document_notes) */
  admin_note?: string | null
  file_id: string | null
  content: string | null
  kind: string
  visible: boolean
  /** sprawa bieżąca, do której należy dokument */
  case_id?: string | null
  requires_acceptance: boolean
  accepted_at: string | null
  /** kto dodał: true pracownia, false klient (ustawia baza) */
  from_admin?: boolean
  created_at: string
  updated_at: string
  file?: ClientFile | null
}
/** Kategorie dokumentów (pole kind). Kolejność = kolejność w menu kategorii. */
export const DOC_KINDS = ['contract', 'agreement', 'legal', 'report', 'invoice', 'mail', 'evidence', 'other'] as const
export type DocKind = (typeof DOC_KINDS)[number]
/** kategorie, które może wybrać klient, dodając własny dokument do sprawy */
export const CLIENT_DOC_KINDS: DocKind[] = ['agreement', 'invoice', 'mail', 'evidence', 'other']
export const docKind = (k: string): DocKind => ((DOC_KINDS as readonly string[]).includes(k) ? (k as DocKind) : 'other')
/** Nazwa kategorii. W sprawie umowy z pracownią mają własną sekcję, więc „Umowy” oznaczają tam umowy z innymi firmami. */
export function docKindLabel(k: string, opts: { isAdmin: boolean; inCase: boolean }): string {
  switch (docKind(k)) {
    case 'contract': return opts.isAdmin ? 'Umowy z klientem' : 'Umowy z Natalią'
    case 'agreement': return opts.inCase ? 'Umowy' : 'Umowy z innymi firmami'
    case 'legal': return 'Dokumenty prawne'
    case 'report': return 'Raporty i opracowania'
    case 'invoice': return 'Faktury i rozliczenia'
    case 'mail': return 'Korespondencja'
    case 'evidence': return 'Dowody'
    default: return 'Inne'
  }
}
export async function listDocuments(clientId: string): Promise<ClientDocument[]> {
  return must(await sb().from('client_documents').select('*, file:client_files(*)').eq('client_id', clientId).order('created_at', { ascending: false }))
}
export async function addDocument(
  clientId: string,
  title: string,
  file: File,
  opts: { requiresAcceptance: boolean; visible: boolean; note?: string; caseId?: string; kind?: string },
) {
  const f = await uploadFile(clientId, file, { kind: 'document' })
  must(
    await sb()
      .from('client_documents')
      .insert({
        client_id: clientId, title, file_id: f.id, requires_acceptance: opts.requiresAcceptance, visible: opts.visible, note: opts.note || null,
        ...(opts.caseId ? { case_id: opts.caseId } : {}),
        ...(opts.kind ? { kind: opts.kind } : {}),
      }),
  )
}
/** Administratorka: notatki wewnętrzne do dokumentów klienta */
export async function listDocumentNotes(clientId: string): Promise<Record<string, string>> {
  const { data } = await sb().from('document_notes').select('document_id, body').eq('client_id', clientId)
  return Object.fromEntries((data ?? []).map((n: { document_id: string; body: string }) => [n.document_id, n.body]))
}
/** Administratorka: zapis (dodanie lub zmiana) i usunięcie notatki wewnętrznej do dokumentu */
export async function saveDocumentNote(doc: Pick<ClientDocument, 'id' | 'client_id'>, body: string) {
  must(
    await sb()
      .from('document_notes')
      .upsert({ document_id: doc.id, client_id: doc.client_id, body, updated_at: new Date().toISOString() }, { onConflict: 'document_id' }),
  )
}
export async function deleteDocumentNote(docId: string) {
  must(await sb().from('document_notes').delete().eq('document_id', docId))
}
export async function updateDocument(id: string, patch: Partial<Pick<ClientDocument, 'title' | 'note' | 'content' | 'visible' | 'requires_acceptance' | 'kind'>>) {
  must(await sb().from('client_documents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
}
export async function acceptDocument(id: string) {
  must(await sb().rpc('accept_document', { p_doc: id }))
}
export async function deleteDocument(id: string) {
  must(await sb().from('client_documents').delete().eq('id', id))
}
