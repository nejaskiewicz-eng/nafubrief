import { templateByKey } from '../templates'
import { briefToMarkdown } from './format'
import { isDemo, supabase } from './supabase'
import type { Answers, Brief, Client, PublicBrief, PublicPortal, Summary, TemplateKey } from './types'

export type ClientInput = Partial<Omit<Client, 'id' | 'portal_token' | 'slug' | 'user_id' | 'login_email' | 'created_at'>> & { name: string }
export type Session = { email: string; role: 'admin' | 'client'; mustChangePassword?: boolean }
export type ClientWithBriefs = Client & { briefs: Pick<Brief, 'id' | 'title' | 'status' | 'template_key' | 'submitted_at'>[] }

const clone = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)))

function newBriefFromTemplate(key: TemplateKey, position: number) {
  const t = templateByKey(key)
  if (!t) throw new Error(`Nieznany szablon: ${key}`)
  return {
    template_key: t.key,
    title: t.title,
    description: t.description,
    intro: t.intro,
    schema: clone(t.schema),
    position,
  }
}

/* ------------------------------------------------------------------ */
/* Tryb demo: dane w localStorage, żeby można było klikać bez backendu */
/* ------------------------------------------------------------------ */

interface DemoDB {
  clients: Client[]
  briefs: Brief[]
  summaries: Summary[]
}

const DEMO_KEY = 'nafu-brief-demo'
const BRIEF_SLUG: Record<string, string> = { strategy: 'strategia', legal: 'prawny', technical: 'techniczny', visual: 'wizualny' }
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
function clientSlug(db: DemoDB, c: { company?: string | null; name: string }, selfId?: string) {
  const base = slugify(c.company || c.name) || 'klient'
  let s = base
  for (let n = 2; db.clients.some((x) => x.slug === s && x.id !== selfId); n++) s = `${base}-${n}`
  return s
}
function briefSlug(db: DemoDB, clientId: string, key: string) {
  const base = BRIEF_SLUG[key] ?? key
  let s = base
  for (let n = 2; db.briefs.some((b) => b.client_id === clientId && b.slug === s); n++) s = `${base}-${n}`
  return s
}
const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

function load(): DemoDB {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) {
      const db = JSON.parse(raw) as DemoDB
      db.clients.forEach((c) => {
        c.slug ??= clientSlug(db, c, c.id)
        c.user_id ??= null
        c.login_email ??= null
      })
      db.briefs.forEach((b) => (b.slug ??= briefSlug(db, b.client_id, b.template_key)))
      return db
    }
  } catch {
    /* ignoruj */
  }
  const client: Client = {
    id: uuid(),
    name: 'Anna Przykładowa',
    company: 'Salon Optyczny Przykład',
    email: 'anna@przyklad.pl',
    phone: '600 000 000',
    website: 'przyklad.pl',
    industry: 'Salon optyczny',
    notes: 'Klient demonstracyjny, możesz go usunąć.',
    portal_token: uuid(),
    slug: 'salon-optyczny-przyklad',
    user_id: 'demo-client',
    login_email: 'anna@przyklad.pl',
    created_at: now(),
  }
  const db: DemoDB = { clients: [client], briefs: [], summaries: [] }
  ;(['strategy', 'legal'] as TemplateKey[]).forEach((k, i) =>
    db.briefs.push({
      ...newBriefFromTemplate(k, i),
      id: uuid(),
      client_id: client.id,
      answers: {},
      status: 'sent',
      urgent: k === 'legal',
      token: uuid(),
      slug: BRIEF_SLUG[k],
      opened_at: null,
      submitted_at: null,
      created_at: now(),
      updated_at: now(),
    }),
  )
  save(db)
  return db
}

function save(db: DemoDB) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(db))
  } catch {
    /* ignoruj */
  }
}

function demo<T>(fn: (db: DemoDB) => T): Promise<T> {
  const db = load()
  const out = fn(db)
  save(db)
  return new Promise((r) => setTimeout(() => r(clone(out)), 120))
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

const sb = () => supabase!

/* ------------------------------------------------------------------ */

export const api = {
  /* ---------- logowanie ---------- */
  /** Zalogowana osoba i jej rola: administratorka (panel) albo klient (ankiety) */
  async session(): Promise<Session | null> {
    if (isDemo) {
      const r = sessionStorage.getItem('nafu-demo-auth')
      return r ? { email: r === 'client' ? 'anna@przyklad.pl' : 'demo', role: r === 'client' ? 'client' : 'admin' } : null
    }
    const { data } = await sb().auth.getSession()
    if (!data.session) return null
    const { data: isAdmin } = await sb().rpc('is_admin')
    // świeży odczyt metadanych (flaga wymuszonej zmiany hasła)
    const { data: u } = await sb().auth.getUser()
    const user = u.user ?? data.session.user
    return {
      email: user.email ?? '',
      role: isAdmin ? 'admin' : 'client',
      mustChangePassword: !isAdmin && user.user_metadata?.must_change_password === true,
    }
  },
  async signIn(email: string, password: string, demoRole: 'admin' | 'client' = 'admin') {
    if (isDemo) {
      sessionStorage.setItem('nafu-demo-auth', demoRole)
      return
    }
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Nieprawidłowy e-mail lub hasło.' : error.message)
  },
  async signOut() {
    if (isDemo) return sessionStorage.removeItem('nafu-demo-auth')
    await sb().auth.signOut()
  },
  async changePassword(password: string) {
    if (isDemo) return
    const { error } = await sb().auth.updateUser({ password, data: { must_change_password: false } })
    if (error) throw new Error(error.message)
  },

  /* ---------- klienci ---------- */
  async listClients(): Promise<ClientWithBriefs[]> {
    if (isDemo)
      return demo((db) =>
        [...db.clients]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((c) => ({ ...c, briefs: db.briefs.filter((b) => b.client_id === c.id) })),
      )
    return must(
      await sb()
        .from('clients')
        .select('*, briefs(id, title, status, template_key, submitted_at)')
        .order('created_at', { ascending: false }),
    )
  },
  async getClient(id: string): Promise<Client> {
    if (isDemo)
      return demo((db) => {
        const c = db.clients.find((x) => x.id === id)
        if (!c) throw new Error('Nie znaleziono klienta')
        return c
      })
    return must(await sb().from('clients').select('*').eq('id', id).single())
  },
  async createClient(input: ClientInput, templates: TemplateKey[]): Promise<Client> {
    if (isDemo)
      return demo((db) => {
        const c: Client = {
          company: null, email: null, phone: null, website: null, industry: null, notes: null,
          ...input, id: uuid(), portal_token: uuid(), slug: clientSlug(db, input), user_id: null, login_email: null, created_at: now(),
        }
        db.clients.push(c)
        templates.forEach((k, i) =>
          db.briefs.push({
            ...newBriefFromTemplate(k, i), id: uuid(), client_id: c.id, answers: {}, status: 'draft', urgent: false,
            token: uuid(), slug: briefSlug(db, c.id, k), opened_at: null, submitted_at: null, created_at: now(), updated_at: now(),
          }),
        )
        return c
      })
    const c = must<Client>(await sb().from('clients').insert(input).select().single())
    if (templates.length) await api.addBriefs(c.id, templates)
    return c
  },
  async updateClient(id: string, patch: Partial<ClientInput>) {
    if (isDemo)
      return demo((db) => {
        Object.assign(db.clients.find((x) => x.id === id)!, patch)
      })
    must(await sb().from('clients').update(patch).eq('id', id))
  },
  async deleteClient(id: string) {
    if (isDemo)
      return demo((db) => {
        db.clients = db.clients.filter((x) => x.id !== id)
        db.briefs = db.briefs.filter((x) => x.client_id !== id)
        db.summaries = db.summaries.filter((x) => x.client_id !== id)
      })
    must(await sb().from('clients').delete().eq('id', id))
  },

  /** Konto klienta: utworzenie, nowe hasło, usunięcie dostępu */
  async clientAccess(action: 'create' | 'password' | 'remove', clientId: string, email?: string, password?: string) {
    if (isDemo)
      return demo((db) => {
        const c = db.clients.find((x) => x.id === clientId)!
        if (action === 'create') {
          c.user_id = uuid()
          c.login_email = email ?? null
        }
        if (action === 'remove') {
          c.user_id = null
          c.login_email = null
        }
      })
    const { data } = await sb().auth.getSession()
    const res = await fetch('/.netlify/functions/client-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ action, clientId, email, password }),
    })
    const out = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new Error(out.error ?? `Błąd ${res.status}`)
  },

  /* ---------- ankiety klienta ---------- */
  async listBriefs(clientId: string): Promise<Brief[]> {
    if (isDemo)
      return demo((db) => db.briefs.filter((b) => b.client_id === clientId).sort((a, b) => a.position - b.position))
    return must(await sb().from('briefs').select('*').eq('client_id', clientId).order('position').order('created_at'))
  },
  async getBrief(id: string): Promise<Brief> {
    if (isDemo)
      return demo((db) => {
        const b = db.briefs.find((x) => x.id === id)
        if (!b) throw new Error('Nie znaleziono ankiety')
        return b
      })
    return must(await sb().from('briefs').select('*').eq('id', id).single())
  },
  async addBriefs(clientId: string, keys: TemplateKey[]) {
    const existing = await api.listBriefs(clientId)
    const rows = keys.map((k, i) => ({ ...newBriefFromTemplate(k, existing.length + i), client_id: clientId }))
    if (isDemo)
      return demo((db) => {
        rows.forEach((r) =>
          db.briefs.push({
            ...r, id: uuid(), answers: {}, status: 'draft', urgent: false, token: uuid(), slug: briefSlug(db, clientId, r.template_key),
            opened_at: null, submitted_at: null, created_at: now(), updated_at: now(),
          }),
        )
      })
    must(await sb().from('briefs').insert(rows))
  },
  async updateBrief(id: string, patch: Partial<Pick<Brief, 'title' | 'description' | 'intro' | 'schema' | 'status' | 'position' | 'answers' | 'submitted_at' | 'urgent'>>) {
    if (isDemo)
      return demo((db) => {
        Object.assign(db.briefs.find((x) => x.id === id)!, patch, { updated_at: now() })
      })
    must(await sb().from('briefs').update(patch).eq('id', id))
  },
  async deleteBrief(id: string) {
    if (isDemo)
      return demo((db) => {
        db.briefs = db.briefs.filter((x) => x.id !== id)
      })
    must(await sb().from('briefs').delete().eq('id', id))
  },
  /** Szkice → gotowe do wysłania (linki zaczynają działać) */
  async publishBriefs(clientId: string) {
    if (isDemo)
      return demo((db) => {
        db.briefs.filter((b) => b.client_id === clientId && b.status === 'draft').forEach((b) => (b.status = 'sent'))
      })
    must(await sb().from('briefs').update({ status: 'sent' }).eq('client_id', clientId).eq('status', 'draft'))
  },
  /** Pozwala klientowi ponownie edytować wysłaną ankietę */
  async reopenBrief(id: string) {
    return api.updateBrief(id, { status: 'in_progress', submitted_at: null })
  },

  /* ---------- podsumowania AI ---------- */
  async listSummaries(clientId: string): Promise<Summary[]> {
    if (isDemo)
      return demo((db) => db.summaries.filter((s) => s.client_id === clientId).sort((a, b) => b.created_at.localeCompare(a.created_at)))
    return must(await sb().from('summaries').select('*').eq('client_id', clientId).order('created_at', { ascending: false }))
  },
  async getSummary(id: string): Promise<Summary> {
    if (isDemo) return demo((db) => db.summaries.find((s) => s.id === id)!)
    return must(await sb().from('summaries').select('*').eq('id', id).single())
  },
  async deleteSummary(id: string) {
    if (isDemo)
      return demo((db) => {
        db.summaries = db.summaries.filter((s) => s.id !== id)
      })
    must(await sb().from('summaries').delete().eq('id', id))
  },
  /** Zleca agentowi AI podsumowanie; zwraca id rekordu (status pending → done) */
  async requestSummary(clientId: string, instructions: string): Promise<string> {
    if (isDemo) {
      const briefs = (await api.listBriefs(clientId)).filter((b) => b.status === 'submitted' || Object.keys(b.answers).length)
      return demo((db) => {
        const content = [
          '> **Tryb demo.** To nie jest analiza AI. Po podłączeniu Supabase i klucza Anthropic agent przygotuje tu pełne podsumowanie, wnioski i konspekt pracy.',
          '',
          ...briefs.map((b) => briefToMarkdown(b.title, b.schema, b.answers)),
        ].join('\n')
        const s: Summary = {
          id: uuid(), client_id: clientId, status: 'done', content, error: null, model: 'demo', created_at: now(),
        }
        db.summaries.push(s)
        return s.id
      })
    }
    const row = must<Summary>(await sb().from('summaries').insert({ client_id: clientId, status: 'pending' }).select().single())
    const { data } = await sb().auth.getSession()
    const res = await fetch('/.netlify/functions/summarize-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ summaryId: row.id, instructions }),
    })
    if (!res.ok && res.status !== 202) {
      await sb().from('summaries').update({ status: 'error', error: `Funkcja zwróciła ${res.status}` }).eq('id', row.id)
    }
    return row.id
  },

  /* ---------- publiczny podgląd pytań (bez logowania, bez odpowiedzi) ---------- */
  async publicPortal(clientSlug: string): Promise<PublicPortal | null> {
    if (isDemo)
      return demo((db) => {
        const c = db.clients.find((x) => x.slug === clientSlug)
        if (!c) return null
        return {
          client_name: c.company ?? c.name,
          client_slug: c.slug,
          briefs: db.briefs
            .filter((b) => b.client_id === c.id && b.status !== 'draft')
            .sort((a, b) => a.position - b.position)
            .map((b) => ({ title: b.title, description: b.description, slug: b.slug, template_key: b.template_key })),
        }
      })
    return must(await sb().rpc('get_public_portal', { p_client: clientSlug }))
  },
  async publicBrief(clientSlug: string, slug: string): Promise<PublicBrief | null> {
    if (isDemo)
      return demo((db) => {
        const c = db.clients.find((x) => x.slug === clientSlug)
        const b = c && db.briefs.find((x) => x.client_id === c.id && x.slug === slug)
        if (!c || !b) return null
        if (b.status === 'draft') return { status: 'draft', client_name: c.company ?? c.name } as PublicBrief
        return {
          status: 'sent', title: b.title, description: b.description, intro: b.intro, schema: b.schema,
          answers: {}, client_name: c.company ?? c.name, submitted_at: null,
        }
      })
    return must(await sb().rpc('get_public_brief', { p_client: clientSlug, p_brief: slug }))
  },

  /* ---------- konto klienta (po zalogowaniu) ---------- */
  /** Firma przypisana do zalogowanego klienta */
  async myClient(): Promise<Client | null> {
    if (isDemo)
      return demo((db) => (sessionStorage.getItem('nafu-demo-auth') === 'client' ? db.clients.find((c) => c.user_id) ?? null : null))
    const { data: s } = await sb().auth.getSession()
    if (!s.session) return null
    const { data } = await sb().from('clients').select('*').eq('user_id', s.session.user.id).maybeSingle()
    return (data as Client | null) ?? null
  },
  async myBriefs(clientId: string): Promise<Brief[]> {
    if (isDemo)
      return demo((db) => db.briefs.filter((b) => b.client_id === clientId && b.status !== 'draft').sort((a, b) => a.position - b.position))
    return must(await sb().from('briefs').select('*').eq('client_id', clientId).neq('status', 'draft').order('position').order('created_at'))
  },
  async openMyBrief(briefId: string) {
    if (isDemo) return
    await sb().rpc('open_my_brief', { p_brief: briefId })
  },
  async saveMyBrief(briefId: string, answers: Answers, submit = false) {
    if (isDemo)
      return demo((db) => {
        const b = db.briefs.find((x) => x.id === briefId)!
        if (b.status === 'submitted') throw new Error('already_submitted')
        b.answers = answers
        b.status = submit ? 'submitted' : 'in_progress'
        b.submitted_at = submit ? now() : null
        b.updated_at = now()
      })
    must(await sb().rpc('save_my_brief', { p_brief: briefId, p_answers: answers, p_submit: submit }))
    if (submit) {
      // powiadomienie e-mail (opcjonalne, działa, gdy skonfigurowano Resend)
      const { data } = await sb().auth.getSession()
      fetch('/.netlify/functions/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ briefId }),
      }).catch(() => {})
    }
  },
}

/** Główny adres ankiet; linki zawsze na tej domenie, niezależnie od tego, skąd otwarto panel */
const SITE = ((import.meta.env.VITE_SITE_URL as string | undefined) || location.origin).replace(/\/$/, '')
export const portalLink = (client: Pick<Client, 'slug'>) => `${SITE}/${client.slug}`
export const briefLink = (client: Pick<Client, 'slug'>, brief: Pick<Brief, 'slug'>) => `${SITE}/${client.slug}/${brief.slug}`
export const loginLink = () => `${SITE}/logowanie`
