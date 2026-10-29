// Link do wgrywania mediów dla firmy zewnętrznej (bez konta). Dostęp daje sam token z linku:
// tylko baza mediów jednego klienta i tylko pliki wgrane tym linkiem.
// Wymaga zmiennej SUPABASE_SECRET_KEY (klucz „secret” / service_role z Supabase), wyłącznie po stronie serwera.
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

type Body = {
  token?: string
  action?: 'info' | 'sign' | 'add' | 'update' | 'delete'
  name?: string
  path?: string
  category?: string | null
  id?: string
}

const BUCKET = 'client-files'
const MAX = 5 * 1024 * 1024 * 1024

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
})

const safeName = (n: string) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^\w.-]+/g, '_').slice(-80)

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metoda niedozwolona' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) return json(500, { error: 'Brak konfiguracji Supabase.' })

  let body: Body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Nieprawidłowe dane.' })
  }
  if (!body.token || !/^[a-f0-9]{64}$/.test(body.token)) return json(404, { error: 'Ten link jest nieprawidłowy.' })

  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: link } = await db
    .from('media_links')
    .select('id, client_id, label, expires_at, revoked_at, clients(name, company)')
    .eq('token', body.token)
    .maybeSingle()
  if (!link || link.revoked_at) return json(404, { error: 'Ten link jest nieaktywny. Poproś o nowy.' })
  if (link.expires_at && new Date(link.expires_at) < new Date()) return json(410, { error: 'Ten link wygasł. Poproś o nowy.' })

  const own = () => db.from('client_files').select('*').eq('media_link_id', link.id).eq('kind', 'media')

  if (body.action === 'info') {
    const { data: files, error } = await own().order('created_at', { ascending: false })
    if (error) return json(500, { error: error.message })
    const paths = (files ?? []).filter((f) => f.path && /^(image|video)\//.test(f.mime ?? '')).map((f) => f.path as string)
    const urls: Record<string, string> = {}
    if (paths.length) {
      const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600)
      data?.forEach((d) => {
        if (d.path && d.signedUrl) urls[d.path] = d.signedUrl
      })
    }
    const c = link.clients as unknown as { name: string; company: string | null } | null
    await db.from('media_links').update({ used_at: new Date().toISOString() }).eq('id', link.id)
    return json(200, {
      client: c?.company || c?.name || '',
      label: link.label,
      expires_at: link.expires_at,
      files: (files ?? []).map((f) => ({ ...f, preview: f.path ? urls[f.path] ?? null : null })),
    })
  }

  // jednorazowy adres do wgrania jednego pliku prosto do Storage (z pominięciem limitu funkcji Netlify)
  if (body.action === 'sign') {
    const name = (body.name || '').trim()
    if (!name) return json(400, { error: 'Brak nazwy pliku.' })
    const path = `${link.client_id}/media/${randomUUID()}-${safeName(name)}`
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) return json(500, { error: error?.message ?? 'Nie udało się przygotować wgrywania.' })
    return json(200, { path, url: data.signedUrl })
  }

  // po wgraniu: zapis pliku w bazie mediów (rozmiar i typ bierzemy ze Storage, nie od przeglądarki)
  if (body.action === 'add') {
    const path = body.path || ''
    if (!new RegExp(`^${link.client_id}/media/[0-9a-f-]{36}-[\\w.-]+$`).test(path)) return json(400, { error: 'Nieprawidłowy plik.' })
    const { data: info, error: infoErr } = await db.storage.from(BUCKET).info(path)
    if (infoErr || !info) return json(400, { error: 'Plik nie dotarł na serwer. Spróbuj wgrać go jeszcze raz.' })
    if ((info.size ?? 0) > MAX) {
      await db.storage.from(BUCKET).remove([path])
      return json(400, { error: 'Plik ma ponad 5 GB.' })
    }
    const { data: file, error } = await db
      .from('client_files')
      .insert({
        client_id: link.client_id, kind: 'media', category: body.category || null,
        name: (body.name || path.split('/').pop() || 'plik').slice(0, 200), path,
        mime: info.contentType || null, size: info.size ?? null, uploaded_by: null, media_link_id: link.id,
      })
      .select()
      .single()
    if (error) return json(400, { error: error.message })
    await db.from('media_links').update({ used_at: new Date().toISOString() }).eq('id', link.id)
    return json(200, { file })
  }

  if (body.action === 'update') {
    const patch: Record<string, string | null> = {}
    if (body.category !== undefined) patch.category = body.category || null
    if (body.name !== undefined && body.name.trim()) patch.name = body.name.trim().slice(0, 200)
    const { data, error } = await db.from('client_files').update(patch).eq('id', body.id ?? '').eq('media_link_id', link.id).select('id')
    if (error || !data?.length) return json(404, { error: 'Nie znaleziono pliku.' })
    return json(200, { ok: true })
  }

  if (body.action === 'delete') {
    const { data: f } = await own().eq('id', body.id ?? '').maybeSingle()
    if (!f) return json(404, { error: 'Nie znaleziono pliku.' })
    if (f.path) await db.storage.from(BUCKET).remove([f.path])
    await db.from('client_files').delete().eq('id', f.id)
    return json(200, { ok: true })
  }

  return json(400, { error: 'Nieznana operacja.' })
}
