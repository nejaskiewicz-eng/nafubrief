// Sprawy bieżące: temat prowadzony z klientem od założenia do akceptacji i zamknięcia.
// Do sprawy podpinamy ankiety, dokumenty, zadania i dostępy (kolumna case_id) i prowadzimy w niej rozmowę.
// Klient może zaakceptować sprawę; zamyka ją zawsze administratorka, z podsumowaniem dla klienta.
import { supabase } from './supabase'
import type { Brief } from './types'
import { addLink, uploadFile, type ClientFile } from './workspace'
import type { AccessItem, ClientDocument, Task } from './project'

const sb = () => {
  if (!supabase) throw new Error('Ta funkcja działa po podłączeniu Supabase.')
  return supabase
}
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message === 'not_found' ? 'Nie można wykonać tej operacji w obecnym stanie sprawy.' : res.error.message)
  return res.data as T
}

export type CaseStatus = 'open' | 'review' | 'accepted' | 'closed'
export type CasePriority = 'normal' | 'important' | 'urgent' | 'very_urgent'
/** Sekcje, które można włączyć w sprawie (kolejność = kolejność w widoku sprawy) */
export type CaseSection = 'tasks' | 'tips' | 'briefs' | 'contracts' | 'documents' | 'access' | 'media' | 'chat' | 'closing'
export const SECTIONS: Array<{ key: CaseSection; label: string; hint: string }> = [
  { key: 'tasks', label: 'Zadania', hint: 'zadania z terminem dla klienta i dla Ciebie' },
  { key: 'tips', label: 'Zalecenia i porady', hint: 'co klient powinien zrobić lub wiedzieć' },
  { key: 'briefs', label: 'Ankiety i pytania', hint: 'pytania w formie ankiety' },
  { key: 'contracts', label: 'Umowy', hint: 'umowy do przeczytania i akceptacji' },
  { key: 'documents', label: 'Dokumenty', hint: 'dokumenty do przeczytania i akceptacji' },
  { key: 'access', label: 'Dostępy', hint: 'dostępy, które klient przekazuje' },
  { key: 'media', label: 'Zdjęcia, wideo i linki', hint: 'materiały wizualne i linki istotne dla sprawy' },
  { key: 'chat', label: 'Rozmowa', hint: 'wiadomości tylko w tej sprawie' },
  { key: 'closing', label: 'Akceptacja i zamknięcie', hint: 'prośba o akceptację, podsumowanie, zamknięcie' },
]
export const PRIORITY_LABEL: Record<CasePriority, string> = { normal: 'Zwykła', important: 'Ważne', urgent: 'Pilne', very_urgent: 'Bardzo pilne' }
/** Rodzaj sprawy = szablon startowy: sekcje i (opcjonalnie) zadania-szkice. Wszystko można potem zmienić w samej sprawie. */
export interface CaseType {
  key: string
  label: string
  hint: string
  sections: CaseSection[]
  /** zadania dodawane jako ukryte szkice, do dopracowania przed pokazaniem klientowi */
  tasks?: Array<{ title: string; note: string; assignee: 'client' | 'nafu' }>
}
export const CASE_TYPES: CaseType[] = [
  { key: 'brand', label: 'Identyfikacja wizualna', hint: 'logo, kolory, typografia, księga znaku', sections: ['tasks', 'briefs', 'documents', 'media', 'chat', 'closing'] },
  { key: 'website', label: 'Strona internetowa', hint: 'projekt i wykonanie strony', sections: ['tasks', 'briefs', 'contracts', 'documents', 'access', 'media', 'chat', 'closing'] },
  { key: 'website_mech', label: 'Strona internetowa: mechanizm', hint: 'funkcje i mechanizmy strony', sections: ['tasks', 'briefs', 'documents', 'access', 'chat', 'closing'] },
  { key: 'mentoring', label: 'Mentoring', hint: 'spotkania, zalecenia, zadania do wykonania', sections: ['tasks', 'tips', 'documents', 'chat', 'closing'] },
  { key: 'graphics', label: 'Projekty graficzne', hint: 'materiały drukowane i cyfrowe', sections: ['tasks', 'briefs', 'media', 'documents', 'chat', 'closing'] },
  {
    key: 'audit', label: 'Audyt', hint: 'sprawdzenie działań, dowody, raport', sections: ['tasks', 'briefs', 'documents', 'access', 'media', 'chat', 'closing'],
    tasks: [
      { title: 'Umowa z wykonawcą i aneksy', note: 'Dodaj w sekcji Dokumenty tej sprawy skan albo zdjęcia umowy, razem z aneksami i ofertą sprzed podpisania.', assignee: 'client' },
      { title: 'Faktury od wykonawcy z całego okresu współpracy', note: 'Dodaj w sekcji Dokumenty tej sprawy wszystkie faktury od początku współpracy.', assignee: 'client' },
      { title: 'Raporty i wiadomości od wykonawcy', note: 'Dodaj w sekcji Dokumenty tej sprawy raporty, zestawienia i ważne wiadomości.', assignee: 'client' },
    ],
  },
  { key: 'social', label: 'Wsparcie SM w pojedynczej sprawie', hint: 'media społecznościowe, jedna konkretna potrzeba', sections: ['tasks', 'tips', 'access', 'media', 'chat', 'closing'] },
  { key: 'ai', label: 'Wdrożenie AI', hint: 'narzędzia i automatyzacje z AI', sections: ['tasks', 'briefs', 'tips', 'documents', 'access', 'chat', 'closing'] },
  { key: 'project', label: 'Prowadzenie projektu', hint: 'koordynacja większego przedsięwzięcia', sections: ['tasks', 'tips', 'documents', 'media', 'chat', 'closing'] },
  { key: 'event', label: 'Organizacja eventu', hint: 'wydarzenie od planu do realizacji', sections: ['tasks', 'briefs', 'documents', 'media', 'chat', 'closing'] },
  { key: 'current', label: 'Sprawa bieżąca', hint: 'pojedynczy temat do załatwienia', sections: ['tasks', 'documents', 'chat', 'closing'] },
  { key: 'other', label: 'Inne', hint: 'własna nazwa rodzaju sprawy', sections: ['tasks', 'briefs', 'documents', 'access', 'chat', 'closing'] },
]
export const caseType = (key?: string | null) => CASE_TYPES.find((t) => t.key === key)
/** Nazwa rodzaju sprawy do pokazania (przy „Inne” własna nazwa) */
export const caseTypeLabel = (c: { type?: string | null; type_label?: string | null }) =>
  c.type === 'other' ? c.type_label?.trim() || 'Inne' : caseType(c.type)?.label ?? ''

export interface Case {
  id: string
  client_id: string
  title: string
  description: string | null
  /** rodzaj sprawy (klucz z CASE_TYPES) i własna nazwa przy „Inne” */
  type?: string | null
  type_label?: string | null
  status: CaseStatus
  /** kategoria pilności */
  priority: CasePriority
  /** włączone sekcje */
  sections: CaseSection[]
  created_by: 'admin' | 'client'
  author_id: string
  due_date: string | null
  summary: string | null
  accepted_at: string | null
  closed_at: string | null
  /** ostatnie powiadomienie e-mail z prośbą o dołączenie do sprawy */
  invited_at: string | null
  created_at: string
  updated_at: string
}
export interface CaseMessage {
  id: string
  case_id: string
  client_id: string
  author_id: string
  from_admin: boolean
  body: string
  file_id: string | null
  edited_at: string | null
  read_at: string | null
  created_at: string
  file?: ClientFile | null
}
export const CASE_STATUS: Record<CaseStatus, string> = {
  open: 'W toku',
  review: 'Czeka na akceptację',
  accepted: 'Zaakceptowana',
  closed: 'Zamknięta',
}
export const CASE_BADGE: Record<CaseStatus, string> = { open: 'in_progress', review: 'urgent', accepted: 'sent', closed: 'submitted' }

export async function listCases(clientId: string): Promise<Case[]> {
  return must(await sb().from('cases').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }))
}
export async function createCase(c: { client_id: string; title: string; description?: string | null; due_date?: string | null; priority?: CasePriority; created_by: 'admin' | 'client'; type?: string | null; type_label?: string | null; sections?: CaseSection[] }): Promise<Case> {
  return must(await sb().from('cases').insert(c).select().single())
}
export async function updateCase(id: string, patch: Partial<Pick<Case, 'title' | 'description' | 'due_date' | 'priority' | 'sections' | 'summary' | 'status' | 'closed_at' | 'accepted_at' | 'type' | 'type_label'>>) {
  must(await sb().from('cases').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
}
export async function deleteCase(id: string) {
  must(await sb().from('cases').delete().eq('id', id))
}
/** Administratorka prosi klienta o akceptację */
export async function requestAcceptance(id: string) {
  await updateCase(id, { status: 'review' })
}
/** Klient akceptuje; sprawa czeka na zamknięcie przez administratorkę */
export async function acceptCase(id: string) {
  must(await sb().rpc('accept_case', { p_case: id }))
}
/** Klient zgłasza poprawki przed akceptacją: sprawa wraca do toku, uwaga trafia do rozmowy */
export async function returnCase(id: string, reason: string) {
  must(await sb().rpc('return_case', { p_case: id, p_reason: reason }))
}
/** Zamyka zawsze administratorka, z podsumowaniem dla klienta */
export async function closeCase(id: string, summary: string) {
  await updateCase(id, { summary, status: 'closed', closed_at: new Date().toISOString() })
}
export async function reopenCase(id: string) {
  await updateCase(id, { status: 'open', closed_at: null, accepted_at: null })
}

/* ---------- elementy sprawy ---------- */

export interface CaseItems {
  briefs: Brief[]
  documents: ClientDocument[]
  tasks: Task[]
  access: AccessItem[]
}
export async function listCaseItems(caseId: string): Promise<CaseItems> {
  const [briefs, documents, tasks, access] = await Promise.all([
    sb().from('briefs').select('*').eq('case_id', caseId).order('created_at'),
    sb().from('client_documents').select('*, file:client_files(*)').eq('case_id', caseId).order('created_at'),
    sb().from('client_tasks').select('*').eq('case_id', caseId).order('position').order('created_at'),
    sb().from('access_items').select('*').eq('case_id', caseId).order('urgent', { ascending: false }).order('created_at'),
  ])
  return { briefs: must(briefs), documents: must(documents), tasks: must(tasks), access: must(access) }
}
export type ItemTable = 'briefs' | 'client_documents' | 'client_tasks' | 'access_items'
/** Podpięcie istniejącego elementu do sprawy albo odpięcie (caseId = null) */
export async function linkItem(table: ItemTable, id: string, caseId: string | null) {
  must(await sb().from(table).update({ case_id: caseId }).eq('id', id))
}
/** Nowa ankieta z własnymi pytaniami (szkic, pytania dodaje się w edytorze ankiety) */
export async function addCaseBrief(clientId: string, caseId: string, title: string): Promise<Brief> {
  return must(
    await sb()
      .from('briefs')
      .insert({
        client_id: clientId, case_id: caseId, template_key: 'custom', title, description: null, intro: null, status: 'draft', position: 99,
        schema: { sections: [{ id: 's1', title, questions: [] }] },
      })
      .select()
      .single(),
  )
}

/* ---------- rozmowa ---------- */

export async function listCaseMessages(caseId: string): Promise<CaseMessage[]> {
  return must(await sb().from('case_messages').select('*, file:client_files(*)').eq('case_id', caseId).order('created_at'))
}
export async function sendCaseMessage(c: Case, body: string, fromAdmin: boolean, file?: File) {
  let fileId: string | null = null
  if (file) fileId = (await uploadFile(c.client_id, file, { kind: 'message' })).id
  must(await sb().from('case_messages').insert({ case_id: c.id, client_id: c.client_id, body, from_admin: fromAdmin, file_id: fileId }))
}
export async function editCaseMessage(id: string, body: string) {
  must(await sb().from('case_messages').update({ body }).eq('id', id))
}
export async function deleteCaseMessage(id: string) {
  must(await sb().from('case_messages').delete().eq('id', id))
}
export async function markCaseRead(caseId: string) {
  await sb().rpc('mark_case_read', { p_case: caseId })
}
/** Nieprzeczytane wiadomości od drugiej strony, osobno dla każdej sprawy */
export async function caseUnread(clientId: string, iAmAdmin: boolean): Promise<Record<string, number>> {
  const { data } = await sb()
    .from('case_messages')
    .select('case_id')
    .eq('client_id', clientId)
    .eq('from_admin', !iAmAdmin)
    .is('read_at', null)
  const out: Record<string, number> = {}
  ;(data ?? []).forEach((r: { case_id: string }) => (out[r.case_id] = (out[r.case_id] ?? 0) + 1))
  return out
}

/** E-mail do klienta z prośbą o dołączenie do sprawy (funkcja Netlify, wysyłka przez Resend) */
export async function inviteToCase(caseId: string, note: string, test = false, reminder = false): Promise<string> {
  const { data } = await sb().auth.getSession()
  const res = await fetch('/.netlify/functions/case-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ caseId, note, test, reminder }),
  })
  const out = (await res.json().catch(() => ({}))) as { error?: string; to?: string }
  if (!res.ok) throw new Error(out.error ?? `Błąd ${res.status}`)
  return out.to ?? ''
}

/* ---------- zalecenia i porady ---------- */

export interface CaseTip {
  id: string
  case_id: string
  client_id: string
  title: string
  body: string | null
  done_at: string | null
  position: number
  created_at: string
}
export async function listTips(caseId: string): Promise<CaseTip[]> {
  return must(await sb().from('case_tips').select('*').eq('case_id', caseId).order('position').order('created_at'))
}
export async function saveTip(t: Partial<CaseTip> & { case_id: string; client_id: string; title: string }) {
  const { id, ...rest } = t
  if (id) return must(await sb().from('case_tips').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id))
  return must(await sb().from('case_tips').insert(rest))
}
export async function deleteTip(id: string) {
  must(await sb().from('case_tips').delete().eq('id', id))
}
export async function toggleTip(id: string) {
  must(await sb().rpc('toggle_case_tip', { p_tip: id }))
}

/* ---------- zdjęcia, wideo i linki w sprawie ---------- */

export async function listCaseMedia(caseId: string): Promise<ClientFile[]> {
  return must(await sb().from('client_files').select('*').eq('case_id', caseId).order('created_at', { ascending: false }))
}
export async function addCaseFile(c: Case, file: File, note?: string) {
  const f = await uploadFile(c.client_id, file, { kind: 'case', note })
  must(await sb().from('client_files').update({ case_id: c.id }).eq('id', f.id))
}
export async function addCaseLink(c: Case, name: string, url: string, note?: string) {
  const f = await addLink(c.client_id, name, url, undefined, note)
  must(await sb().from('client_files').update({ case_id: c.id, kind: 'case' }).eq('id', f.id))
}
