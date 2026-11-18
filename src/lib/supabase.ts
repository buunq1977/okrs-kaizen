import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!)
  : null

/* Nguồn số ngoài (chỉ đọc), mỗi app một phiên đăng nhập riêng lưu trong trình duyệt.
   Research = Supabase của app workspace; Ads-Hub = Supabase của app ads-hub. Thiếu biến môi trường thì null. */
const extra = (u: string | undefined, k: string | undefined, storageKey: string) =>
  u && k ? createClient(u, k, { auth: { persistSession: true, autoRefreshToken: true, storageKey } }) : null
export const wsClient = extra(import.meta.env.VITE_WS_URL, import.meta.env.VITE_WS_KEY, 'okr-ws-auth')
export const ahClient = extra(import.meta.env.VITE_ADSHUB_URL, import.meta.env.VITE_ADSHUB_KEY, 'okr-adshub-auth')
