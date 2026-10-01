// Strefa klienta: profil, pliki, zespół, usługi, wiadomości.
// Te same funkcje służą klientowi (swoje dane) i administratorce (kartoteka klienta) - dostęp pilnuje RLS.
import { supabase } from './supabase'

const sb = () => {
  if (!supabase) throw new Error('Ta funkcja działa po podłączeniu Supabase.')
  return supabase
}
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}
const BUCKET = 'client-files'

/* ---------- profil ---------- */

export interface Company {
  id: string
  name: string
  industry: string
  nip: string
  regon: string
  address: string
  invoice_name: string
  invoice_address: string
  invoice_email: string
  notes: string
}
export interface Location {
  id: string
  name: string
  address: string
  phone: string
  email: string
  hours: string
  accessibility: string
}
export interface LinkItem {
  label: string
  url: string
}
export interface ProfileData {
  contact_person?: string
  contact_role?: string
  contact_phone?: string
  contact_email?: string
  companies?: Company[]
  locations?: Location[]
  website?: string
  facebook?: string
  instagram?: string
  tiktok?: string
  linkedin?: string
  youtube?: string
  google_business?: string
  booking?: string
  other_links?: LinkItem[]
}

export const newId = () => crypto.randomUUID()

export async function getProfile(clientId: string): Promise<ProfileData> {
  const { data } = await sb().from('client_profiles').select('data').eq('client_id', clientId).maybeSingle()
  return ((data?.data as ProfileData) ?? {}) as ProfileData
}
export async function saveProfile(clientId: string, data: ProfileData) {
  must(await sb().from('client_profiles').upsert({ client_id: clientId, data, updated_at: new Date().toISOString() }))
}

/* ---------- pliki ---------- */

export type FileKind = 'media' | 'team' | 'certificate' | 'message' | 'concept' | 'review' | 'document' | 'case'
export interface ClientFile {
  id: string
  client_id: string
  kind: FileKind
  category: string | null
  name: string
  path: string | null
  url: string | null
  mime: string | null
  size: number | null
  note: string | null
  member_id: string | null
  created_at: string
}

export const MEDIA_CATEGORIES = [
  'Logo i identyfikacja',
  'Zdjęcia salonu',
  'Zdjęcia zespołu',
  'Zdjęcia produktów',
  'Realizacje i klienci',
  'Wideo',
  'Dokumenty',
  'Dyplomy i nagrody',
  'Inne',
]

const safeName = (n: string) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^\w.-]+/g, '_').slice(-80)

export async function uploadFile(
  clientId: string,
  file: File,
  opts: { kind: FileKind; category?: string; memberId?: string; note?: string } = { kind: 'media' },
): Promise<ClientFile> {
  if (file.size > 50 * 1024 * 1024) throw new Error(`Plik „${file.name}” ma ponad 50 MB. Duże filmy dodaj jako link (np. Dysk Google, WeTransfer).`)
  const path = `${clientId}/${opts.kind}/${newId()}-${safeName(file.name)}`
  const up = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (up.error) throw new Error(up.error.message)
  return must(
    await sb()
      .from('client_files')
      .insert({
        client_id: clientId, kind: opts.kind, category: opts.category ?? null, name: file.name, path,
        mime: file.type || null, size: file.size, note: opts.note ?? null, member_id: opts.memberId ?? null,
      })
      .select()
      .single(),
  )
}

export async function addLink(clientId: string, name: string, url: string, category?: string, note?: string): Promise<ClientFile> {
  return must(
    await sb()
      .from('client_files')
      .insert({ client_id: clientId, kind: 'media', category: category ?? null, name, url, note: note ?? null })
      .select()
      .single(),
  )
}

export async function listFiles(clientId: string, kind?: FileKind, memberId?: string): Promise<ClientFile[]> {
  let q = sb().from('client_files').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (kind) q = q.eq('kind', kind)
  if (memberId) q = q.eq('member_id', memberId)
  return must(await q)
}

export async function updateFile(id: string, patch: Partial<Pick<ClientFile, 'category' | 'note' | 'name'>>) {
  must(await sb().from('client_files').update(patch).eq('id', id))
}

export async function deleteFile(f: ClientFile) {
  if (f.path) await sb().storage.from(BUCKET).remove([f.path])
  must(await sb().from('client_files').delete().eq('id', f.id))
}

/** Tymczasowe linki do plików (ważne godzinę) */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const list = paths.filter(Boolean)
  if (!list.length) return {}
  const { data } = await sb().storage.from(BUCKET).createSignedUrls(list, 3600)
  const out: Record<string, string> = {}
  data?.forEach((d) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  })
  return out
}

export async function uploadPhoto(clientId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Wybierz plik ze zdjęciem.')
  const path = `${clientId}/team/${newId()}-${safeName(file.name)}`
  const up = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (up.error) throw new Error(up.error.message)
  return path
}

/* ---------- zespół ---------- */

export interface ScheduleRow {
  location: string
  days: string[]
  from: string
  to: string
}
export interface TeamMember {
  id: string
  client_id: string
  name: string
  role: string | null
  photo_path: string | null
  bio: string | null
  qualifications: string | null
  specializations: string | null
  services: string | null
  schedule: ScheduleRow[]
  position: number
}
export const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']

export async function listTeam(clientId: string): Promise<TeamMember[]> {
  return must(await sb().from('team_members').select('*').eq('client_id', clientId).order('position').order('created_at'))
}
export async function saveMember(m: Partial<TeamMember> & { client_id: string; name: string }): Promise<TeamMember> {
  const { id, ...rest } = m
  if (id) return must(await sb().from('team_members').update(rest).eq('id', id).select().single())
  return must(await sb().from('team_members').insert(rest).select().single())
}
export async function deleteMember(m: TeamMember) {
  if (m.photo_path) await sb().storage.from(BUCKET).remove([m.photo_path])
  const certs = await listFiles(m.client_id, 'certificate', m.id)
  for (const c of certs) await deleteFile(c)
  must(await sb().from('team_members').delete().eq('id', m.id))
}

/* ---------- usługi ---------- */

export interface Service {
  id: string
  client_id: string
  name: string
  category: string | null
  description: string | null
  duration_min: number | null
  price: string | null
  locations: string[]
  show_on_site: boolean
  show_in_calendar: boolean
  position: number
}
export async function listServices(clientId: string): Promise<Service[]> {
  return must(await sb().from('services').select('*').eq('client_id', clientId).order('position').order('created_at'))
}
export async function saveService(s: Partial<Service> & { client_id: string; name: string }): Promise<Service> {
  const { id, ...rest } = s
  if (id) return must(await sb().from('services').update(rest).eq('id', id).select().single())
  return must(await sb().from('services').insert(rest).select().single())
}
export async function deleteService(id: string) {
  must(await sb().from('services').delete().eq('id', id))
}

/* ---------- wiadomości ---------- */

export interface Message {
  id: string
  client_id: string
  author_id: string
  from_admin: boolean
  body: string
  file_id: string | null
  read_at: string | null
  created_at: string
  file?: ClientFile | null
}
export async function listMessages(clientId: string): Promise<Message[]> {
  return must(
    await sb().from('messages').select('*, file:client_files(*)').eq('client_id', clientId).order('created_at', { ascending: true }),
  )
}
export async function sendMessage(clientId: string, body: string, fromAdmin: boolean, file?: File) {
  let fileId: string | null = null
  if (file) fileId = (await uploadFile(clientId, file, { kind: 'message' })).id
  must(await sb().from('messages').insert({ client_id: clientId, body, from_admin: fromAdmin, file_id: fileId }))
}
/** Oznacz jako przeczytane wiadomości od drugiej strony */
export async function markRead(clientId: string, iAmAdmin: boolean) {
  await sb()
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('from_admin', !iAmAdmin)
    .is('read_at', null)
}
export async function unreadCount(clientId: string, iAmAdmin: boolean): Promise<number> {
  const { count } = await sb()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('from_admin', !iAmAdmin)
    .is('read_at', null)
  return count ?? 0
}

export const fmtSize = (b: number | null) =>
  b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
