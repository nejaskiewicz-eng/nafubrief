import { isDemo, supabase } from './supabase'
import type { Answers, Brief, Client, PublicBrief, PublicPortal, Summary, TemplateKey } from './types'

export type ClientInput = Partial<Omit<Client, 'id' | 'portal_token' | 'slug' | 'user_id' | 'login_email' | 'created_at'>> & { name: string }
export type Session = { email: string; role: 'admin' | 'client'; mustChangePassword?: boolean }
export type ClientWithBriefs = Client & { briefs: Pick<Brief, 'id' | 'title' | 'status' | 'template_key' | 'submitted_at'>[] }

const clone = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)))

/** Szablony ładowane dopiero, gdy są potrzebne (tylko w panelu administratorki) */
async function newBriefFromTemplate(key: TemplateKey, position: number) {
  const { templateByKey } = await import('../templates')
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
export const uuid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()

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

export function demo<T>(fn: (db: DemoDB) => T): Promise<T> {
  const db = load()
  const out = fn(db)
  save(db)
  return new Promise((r) => setTimeout(() => r(clone(out)), 120))
}

export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export const sb = () => supabase!

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
    if (isDemo) {
      const rows = await Promise.all(templates.map((k, i) => newBriefFromTemplate(k, i)))
      return demo((db) => {
        const c: Client = {
          company: null, email: null, phone: null, website: null, industry: null, notes: null,
          ...input, id: uuid(), portal_token: uuid(), slug: clientSlug(db, input), user_id: null, login_email: null, created_at: now(),
        }
        db.clients.push(c)
        rows.forEach((r) =>
          db.briefs.push({
            ...r, id: uuid(), client_id: c.id, answers: {}, status: 'draft', urgent: false, step_id: null,
            token: uuid(), slug: briefSlug(db, c.id, r.template_key), opened_at: null, submitted_at: null, created_at: now(), updated_at: now(),
          }),
        )
        return c
      })
    }
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
  async addBriefs(clientId: string, keys: TemplateKey[], stepId?: string) {
    const existing = await api.listBriefs(clientId)
    const rows = await Promise.all(
      keys.map(async (k, i) => ({ ...(await newBriefFromTemplate(k, existing.length + i)), client_id: clientId, ...(stepId ? { step_id: stepId } : {}) })),
    )
    if (isDemo)
      return demo((db) => {
        rows.forEach((r) =>
          db.briefs.push({
            ...r, step_id: (r as { step_id?: string }).step_id ?? null, id: uuid(), answers: {}, status: 'draft', urgent: false, token: uuid(), slug: briefSlug(db, clientId, r.template_key),
            opened_at: null, submitted_at: null, created_at: now(), updated_at: now(),
          }),
        )
      })
    must(await sb().from('briefs').insert(rows))
  },
  async updateBrief(id: string, patch: Partial<Pick<Brief, 'title' | 'description' | 'intro' | 'schema' | 'status' | 'position' | 'answers' | 'submitted_at' | 'urgent' | 'step_id'>>) {
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
    // tylko bezpieczne pola (bez notatek administratorki)
    const { data } = await sb().rpc('my_client')
    if (!data) return null
    const c = data as Pick<Client, 'id' | 'name' | 'company' | 'slug' | 'login_email'>
    return {
      ...c, email: null, phone: null, website: null, industry: null, notes: null,
      portal_token: '', user_id: s.session.user.id, created_at: '',
    }
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
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || location.origin).replace(/\/$/, '')
const SITE = SITE_URL
export const portalLink = (client: Pick<Client, 'slug'>) => `${SITE}/${client.slug}`
export const briefLink = (client: Pick<Client, 'slug'>, brief: Pick<Brief, 'slug'>) => `${SITE}/${client.slug}/${brief.slug}`
export const loginLink = () => `${SITE}/logowanie`
