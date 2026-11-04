import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { errMsg, getMainObjective, getPeriod, insert, remove, update, type Table } from './db'
import type { KaizenData, Objective, Period, PeriodKind, Settings } from './types'

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

/** Tải (hoặc tạo) một kỳ; sửa từng phần, ghi ngay lên Supabase. */
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
        if (!live) return
        ref.current = x
        setP(x)
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
      ref.current = { ...cur, ...fields }
      setP(ref.current)
      try {
        await update('periods', cur.id, fields)
      } catch (e) {
        toast(errMsg(e))
      }
    },
    [toast],
  )
  const patchKaizen = useCallback((part: Partial<KaizenData>) => patch({ kaizen: { ...ref.current!.kaizen, ...part } }), [patch])
  return { p, patch, patchKaizen }
}

/** O duy nhất của kỳ Ngày/Tuần: tải (hoặc tạo) và sửa từng phần. */
export function useMainObjective(periodId: string) {
  const { uid, toast } = useApp()
  const [o, setO] = useState<Objective | null>(null)
  const ref = useRef<Objective | null>(null)
  useEffect(() => {
    if (!periodId) return
    let live = true
    getMainObjective(uid, periodId)
      .then((x) => {
        if (!live) return
        ref.current = x
        setO(x)
      })
      .catch((e) => toast(errMsg(e)))
    return () => {
      live = false
    }
  }, [uid, periodId, toast])
  const patch = useCallback(
    async (fields: Partial<Objective>) => {
      const cur = ref.current
      if (!cur) return
      ref.current = { ...cur, ...fields }
      setO(ref.current)
      try {
        await update('objectives', cur.id, fields)
      } catch (e) {
        toast(errMsg(e))
      }
    },
    [toast],
  )
  return { o, patch }
}

/** Danh sách dòng của một bảng: tải lại khi `key` đổi; thêm/sửa/xoá cập nhật ngay trên màn hình. */
export function useRows<T extends { id: string }>(table: Table, key: string, load: () => Promise<T[]>) {
  const { toast } = useApp()
  const [rows, setRows] = useState<T[]>([])
  const [ready, setReady] = useState(false)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const reload = useCallback(async () => {
    try {
      setRows(await loadRef.current())
      setReady(true)
    } catch (e) {
      toast(errMsg(e))
    }
  }, [toast])

  useEffect(() => {
    setReady(false)
    reload()
  }, [key, reload])

  const add = useCallback(
    async (row: Record<string, unknown>) => {
      try {
        const r = await insert<T>(table, row)
        setRows((x) => [...x, r])
        return r
      } catch (e) {
        toast(errMsg(e))
        return null
      }
    },
    [table, toast],
  )
  const patch = useCallback(
    async (id: string, part: Partial<T>) => {
      setRows((x) => x.map((r) => (r.id === id ? { ...r, ...part } : r)))
      try {
        await update(table, id, part as Record<string, unknown>)
      } catch (e) {
        toast(errMsg(e))
        reload()
      }
    },
    [table, toast, reload],
  )
  const del = useCallback(
    async (id: string) => {
      setRows((x) => x.filter((r) => r.id !== id))
      try {
        await remove(table, id)
      } catch (e) {
        toast(errMsg(e))
        reload()
      }
    },
    [table, toast, reload],
  )
  return { rows, ready, reload, add, patch, del }
}
