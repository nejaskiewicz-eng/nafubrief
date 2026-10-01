// Sprawy bieżące: temat prowadzony z klientem od założenia do akceptacji i zamknięcia.
// Do sprawy podpinamy ankiety, dokumenty, zadania i dostępy (kolumna case_id) i prowadzimy w niej rozmowę.
import { supabase } from './supabase'
import type { Brief } from './types'
import { uploadFile, type ClientFile } from './workspace'
import type { AccessItem, ClientDocument, Task } from './project'

const sb = () => {
  if (!supabase) throw new Error('Ta funkcja działa po podłączeniu Supabase.')
  return supabase
}
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message === 'not_found' ? 'Nie można wykonać tej operacji w obecnym stanie sprawy.' : res.error.message)
  return res.data as T
}

export type CaseStatus = 'open' | 'review' | 'closed'
export interface Case {
  id: string
  client_id: string
  title: string
  description: string | null
  status: CaseStatus
  created_by: 'admin' | 'client'
  author_id: string
  due_date: string | null
  summary: string | null
  accepted_at: string | null
  closed_at: string | null
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
  closed: 'Zamknięta',
}
export const CASE_BADGE: Record<CaseStatus, string> = { open: 'in_progress', review: 'urgent', closed: 'submitted' }

export async function listCases(clientId: string): Promise<Case[]> {
  return must(await sb().from('cases').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }))
}
export async function createCase(c: { client_id: string; title: string; description?: string | null; due_date?: string | null; created_by: 'admin' | 'client' }): Promise<Case> {
  return must(await sb().from('cases').insert(c).select().single())
}
export async function updateCase(id: string, patch: Partial<Pick<Case, 'title' | 'description' | 'due_date' | 'summary' | 'status' | 'closed_at'>>) {
  must(await sb().from('cases').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
}
export async function deleteCase(id: string) {
  must(await sb().from('cases').delete().eq('id', id))
}
/** Administratorka: podsumowanie i prośba o akceptację */
export async function requestAcceptance(id: string, summary: string) {
  await updateCase(id, { summary, status: 'review' })
}
/** Klient (albo administratorka w jego imieniu po rozmowie) akceptuje: sprawa się zamyka */
export async function acceptCase(id: string) {
  must(await sb().rpc('accept_case', { p_case: id }))
}
/** Klient zgłasza poprawki przed akceptacją: sprawa wraca do toku, uwaga trafia do rozmowy */
export async function returnCase(id: string, reason: string) {
  must(await sb().rpc('return_case', { p_case: id, p_reason: reason }))
}
export async function closeCase(id: string) {
  await updateCase(id, { status: 'closed', closed_at: new Date().toISOString() })
}
export async function reopenCase(id: string) {
  await updateCase(id, { status: 'open', closed_at: null })
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
