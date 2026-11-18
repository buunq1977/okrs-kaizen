import { useCallback, useEffect, useState } from 'react'
import { anyLockedV2, type AffConfig, type AffMonth, type Live, needsAutoLock, snapshotV2 } from '../../lib/affiliate'
import { loadThresholds } from '../../lib/affData'
import type { SharedThresholds } from '../../lib/affSource'
import { useApp } from '../../lib/ctx'
import { errMsg, getAffConfig, insertMany, listAll, saveAffConfig, update } from '../../lib/db'
import { today } from '../../lib/dates'

/** Tải cấu hình + bảng phân bổ Affiliate + ngưỡng dùng chung (Research/Ads-Hub); tự chốt tháng đã qua cửa sổ sửa.
 *  Khoá đầu kỳ chỉ tính các tháng chốt theo mô hình v2 (mở khoá một lần, Luca duyệt 18/11/2026). */
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
      const lockedV2 = anyLockedV2(ms)
      const auto = ms.filter((m) => needsAutoLock(m, t0, c.edit_days, lockedV2))
      for (const m of auto) {
        const coeffs = snapshotV2(c, t ?? {})
        const locked_at = new Date().toISOString()
        await update('aff_months', m.id, { coeffs, locked_at })
        Object.assign(m, { coeffs, locked_at })
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
      toast(`Đã chốt kế hoạch Affiliate tháng ${m.month.slice(5, 7)}/${m.month.slice(0, 4)}`)
    },
    [cfg, th, patchMonth, toast],
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
  return { cfg, months, err, reload: load, patchMonth, addMonths, lockMonth, saveCfg, th, live, anyLocked: anyLockedV2(months) }
}
