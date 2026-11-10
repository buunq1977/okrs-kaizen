import type { AffData } from './affLink'
import type { AffEntry, AffProject, Tally } from './affProjects'
import { listAll } from './db'

/** Tải dữ liệu Sổ dự án. Chưa chạy migration 009/010 thì trả rỗng (không chặn trang OKR). */
export async function loadAffData(): Promise<AffData> {
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[])
  const [projects, tallies, entries] = await Promise.all([
    safe(listAll<AffProject>('aff_projects')),
    safe(listAll<Tally>('aff_tallies', 'date')),
    safe(listAll<AffEntry>('aff_entries', 'date')),
  ])
  return { projects, tallies, entries }
}
