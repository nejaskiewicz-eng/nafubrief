// Powiadomienie e-mail dla administratorki, gdy klient wchodzi do panelu (opcjonalne, działa, gdy ustawisz RESEND_API_KEY).
// Wywołuje zalogowany klient przy wejściu do strefy klienta. Jedna wiadomość na wizytę: baza uznaje wizytę za nową
// po 30 minutach bez aktywności.
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }
  const key = process.env.RESEND_API_KEY
  const to = process.env.NOTIFY_EMAIL || 'n.e.jaskiewicz@gmail.com'
  const from = process.env.NOTIFY_FROM
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return { statusCode: 204, body: '' }

  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return { statusCode: 401, body: '' }

  // Jako zalogowany klient: funkcja w bazie sama ustala, czyj to panel i czy to nowa wizyta.
  const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data } = await db.rpc('client_panel_visit')
  const v = data as { client_id?: string; name?: string; new_visit?: boolean } | null
  if (!v?.client_id || !v.new_visit || !key || !from) return { statusCode: 204, body: '' }

  const site = (process.env.VITE_SITE_URL || process.env.URL || '').replace(/\/$/, '')
  const name = v.name || 'Klient'
  const when = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const link = `${site}/panel/klient/${v.client_id}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `${name}: wejście do panelu`,
      html: `<p><strong>${escape(name)}</strong> jest teraz w panelu NAFU (${escape(when)}).</p><p><a href="${link}">Otwórz kartotekę klienta</a>, żeby zobaczyć aktywność na żywo.</p>`,
      text: `${name} jest teraz w panelu NAFU (${when}).\n\nKartoteka klienta: ${link}`,
    }),
  })
  return { statusCode: res.ok ? 200 : 502, body: '' }
}
