import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { errMsg, getPeriod, update } from './db'
import type { KaizenData, Observe, Period, PeriodKind, Settings } from './types'

export interface AppCtx {
  uid: string
  settings: Settings
  setSettings: (s: Settings) => void
  toast: (msg: string) => void
  go: (screen: string, date?: string) => void
}
export const Ctx = createContext<AppCtx | null>(null)
export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('Thiếu AppCtx')
  return c
}

/** Tải (hoặc tạo) một kỳ và cho phép sửa từng phần, ghi ngay lên Supabase. */
export function usePeriod(kind: PeriodKind, start: string) {
  const { uid, toast } = useApp()
  const [p, setP] = useState<Period | null>(null)
  const ref = useRef<Period | null>(null)

  useEffect(() => {
    let live = true
    setP(null)
    ref.current = null
    getPeriod(uid, kind, start)
      .then((x) => {
        if (live) {
          ref.current = x
          setP(x)
        }
      })
      .catch((e) => toast(errMsg(e)))
    return () => {
      live = false
    }
  }, [uid, kind, start, toast])

  const patch = useCallback(
    async (fields: Partial<Period>) => {
      const cur = ref.current
      if (!cur) return
      const next = { ...cur, ...fields }
      ref.current = next
      setP(next)
      try {
        await update('periods', cur.id, fields)
      } catch (e) {
        toast(errMsg(e))
      }
    },
    [toast],
  )
  const patchObserve = useCallback((part: Partial<Observe>) => patch({ observe: { ...ref.current!.observe, ...part } }), [patch])
  const patchKaizen = useCallback((part: Partial<KaizenData>) => patch({ kaizen: { ...ref.current!.kaizen, ...part } }), [patch])
  return { p, patch, patchObserve, patchKaizen }
}
