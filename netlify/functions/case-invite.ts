// Powiadomienie e-mail do klienta z prośbą o dołączenie do sprawy bieżącej.
// Wywołuje tylko zalogowana administratorka z panelu. Wysyłka przez Resend (RESEND_API_KEY, NOTIFY_FROM).
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const fmtDay = (d: string) => new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

type CaseRow = { id: string; title: string; description: string | null; due_date: string | null; status: string; priority: string; client_id: string }
type ClientRow = { slug: string; name: string; company: string | null; email: string | null; login_email: string | null; address_form: string | null; salutation: string | null }

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metoda niedozwolona' })
  const key = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return json(500, { error: 'Brak konfiguracji Supabase.' })
  if (!key || !from) return json(500, { error: 'Wysyłka e-maili nie jest skonfigurowana: ustaw RESEND_API_KEY i NOTIFY_FROM w Netlify.' })

  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Brak logowania.' })
  const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: isAdmin } = await db.rpc('is_admin')
  if (!isAdmin) return json(403, { error: 'Brak uprawnień.' })

  let caseId = ''
  let note = ''
  try {
    const b = JSON.parse(event.body || '{}') as { caseId?: string; note?: string }
    caseId = b.caseId || ''
    note = (b.note || '').trim().slice(0, 2000)
  } catch {
    return json(400, { error: 'Nieprawidłowe dane.' })
  }
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) return json(400, { error: 'Nieprawidłowa sprawa.' })

  // RLS: administratorka widzi tylko sprawy swoich klientów
  const { data: c } = await db.from('cases').select('id, title, description, due_date, status, priority, client_id').eq('id', caseId).single<CaseRow>()
  if (!c) return json(404, { error: 'Nie znaleziono sprawy.' })
  if (c.status === 'closed') return json(409, { error: 'Sprawa jest zamknięta.' })
  const { data: cl } = await db.from('clients').select('slug, name, company, email, login_email, address_form, salutation').eq('id', c.client_id).single<ClientRow>()
  if (!cl) return json(404, { error: 'Nie znaleziono klienta.' })
  const to = cl.login_email || cl.email
  if (!to) return json(400, { error: 'Klient nie ma adresu e-mail. Uzupełnij go w danych klienta.' })

  const site = (process.env.VITE_SITE_URL || process.env.URL || '').replace(/\/$/, '')
  const link = `${site}/${cl.slug}/sprawy?sprawa=${c.id}`
  const { subject, html } = renderCaseInvite({
    form: cl.address_form, salutation: cl.salutation, priority: c.priority, title: c.title, description: c.description, due: c.due_date, note, login: to, link,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: process.env.NOTIFY_EMAIL || undefined, subject, html }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return json(502, { error: `Nie udało się wysłać e-maila (${res.status}). ${detail.slice(0, 200)}` })
  }
  await db.from('cases').update({ invited_at: new Date().toISOString() }).eq('id', c.id)
  return json(200, { ok: true, to })
}

/** Treść e-maila zależna od formy zwracania się do klienta (na Ty albo oficjalnie) */
export function renderCaseInvite(p: {
  form: string | null
  salutation: string | null
  priority?: string | null
  title: string
  description: string | null
  due: string | null
  note: string
  login: string
  link: string
}) {
  const ty = p.form === 'ty'
  const pron = p.form === 'pani' ? 'Pani' : p.form === 'pan' ? 'Pana' : 'Państwa'
  const sal = (p.salutation || '').trim()
  const para = (s: string) => esc(s).replace(/\n/g, '<br>')

  const subject = ty ? `${sal ? `${sal}, n` : 'N'}owa sprawa w panelu: ${p.title}` : `Sprawa wymagająca ${pron} udziału: ${p.title}`
  const greet = ty ? (sal ? `Cześć ${esc(sal)}!` : 'Cześć!') : `Dzień dobry${sal ? ` ${esc(sal)}` : ''},`
  const cat = p.priority === 'very_urgent' ? 'Bardzo pilne' : p.priority === 'urgent' ? 'Pilne' : ''
  const intro = ty
    ? `W Twojej strefie klienta NAFU dodałam nową sprawę${cat ? `, z kategorii: <strong>${cat}</strong>` : ''}.`
    : `w strefie klienta NAFU Design dodałam nową sprawę${cat ? ` z kategorii: <strong>${cat}</strong>` : ''}, w której potrzebuję ${pron} udziału.`
  const outro = ty
    ? `W środku masz wszystko w jednym miejscu: zadania, pytania, dokumenty i naszą rozmowę. Logujesz się adresem ${esc(p.login)}. Jeśli przycisk nie zadziała, skopiuj link: ${esc(p.link)}`
    : `W sprawie znajdują się zadania, pytania, dokumenty i nasza korespondencja. Proszę zalogować się adresem ${esc(p.login)}. Jeśli przycisk nie działa, proszę skopiować link: ${esc(p.link)}`
  const sign = ty ? 'Pozdrawiam,<br>Nat' : 'Z pozdrowieniami,<br>Natalia Jaśkiewicz<br>NAFU Design'

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0d2830;max-width:560px">
  <p>${greet}</p>
  <p>${intro}</p>
  <p style="font-size:18px;font-weight:bold;margin:18px 0 6px">${esc(p.title)}</p>
  ${p.description ? `<p style="margin:0 0 12px;color:#3b5560">${para(p.description)}</p>` : ''}
  ${p.due ? `<p style="margin:0 0 12px"><strong>Termin:</strong> ${fmtDay(p.due)}</p>` : ''}
  ${p.note ? `<p style="margin:0 0 12px;padding:12px 14px;background:#e6f7fa;border-radius:10px">${para(p.note)}</p>` : ''}
  <p style="margin:22px 0">
    <a href="${p.link}" style="background:#0a7189;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">Otwórz sprawę</a>
  </p>
  <p style="font-size:13px;color:#587079">${outro}</p>
  <p>${sign}</p>
</div>`
  return { subject, html }
}
