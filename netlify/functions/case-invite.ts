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

/** Do e-maila trafia tylko pierwszy akapit opisu sprawy, bez znaków formatowania. Pełny opis jest w panelu, po zalogowaniu. */
const lead = (d: string | null) =>
  (d ?? '').split(/\n\s*\n/)[0].replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim() || null

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
  let test = false
  let reminder = false
  try {
    const b = JSON.parse(event.body || '{}') as { caseId?: string; note?: string; test?: boolean; reminder?: boolean }
    caseId = b.caseId || ''
    note = (b.note || '').trim().slice(0, 2000)
    test = b.test === true
    reminder = b.reminder === true
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
  const clientTo = cl.login_email || cl.email
  if (!clientTo) return json(400, { error: 'Klient nie ma adresu e-mail. Uzupełnij go w danych klienta.' })
  // test: ten sam e-mail co dla klienta, ale do administratorki
  const to = test ? process.env.NOTIFY_EMAIL || 'n.e.jaskiewicz@gmail.com' : clientTo

  const site = (process.env.VITE_SITE_URL || process.env.URL || '').replace(/\/$/, '')
  const link = `${site}/${cl.slug}/sprawy?sprawa=${c.id}`
  const { subject, html, text } = renderCaseInvite({
    form: cl.address_form, salutation: cl.salutation, priority: c.priority, title: c.title, description: reminder ? null : lead(c.description), due: c.due_date, note, login: clientTo, link, site, reminder,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: process.env.NOTIFY_EMAIL || undefined, subject: test ? `[TEST] ${subject}` : subject, html, text }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return json(502, { error: `Nie udało się wysłać e-maila (${res.status}). ${detail.slice(0, 200)}` })
  }
  if (!test) await db.from('cases').update({ invited_at: new Date().toISOString() }).eq('id', c.id)
  return json(200, { ok: true, to })
}

/** Treść e-maila zależna od formy zwracania się do klienta (na Ty albo oficjalnie).
 *  Układ tabelowy z wbudowanymi stylami (działa w Gmailu, Outlooku i Apple Mail) plus wersja tekstowa. */
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
  site?: string
  /** przypomnienie o sprawie, którą klient już zna (inny temat i wstęp, bez opisu) */
  reminder?: boolean
}) {
  const ty = p.form === 'ty'
  const pron = p.form === 'pani' ? 'Pani' : p.form === 'pan' ? 'Pana' : 'Państwa'
  const sal = (p.salutation || '').trim()
  const para = (s: string) => esc(s).replace(/\n/g, '<br>')
  const site = (p.site || 'https://nafu-design.com').replace(/\/$/, '')
  const cat = p.priority === 'very_urgent' ? 'Bardzo pilne' : p.priority === 'urgent' ? 'Pilne' : ''

  const subject = p.reminder
    ? ty ? `${sal ? `${sal}, p` : 'P'}rzypomnienie o sprawie: ${p.title}` : `Przypomnienie o sprawie: ${p.title}`
    : ty ? `${sal ? `${sal}, n` : 'N'}owa sprawa w panelu: ${p.title}` : `Sprawa wymagająca ${pron} udziału: ${p.title}`
  const greet = ty ? (sal ? `Cześć ${esc(sal)}!` : 'Cześć!') : `Dzień dobry${sal ? ` ${esc(sal)}` : ''},`
  const intro = p.reminder
    ? ty
      ? `Przypominam o sprawie w Twojej strefie klienta NAFU${cat ? ', z kategorii:' : '.'}`
      : `przypominam o sprawie w strefie klienta NAFU Design, w której potrzebuję ${pron} udziału${cat ? '. Kategoria:' : '.'}`
    : ty
      ? `W Twojej strefie klienta NAFU dodałam nową sprawę${cat ? ', z kategorii:' : '.'}`
      : `w strefie klienta NAFU Design dodałam nową sprawę, w której potrzebuję ${pron} udziału${cat ? '. Kategoria:' : '.'}`
  const cta = ty ? 'Otwórz sprawę' : 'Otwórz sprawę w panelu'
  const outro = ty
    ? `W środku masz wszystko w jednym miejscu: zadania, pytania, dokumenty i naszą rozmowę. Logujesz się adresem ${esc(p.login)}.`
    : `W sprawie znajdują się zadania, pytania, dokumenty i nasza korespondencja. Proszę zalogować się adresem ${esc(p.login)}.`
  const signHtml = ty
    ? '<span style="font-size:15px;color:#0d2830">Pozdrawiam,</span><br><strong style="font-size:16px;color:#0d2830">Nat</strong>'
    : '<span style="font-size:15px;color:#0d2830">Z pozdrowieniami,</span><br><strong style="font-size:16px;color:#0d2830">Natalia Jaśkiewicz</strong><br><span style="font-size:13px;color:#587079">NAFU Design</span>'

  const F = "font-family:'DM Sans',Arial,Helvetica,sans-serif"
  const pill = cat
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${cat === 'Bardzo pilne' ? '#fde8e6' : '#fdf4e1'};color:${cat === 'Bardzo pilne' ? '#b42318' : '#9a6700'};font-size:13px;font-weight:700;letter-spacing:.2px">${cat}</span>`
    : ''

  const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#eef4f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(p.title)}${cat ? ` · ${cat}` : ''}${p.due ? ` · termin ${fmtDay(p.due)}` : ''}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f6">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

<tr><td style="background:#072129;border-radius:18px 18px 0 0;padding:26px 32px">
  <img src="${site}/brand/email/logo.png" width="120" alt="NAFU design" style="display:block;border:0;height:auto">
  <div style="${F};margin-top:14px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#02afca;font-weight:700">Strefa klienta</div>
</td></tr>

<tr><td style="background:#ffffff;padding:32px;${F};font-size:15px;line-height:1.6;color:#0d2830">
  <p style="margin:0 0 14px;font-size:18px;font-weight:700">${greet}</p>
  <p style="margin:0 0 ${cat ? '10px' : '22px'}">${intro}</p>
  ${pill ? `<p style="margin:0 0 22px">${pill}</p>` : ''}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4fafb;border:1px solid #d9ecf0;border-left:4px solid #02afca;border-radius:12px">
  <tr><td style="padding:18px 20px;${F}">
    <div style="font-size:19px;font-weight:700;line-height:1.35;color:#072129">${esc(p.title)}</div>
    ${p.due ? `<div style="margin-top:6px;font-size:14px;color:#0a7189;font-weight:700">Termin: ${fmtDay(p.due)}</div>` : ''}
    ${p.description ? `<div style="margin-top:10px;font-size:14.5px;line-height:1.6;color:#3b5560">${para(p.description)}</div>` : ''}
  </td></tr></table>

  ${p.note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr>
    <td width="52" valign="top" style="padding-right:12px"><img src="${site}/brand/email/natalia.png" width="44" height="44" alt="Natalia" style="display:block;border-radius:50%;border:0"></td>
    <td valign="top" style="background:#e6f7fa;border-radius:4px 14px 14px 14px;padding:14px 16px;${F};font-size:15px;line-height:1.6;color:#0d2830">${para(p.note)}</td>
  </tr></table>` : ''}

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr>
    <td style="border-radius:999px;background:#0a7189">
      <a href="${p.link}" style="display:inline-block;padding:14px 30px;${F};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${cta} &rarr;</a>
    </td></tr></table>
  <p style="margin:0 0 26px;font-size:13px;line-height:1.55;color:#587079">${outro}</p>

  <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3ecef;padding-top:20px;width:100%"><tr>
    <td width="60" valign="middle" style="padding-top:20px"><img src="${site}/brand/email/natalia.png" width="48" height="48" alt="" style="display:block;border-radius:50%;border:0"></td>
    <td valign="middle" style="padding-top:20px;${F};line-height:1.4">${signHtml}</td>
  </tr></table>
</td></tr>

<tr><td style="background:#ffffff;border-radius:0 0 18px 18px;padding:0 32px 26px;${F};font-size:12px;line-height:1.5;color:#8aa0a7">
  NAFU Design · <a href="${site}" style="color:#0a7189;text-decoration:none">nafu-design.com</a><br>
  ${ty ? 'Ta wiadomość dotyczy współpracy przy Twoim projekcie. Odpowiedz na nią, a trafi bezpośrednio do mnie.' : 'Wiadomość dotyczy współpracy przy projekcie. Odpowiedź na nią trafi bezpośrednio do mnie.'}
</td></tr>

</table></td></tr></table>
</body></html>`

  const strip = (x: string) => x.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  const text = [
    strip(greet), '', strip(intro) + (cat ? ` ${cat}` : ''), '', p.title + (p.due ? `\nTermin: ${fmtDay(p.due)}` : ''),
    p.description ? `\n${p.description}` : '', p.note ? `\n${p.note}` : '',
    '', `${cta}: ${p.link}`, '', strip(outro), '', ty ? 'Pozdrawiam,\nNat' : 'Z pozdrowieniami,\nNatalia Jaśkiewicz\nNAFU Design',
  ].join('\n').replace(/\n{3,}/g, '\n\n')

  return { subject, html, text }
}
