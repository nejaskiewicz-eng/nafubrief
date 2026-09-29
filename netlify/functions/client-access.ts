// Zakładanie i obsługa kont klientów. Wywołuje tylko zalogowana administratorka z panelu.
// Wymaga zmiennej SUPABASE_SECRET_KEY (klucz „secret” / service_role z Supabase), wyłącznie po stronie serwera.
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

type Body = { action: 'create' | 'password' | 'remove'; clientId: string; email?: string; password?: string }

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metoda niedozwolona' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon) return json(500, { error: 'Brak konfiguracji Supabase.' })
  if (!secret) return json(500, { error: 'Brak SUPABASE_SECRET_KEY w ustawieniach Netlify.' })

  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Brak logowania.' })

  // kto wywołuje: tylko administratorka
  const asUser = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: me } = await asUser.auth.getUser(token)
  if (!me.user) return json(401, { error: 'Sesja wygasła, zaloguj się ponownie.' })
  const { data: isAdmin } = await asUser.rpc('is_admin')
  if (!isAdmin) return json(403, { error: 'Brak uprawnień.' })

  let body: Body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Nieprawidłowe dane.' })
  }

  // klient musi należeć do administratorki (RLS)
  const { data: client } = await asUser.from('clients').select('id, user_id, login_email').eq('id', body.clientId).single()
  if (!client) return json(404, { error: 'Nie znaleziono klienta.' })

  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })

  if (body.action === 'create') {
    const email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'Podaj poprawny adres e-mail.' })
    if (password.length < 8) return json(400, { error: 'Hasło musi mieć co najmniej 8 znaków.' })
    if (client.user_id) return json(409, { error: 'Ten klient ma już konto.' })
    if (email === me.user.email?.toLowerCase()) return json(400, { error: 'To Twój adres administratora. Podaj adres klienta.' })

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'client', must_change_password: true },
    })
    if (error || !created.user) {
      const exists = /already|registered|exists/i.test(error?.message ?? '')
      return json(400, { error: exists ? 'Konto z tym adresem e-mail już istnieje.' : error?.message ?? 'Nie udało się utworzyć konta.' })
    }
    const { error: linkErr } = await admin.from('clients').update({ user_id: created.user.id, login_email: email }).eq('id', client.id)
    if (linkErr) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json(500, { error: 'Nie udało się przypisać konta do klienta.' })
    }
    return json(200, { ok: true, email })
  }

  if (body.action === 'password') {
    if (!client.user_id) return json(400, { error: 'Ten klient nie ma jeszcze konta.' })
    if ((body.password || '').length < 8) return json(400, { error: 'Hasło musi mieć co najmniej 8 znaków.' })
    const { error } = await admin.auth.admin.updateUserById(client.user_id, {
      password: body.password,
      user_metadata: { role: 'client', must_change_password: true },
    })
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true, email: client.login_email })
  }

  if (body.action === 'remove') {
    if (!client.user_id) return json(200, { ok: true })
    await admin.from('clients').update({ user_id: null, login_email: null }).eq('id', client.id)
    const { error } = await admin.auth.admin.deleteUser(client.user_id)
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true })
  }

  return json(400, { error: 'Nieznana operacja.' })
}
