import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Bez zmiennych środowiskowych aplikacja działa w trybie demo (dane w przeglądarce). */
export const isDemo = !url || !key

export const supabase: SupabaseClient | null = isDemo ? null : createClient(url!, key!)
