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

/* ---------- zadania dla klienta ---------- */

export interface Task {
  id: string
  client_id: string
  title: string
  note: string | null
  due_date: string | null
  done_at: string | null
  created_at: string
}
export async function listTasks(clientId: string): Promise<Task[]> {
  return must(await sb().from('client_tasks').select('*').eq('client_id', clientId).order('done_at', { nullsFirst: true }).order('created_at'))
}
export async function addTask(clientId: string, title: string, note?: string, due?: string) {
  must(await sb().from('client_tasks').insert({ client_id: clientId, title, note: note || null, due_date: due || null }))
}
export async function toggleTask(t: Task) {
  must(await sb().from('client_tasks').update({ done_at: t.done_at ? null : new Date().toISOString() }).eq('id', t.id))
}
export async function deleteTask(id: string) {
  must(await sb().from('client_tasks').delete().eq('id', id))
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

/* ---------- dostępy do kont ---------- */

export interface AccessService {
  key: string
  name: string
  why: string
  how: string[]
}
export const ADMIN_EMAIL = 'n.e.jaskiewicz@gmail.com'
export const ACCESS_SERVICES: AccessService[] = [
  {
    key: 'google_business',
    name: 'Profil Firmy w Google (wizytówka)',
    why: 'Żeby zadbać o wizytówkę w Mapach Google: zdjęcia, godziny, wpisy i odpowiedzi na opinie.',
    how: [
      'Wejdź na business.google.com i wybierz swoją wizytówkę.',
      'Kliknij „Menu” (trzy kropki) → „Ustawienia profilu firmy” → „Osoby i dostęp”.',
      `Kliknij „Dodaj”, wpisz ${ADMIN_EMAIL} i wybierz rolę „Menedżer”.`,
    ],
  },
  {
    key: 'search_console',
    name: 'Google Search Console',
    why: 'Żeby przenieść stronę bez utraty pozycji w Google i śledzić widoczność.',
    how: [
      'Wejdź na search.google.com/search-console i wybierz swoją stronę.',
      'Kliknij „Ustawienia” → „Użytkownicy i uprawnienia” → „Dodaj użytkownika”.',
      `Wpisz ${ADMIN_EMAIL} i wybierz uprawnienia „Pełne”.`,
    ],
  },
  {
    key: 'analytics',
    name: 'Google Analytics',
    why: 'Żeby zachować statystyki odwiedzin i porównać wyniki po starcie nowej strony.',
    how: [
      'Wejdź na analytics.google.com, kliknij „Administracja” (koło zębate na dole).',
      'W kolumnie „Konto” wybierz „Zarządzanie dostępem do konta” i kliknij „+”.',
      `Dodaj ${ADMIN_EMAIL} z rolą „Administrator”.`,
    ],
  },
  {
    key: 'meta',
    name: 'Facebook i Instagram (Meta Business Suite)',
    why: 'Żeby połączyć stronę z profilami i przygotować spójne treści.',
    how: [
      'Wejdź na business.facebook.com → „Ustawienia” → „Osoby”.',
      `Kliknij „Dodaj osoby”, wpisz ${ADMIN_EMAIL} i nadaj dostęp do strony na Facebooku i konta na Instagramie.`,
      'Jeśli nie używasz Meta Business Suite, napisz do mnie, podpowiem inną drogę.',
    ],
  },
  {
    key: 'domain',
    name: 'Domena (adres strony)',
    why: 'Żeby podłączyć nową stronę pod Twój adres bez przerwy w działaniu strony i poczty.',
    how: [
      'Sprawdź, w jakiej firmie jest Twoja domena (np. home.pl, OVH, nazwa.pl).',
      'W panelu tej firmy poszukaj opcji „Dostęp dla innej osoby”, „Delegacja” albo „Konto techniczne”.',
      'Jeśli takiej opcji nie ma, napisz w Wiadomościach, ustalimy razem bezpieczny sposób. Nie wysyłaj hasła mailem.',
    ],
  },
  {
    key: 'hosting',
    name: 'Hosting i poczta',
    why: 'Żeby przenieść pocztę i stronę bez utraty wiadomości.',
    how: [
      'Sprawdź, gdzie jest Twoja poczta firmowa i obecna strona.',
      'W panelu hostingu poszukaj opcji dodania użytkownika lub dostępu technicznego.',
      'Jeśli jej nie ma, napisz w Wiadomościach, dobierzemy bezpieczny sposób.',
    ],
  },
  {
    key: 'booking',
    name: 'System rezerwacji (np. Booksy, ZnanyLekarz)',
    why: 'Żeby połączyć rezerwacje ze stroną.',
    how: [
      'Jeśli korzystasz z systemu rezerwacji, wpisz w notatce jego nazwę.',
      'Większość systemów pozwala dodać pracownika lub współpracownika. Dodaj mnie z adresem ' + ADMIN_EMAIL + ' albo napisz, zrobimy to razem.',
    ],
  },
]
export interface AccessItem {
  id: string
  client_id: string
  service: string
  status: 'todo' | 'done' | 'na'
  note: string | null
}
export async function listAccess(clientId: string): Promise<AccessItem[]> {
  return must(await sb().from('access_items').select('*').eq('client_id', clientId))
}
export async function setAccess(clientId: string, service: string, patch: Partial<Pick<AccessItem, 'status' | 'note'>>) {
  must(
    await sb()
      .from('access_items')
      .upsert({ client_id: clientId, service, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'client_id,service' }),
  )
}

/* ---------- dokumenty ---------- */

export interface ClientDocument {
  id: string
  client_id: string
  title: string
  note: string | null
  file_id: string | null
  content: string | null
  kind: string
  visible: boolean
  requires_acceptance: boolean
  accepted_at: string | null
  created_at: string
  updated_at: string
  file?: ClientFile | null
}
export async function listDocuments(clientId: string): Promise<ClientDocument[]> {
  return must(await sb().from('client_documents').select('*, file:client_files(*)').eq('client_id', clientId).order('created_at', { ascending: false }))
}
export async function addDocument(
  clientId: string,
  title: string,
  file: File,
  opts: { requiresAcceptance: boolean; visible: boolean; note?: string },
) {
  const f = await uploadFile(clientId, file, { kind: 'document' })
  must(
    await sb()
      .from('client_documents')
      .insert({ client_id: clientId, title, file_id: f.id, requires_acceptance: opts.requiresAcceptance, visible: opts.visible, note: opts.note || null }),
  )
}
export async function updateDocument(id: string, patch: Partial<Pick<ClientDocument, 'title' | 'note' | 'content' | 'visible' | 'requires_acceptance'>>) {
  must(await sb().from('client_documents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
}
export async function acceptDocument(id: string) {
  must(await sb().rpc('accept_document', { p_doc: id }))
}
export async function deleteDocument(id: string) {
  must(await sb().from('client_documents').delete().eq('id', id))
}
