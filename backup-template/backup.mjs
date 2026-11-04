// Xuất toàn bộ bảng OKRs Kaizen ra backups/YYYY-MM-DD.json. Chạy bằng Node 20 (có fetch sẵn).
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')

const tables = ['visions', 'goals', 'metrics', 'vision_items', 'income_models', 'periods', 'objectives', 'schedule_series', 'key_results', 'key_actions', 'kr_actuals', 'plan_changes', 'events', 'schedule_items', 'observations', 'next_actions', 'validations', 'settings']
const out = { exported_at: new Date().toISOString(), version: 2 }
for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`${t}: HTTP ${res.status} ${await res.text()}`)
  out[t] = await res.json()
}

mkdirSync('backups', { recursive: true })
const day = new Date().toISOString().slice(0, 10)
writeFileSync(`backups/${day}.json`, JSON.stringify(out, null, 2))

// Giữ 60 bản gần nhất
const files = readdirSync('backups').filter((f) => f.endsWith('.json')).sort()
for (const f of files.slice(0, Math.max(0, files.length - 60))) rmSync(`backups/${f}`)
console.log(`Đã sao lưu ${tables.map((t) => `${t}=${out[t].length}`).join(', ')}`)
