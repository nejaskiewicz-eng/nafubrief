// Funkcje używane tylko w panelu administratorki (ładowane osobno, klient ich nie pobiera).
import { api, demo, must, now, sb, uuid } from './api'
import { briefToMarkdown } from './format'
import { isDemo } from './supabase'
import type { Summary } from './types'

export async function listSummaries(clientId: string): Promise<Summary[]> {
    if (isDemo)
      return demo((db) => db.summaries.filter((s) => s.client_id === clientId).sort((a, b) => b.created_at.localeCompare(a.created_at)))
    return must(await sb().from('summaries').select('*').eq('client_id', clientId).order('created_at', { ascending: false }))
}
export async function getSummary(id: string): Promise<Summary> {
    if (isDemo) return demo((db) => db.summaries.find((s) => s.id === id)!)
    return must(await sb().from('summaries').select('*').eq('id', id).single())
}
export async function deleteSummary(id: string) {
    if (isDemo)
      return demo((db) => {
        db.summaries = db.summaries.filter((s) => s.id !== id)
      })
    must(await sb().from('summaries').delete().eq('id', id))
}
/** Zleca agentowi AI podsumowanie; zwraca id rekordu (status pending → done) */
export async function requestSummary(clientId: string, instructions: string): Promise<string> {
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
}

