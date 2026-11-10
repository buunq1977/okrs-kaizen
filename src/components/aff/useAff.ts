import { useCallback, useEffect, useState } from 'react'
import { type AffConfig, type AffMonth, needsAutoLock, physOf, saasOf } from '../../lib/affiliate'
import { useApp } from '../../lib/ctx'
import { errMsg, getAffConfig, insertMany, listAll, saveAffConfig, update } from '../../lib/db'
import { today } from '../../lib/dates'

/** Tải cấu hình + bảng phân bổ Affiliate; tự chốt tháng đã qua cửa sổ sửa. */
export function useAff() {
  const { uid, toast } = useApp()
  const [cfg, setCfg] = useState<AffConfig | null>(null)
  const [months, setMonths] = useState<AffMonth[]>([])
  const [err, setErr] = useState('')
  const t0 = today()

  const load = useCallback(async () => {
    try {
      const [c, ms] = await Promise.all([getAffConfig(uid), listAll<AffMonth>('aff_months', 'month')])
      const anyLocked = ms.some((m) => m.locked_at)
      const auto = ms.filter((m) => needsAutoLock(m, t0, c.edit_days, anyLocked))
      for (const m of auto) {
        const coeffs = { phys: physOf(c.phys), saas: saasOf(c.saas) }
        const locked_at = new Date().toISOString()
        await update('aff_months', m.id, { coeffs, locked_at })
        Object.assign(m, { coeffs, locked_at })
      }
      setCfg(c)
      setMonths(ms)
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
      await patchMonth(m.id, { coeffs: { phys: physOf(cfg.phys), saas: saasOf(cfg.saas) }, locked_at: new Date().toISOString() })
      toast(`Đã chốt kế hoạch Affiliate tháng ${m.month.slice(5, 7)}/${m.month.slice(0, 4)}`)
    },
    [cfg, patchMonth, toast],
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
  return { cfg, months, err, reload: load, patchMonth, addMonths, lockMonth, saveCfg, anyLocked: months.some((m) => m.locked_at) }
}
