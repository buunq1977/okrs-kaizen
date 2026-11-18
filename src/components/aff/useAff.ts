import { useCallback, useEffect, useMemo, useState } from 'react'
import { anyLocked, coeffsOf, type AffConfig, type AffMonth, type Live, needsAutoLock, snapshotV2 } from '../../lib/affiliate'
import { loadAffData, loadAh, loadThresholds, loadWs, type SrcResult } from '../../lib/affData'
import { monthActuals } from '../../lib/affLink'
import type { AffProject } from '../../lib/affProjects'
import { approvalByModel, buildLedger, ledgerItems, type AhData, type ApprovalStat, type LedgerItem, type Model3, type SharedThresholds, type WsData } from '../../lib/affSource'
import { useApp } from '../../lib/ctx'
import { errMsg, getAffConfig, insertMany, listAll, saveAffConfig, update } from '../../lib/db'
import { addDays, addMonths, monthEnd, today } from '../../lib/dates'

/** Tải cấu hình + bảng phân bổ Affiliate + ngưỡng dùng chung (Research/Ads-Hub); tự chốt tháng đã qua cửa sổ sửa.
 *  Chốt tháng lưu bản chụp mô hình v2 (hệ số, phí, thuế, ngưỡng Research/Ads-Hub). */
export function useAff() {
  const { uid, toast } = useApp()
  const [cfg, setCfg] = useState<AffConfig | null>(null)
  const [months, setMonths] = useState<AffMonth[]>([])
  const [err, setErr] = useState('')
  const [th, setTh] = useState<SharedThresholds | null>(null)
  const t0 = today()

  const load = useCallback(async () => {
    try {
      const [c, ms, t] = await Promise.all([getAffConfig(uid), listAll<AffMonth>('aff_months', 'month'), loadThresholds().catch(() => null)])
      const locked = anyLocked(ms)
      const auto = ms.filter((m) => needsAutoLock(m, t0, c.edit_days, locked))
      for (const m of auto) {
        const coeffs = snapshotV2(c, t ?? {})
        const locked_at = new Date().toISOString()
        await update('aff_months', m.id, { coeffs, locked_at })
        Object.assign(m, { coeffs, locked_at })
        await closePrev(ms, m.month)
      }
      setCfg(c)
      setMonths(ms)
      setTh(t)
      setErr('')
    } catch (e) {
      setErr(errMsg(e))
    }
  }, [uid, t0])
  useEffect(() => {
    load()
  }, [load])

  const patchMonth = useCallback(
    async (id: string, p: Partial<AffMonth>) => {
      setMonths((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
      try {
        await update('aff_months', id, p)
      } catch (e) {
        toast(errMsg(e))
      }
    },
    [toast],
  )
  const addMonths = useCallback(
    async (rows: Record<string, unknown>[]) => {
      try {
        const added = await insertMany<AffMonth>('aff_months', rows)
        setMonths((xs) => [...xs, ...added].sort((a, b) => a.month.localeCompare(b.month)))
      } catch (e) {
        toast(errMsg(e))
      }
    },
    [toast],
  )
  const lockMonth = useCallback(
    async (m: AffMonth) => {
      if (!cfg) return
      await patchMonth(m.id, { coeffs: snapshotV2(cfg, th ?? {}), locked_at: new Date().toISOString() })
      await closePrev(months, m.month, (id, actuals) => setMonths((xs) => xs.map((x) => (x.id === id ? { ...x, actuals } : x))))
      toast(`Đã chốt kế hoạch Affiliate tháng ${m.month.slice(5, 7)}/${m.month.slice(0, 4)}`)
    },
    [cfg, th, months, patchMonth, toast],
  )
  const saveCfg = useCallback(
    async (c: AffConfig) => {
      try {
        const u = await saveAffConfig(c)
        setCfg(u)
        toast('Đã lưu mô hình Affiliate')
      } catch (e) {
        toast(errMsg(e))
      }
    },
    [toast],
  )
  const live: Live = { max_test_usd: th?.max_test_usd ?? null }
  return { cfg, months, err, reload: load, patchMonth, addMonths, lockMonth, saveCfg, th, live, anyLocked: anyLocked(months) }
}

/** Chốt kế hoạch tháng M = chốt sổ tháng M−1: lưu số thực tế của tháng M−1 (chưa có bản chụp thì mới lưu). */
async function closePrev(ms: AffMonth[], month: string, onSaved?: (id: string, a: Record<string, unknown>) => void) {
  const prev = ms.find((x) => x.month === addMonths(month, -1))
  if (!prev || prev.actuals) return
  try {
    const d = await loadAffData(true)
    const a = monthActuals(d, prev.month, monthEnd(prev.month), new Date().toISOString()) as unknown as Record<string, unknown>
    await update('aff_months', prev.id, { actuals: a })
    prev.actuals = a
    onSaved?.(prev.id, a)
  } catch {
    // không chặn việc chốt tháng nếu chưa đọc được số
  }
}

/* ---------- Sổ dự án: Research + Ads-Hub ---------- */
export interface Links {
  rows: AffProject[]
  add: (row: Record<string, unknown>) => Promise<AffProject | null>
  patch: (id: string, part: Partial<AffProject>) => Promise<void> | void
}
export type Item = LedgerItem<AffProject>
export interface Ledger {
  ws: SrcResult<WsData> | null
  ah: SrcResult<AhData> | null
  items: Item[]
  appr: Record<Model3, ApprovalStat> | null
  cfg: AffConfig | null
  th: SharedThresholds | null
  live: Live
}

/** Đọc Research + Ads-Hub (400 ngày gần nhất) và tính cờ cho từng dự án đã lên camp. Dùng chung cho bảng mục tiêu và danh sách việc. */
export function useLedger(links: Links): Ledger {
  const aff = useAff()
  const t0 = today()
  const [ws, setWs] = useState<SrcResult<WsData> | null>(null)
  const [ah, setAh] = useState<SrcResult<AhData> | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadWs(), loadAh(addDays(t0, -399), t0)]).then(([w, a]) => {
      if (!alive) return
      setWs(w)
      setAh(a)
    })
    return () => {
      alive = false
    }
  }, [t0])
  const cfg = aff.cfg
  const wsD = ws?.data ?? null
  const ahD = ah?.data ?? null
  const rows = useMemo(() => (wsD ? buildLedger(wsD, ahD) : []), [wsD, ahD])
  if (!cfg || !wsD) return { ws, ah, items: [], appr: null, cfg, th: aff.th, live: aff.live }
  const co = coeffsOf({ coeffs: null }, cfg, aff.live)
  const payout: Record<Model3, number> = { phys: co.phys.payout_days, tools_ai: co.tools.payout_days, saas: co.saas.payout_days }
  const appr = ahD ? approvalByModel(ahD, wsD, t0, payout) : null
  const thr = aff.th ?? { usd_vnd: null, max_test_usd: null, roa: null, winner_orders: null, click_rules: [] }
  const items: Item[] = ledgerItems(rows, links.rows, thr, { capMult: cfg.test_cap_mult, testCost: co.phys.test_cost, roa: co.phys.roas, winner: cfg.win_min_orders ?? 3 }, ahD, appr, t0)
  return { ws, ah, items, appr, cfg, th: aff.th, live: aff.live }
}
export const testing = (x: Item) => x.r.test_status === 'Đang Testing'
/** Dự án cần anh làm gì đó: nên dừng, cân nhắc dừng, chờ dùng thử (đang test) hoặc ứng viên thắng / đủ điều kiện scale. */
export const needsAction = (x: Item) => x.win.candidate || x.win.ready || (testing(x) && ['stop', 'consider', 'trial'].includes(x.stop.level))

