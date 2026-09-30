// Powiadomienie e-mail o wysłanej ankiecie (opcjonalne, działa, gdy ustawisz RESEND_API_KEY).
// Wywołuje zalogowany klient zaraz po wysłaniu ankiety.
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }
  const key = process.env.RESEND_API_KEY
  const to = process.env.NOTIFY_EMAIL || 'n.e.jaskiewicz@gmail.com'
  const from = process.env.NOTIFY_FROM
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!key || !from || !url || !anon) return { statusCode: 204, body: '' }

  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const { briefId } = JSON.parse(event.body || '{}') as { briefId?: string }
  if (!token || !briefId || !/^[0-9a-f-]{36}$/i.test(briefId)) return { statusCode: 400, body: '' }

  // Odczyt jako zalogowany klient: RLS pokaże tylko jego własną ankietę.
  const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: b } = await db
    .from('briefs')
    .select('title, status, submitted_at')
    .eq('id', briefId)
    .single<{ title: string; status: string; submitted_at: string | null }>()
  if (!b || b.status !== 'submitted' || !b.submitted_at) return { statusCode: 204, body: '' }
  if (Date.now() - new Date(b.submitted_at).getTime() > 5 * 60 * 1000) return { statusCode: 204, body: '' }
  const { data: me } = await db.rpc('my_client')
  const clientName = (me as { company?: string; name?: string } | null)?.company || (me as { name?: string } | null)?.name || 'Klient'

  const site = process.env.URL || ''
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `${clientName} wysłał(a) ankietę: ${b.title}`,
      html: `<p><strong>${escape(clientName)}</strong> wypełnił(a) ankietę <strong>${escape(b.title)}</strong>.</p><p><a href="${site}/panel">Otwórz panel NAFU Brief</a></p>`,
    }),
  })
  return { statusCode: res.ok ? 200 : 502, body: '' }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
