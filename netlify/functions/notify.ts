// Powiadomienie e-mail o wysłanej ankiecie (opcjonalne - działa, gdy ustawisz RESEND_API_KEY).
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

  const { client, brief } = JSON.parse(event.body || '{}') as { client?: string; brief?: string }
  const ok = (v?: string) => !!v && /^[a-z0-9-]{1,80}$/.test(v)
  if (!ok(client) || !ok(brief)) return { statusCode: 400, body: '' }

  // Sprawdzamy przez publiczną funkcję, że ankieta faktycznie została właśnie wysłana.
  const db = createClient(url, anon)
  const { data } = await db.rpc('get_brief_by_slug', { p_client: client, p_brief: brief })
  const b = data as { status: string; title: string; client_name: string; submitted_at: string | null } | null
  if (!b || b.status !== 'submitted' || !b.submitted_at) return { statusCode: 204, body: '' }
  if (Date.now() - new Date(b.submitted_at).getTime() > 5 * 60 * 1000) return { statusCode: 204, body: '' }

  const site = process.env.URL || ''
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `✔ ${b.client_name} wysłał(a) ankietę: ${b.title}`,
      html: `<p><strong>${escape(b.client_name)}</strong> wypełnił(a) ankietę <strong>${escape(b.title)}</strong>.</p><p><a href="${site}/panel">Otwórz panel NAFU Brief</a></p>`,
    }),
  })
  return { statusCode: res.ok ? 200 : 502, body: '' }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
