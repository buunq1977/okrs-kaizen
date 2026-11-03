import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../lib/ctx'
import { errMsg, getPeriod, insert, listActions, listCarried, remove, update } from '../lib/db'
import { shift } from '../lib/dates'
import type { Action, KaizenData, Observe, Period, VerifyRow } from '../lib/types'
import { Sec, SmartChips, Txt } from './ui'

const LV = { day: 'ngày', week: 'tuần', month: 'tháng' } as const
const NEXT = { day: 'ngày mai', week: 'tuần sau', month: 'tháng sau' } as const

/* ---------- Quan sát → Phân tích → Nguyên nhân lõi ---------- */
export function ObserveBlock({ p, save }: { p: Period; save: (o: Partial<Observe>) => void }) {
  const o = p.observe
  return (
    <Sec n="1b" title="Quan sát" hint="Điều gì đang diễn ra? Nếu không làm gì thì kết quả ra sao?">
      <div className="grid3">
        <label className="fld">
          <span>Công việc / Tài chính</span>
          <Txt multiline rows={4} value={o.work} onSave={(v) => save({ work: v })} placeholder="Mảng công việc chính, đầu tư…" />
        </label>
        <label className="fld">
          <span>Mối quan hệ</span>
          <Txt multiline rows={4} value={o.rel} onSave={(v) => save({ rel: v })} placeholder="Khách hàng, đối tác, mentor, gia đình…" />
        </label>
        <label className="fld">
          <span>Thân – Tâm – Trí</span>
          <Txt multiline rows={4} value={o.body} onSave={(v) => save({ body: v })} placeholder="Thân: tập luyện · Tâm: · Trí: đọc, học…" />
        </label>
      </div>
      <label className="fld">
        <span>2 · Phân tích</span>
        <Txt multiline value={o.analysis} onSave={(v) => save({ analysis: v })} placeholder="Đi sâu từng việc: gốc vấn đề nằm ở đâu?" />
      </label>
      <div className="grid2">
        <label className="fld">
          <span>3 · Nguyên nhân lõi: Tham</span>
          <Txt value={o.tham} onSave={(v) => save({ tham: v })} placeholder="Tham việc, ôm nhiều kết quả…" />
        </label>
        <label className="fld">
          <span>Si</span>
          <Txt value={o.si} onSave={(v) => save({ si: v })} placeholder="Chưa biết cách làm hiệu quả…" />
        </label>
      </div>
    </Sec>
  )
}

/* ---------- Kiểm chứng 3 chiều (tuần) ---------- */
const VERIFY: { key: 'top' | 'cross' | 'bottom'; title: string; hint: string; who: string[] }[] = [
  { key: 'top', title: 'Kiểm chứng trên xuống', hint: 'Người chịu ảnh hưởng bởi mục tiêu', who: ['Người 01', 'Người 02', 'Người 03'] },
  { key: 'cross', title: 'Kiểm chứng chéo', hint: 'Phòng ban / người khác ảnh hưởng', who: ['Phòng ban/Người 01', 'Phòng ban/Người 02', 'Phòng ban/Người 03'] },
  { key: 'bottom', title: 'Kiểm chứng dưới lên', hint: 'Sếp / Thầy / Mentor', who: ['Sếp', 'Thầy', 'Mentor'] },
]
export function VerifyBlock({ p, save }: { p: Period; save: (o: Partial<Observe>) => void }) {
  const v = p.observe.verify ?? {}
  const rows = (k: 'top' | 'cross' | 'bottom', ph: string[]) => v[k] ?? ph.map(() => ({ who: '', text: '', smart: {} }))
  const set = (k: 'top' | 'cross' | 'bottom', ph: string[], i: number, part: Partial<VerifyRow>) => {
    const next = rows(k, ph).map((r, j) => (j === i ? { ...r, ...part } : r))
    save({ verify: { ...v, [k]: next } })
  }
  return (
    <Sec title="Kiểm chứng 3 chiều" hint="Ai xác nhận KR tuần này thật sự đạt?">
      {VERIFY.map((g) => (
        <div key={g.key} className="vgroup">
          <div className="vtitle">
            {g.title} <span>· {g.hint}</span>
          </div>
          {rows(g.key, g.who).map((r, i) => (
            <div key={i} className="vrow">
              <Txt value={r.who} onSave={(x) => set(g.key, g.who, i, { who: x })} placeholder={g.who[i]} label="Người kiểm chứng" />
              <div>
                <Txt value={r.text} onSave={(x) => set(g.key, g.who, i, { text: x })} placeholder="Họ xác nhận điều gì, bằng con số nào?" label="Nội dung kiểm chứng" />
                <SmartChips value={r.smart ?? {}} onChange={(s) => set(g.key, g.who, i, { smart: s })} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </Sec>
  )
}

/* ---------- Hành động mang sang từ kỳ trước ---------- */
export function CarriedBlock({ p }: { p: Period }) {
  const { toast } = useApp()
  const [items, setItems] = useState<Action[]>([])
  useEffect(() => {
    listCarried(p.id).then(setItems).catch((e) => toast(errMsg(e)))
  }, [p.id, toast])
  if (!items.length) return null
  return (
    <Sec className="carry" title={`Từ Kaizen ${LV[p.kind]} trước`} hint="Hành động đã cam kết đưa vào kỳ này">
      <div className="list">
        {items.map((a) => (
          <label key={a.id} className={'li ' + (a.done ? 'done' : '')}>
            <input
              type="checkbox"
              checked={a.done}
              onChange={async () => {
                try {
                  const u = await update<Action>('actions', a.id, { done: !a.done })
                  setItems((xs) => xs.map((x) => (x.id === a.id ? u : x)))
                } catch (e) {
                  toast(errMsg(e))
                }
              }}
            />
            <span>{a.text}</span>
          </label>
        ))}
      </div>
    </Sec>
  )
}

/* ---------- Kaizen: Đo lường → Nguyên nhân → Bài học → Hành động ---------- */
export function KaizenBlock({ p, save, measure }: { p: Period; save: (k: Partial<KaizenData>) => void; measure: ReactNode }) {
  const { uid, toast } = useApp()
  const k = p.kaizen
  const [actions, setActions] = useState<Action[]>([])
  const [draft, setDraft] = useState('')
  const load = useCallback(() => listActions(p.id).then(setActions).catch((e) => toast(errMsg(e))), [p.id, toast])
  useEffect(() => {
    load()
  }, [load])

  async function add() {
    if (!draft.trim()) return
    try {
      const a = await insert<Action>('actions', { period_id: p.id, text: draft.trim() })
      setActions((xs) => [...xs, a])
      setDraft('')
    } catch (e) {
      toast(errMsg(e))
    }
  }
  async function patch(a: Action, part: Partial<Action>) {
    try {
      const u = await update<Action>('actions', a.id, part)
      setActions((xs) => xs.map((x) => (x.id === a.id ? u : x)))
    } catch (e) {
      toast(errMsg(e))
    }
  }
  async function togglePush(a: Action) {
    if (a.push_to_period_id) return patch(a, { push_to_period_id: null })
    try {
      const np = await getPeriod(uid, p.kind, shift(p.kind, p.start_date, 1))
      await patch(a, { push_to_period_id: np.id })
    } catch (e) {
      toast(errMsg(e))
    }
  }

  return (
    <>
      <Sec n="1" title="Đo lường" hint={`Hoàn thành bao nhiêu % tiêu điểm ${LV[p.kind]}?`}>
        {measure}
      </Sec>
      <Sec n="2" title="Nguyên nhân">
        <div className="fld-l">Nhật ký {LV[p.kind]} · đã làm gì, kết quả, còn gì nữa?</div>
        <div className="grid3">
          <label className="fld">
            <span>Sáng</span>
            <Txt multiline rows={4} value={k.s} onSave={(v) => save({ s: v })} />
          </label>
          <label className="fld">
            <span>Chiều</span>
            <Txt multiline rows={4} value={k.c} onSave={(v) => save({ c: v })} />
          </label>
          <label className="fld">
            <span>Tối</span>
            <Txt multiline rows={4} value={k.t} onSave={(v) => save({ t: v })} />
          </label>
        </div>
        <label className="fld">
          <span>Nguyên nhân % tiêu điểm · gốc rễ nào dẫn đến kết quả này?</span>
          <Txt multiline rows={3} value={k.causes} onSave={(v) => save({ causes: v })} />
        </label>
      </Sec>
      <Sec n="3" title="Bài học" hint="Đúc kết ngắn, nhắm đúng nguyên nhân gốc">
        <Txt multiline rows={3} value={k.lessons} onSave={(v) => save({ lessons: v })} label="Bài học" placeholder="Bắt buộc khi ngày đỏ: thiếu mục này app sẽ khoá thêm việc mới." />
      </Sec>
      <Sec n="4" title="Hành động tiếp theo" hint="Áp dụng ngay, có con số">
        {actions.map((a) => (
          <div key={a.id} className="act">
            <div className="li">
              <Txt value={a.text} onSave={(v) => v.trim() && patch(a, { text: v.trim() })} label="Hành động" />
              <button
                className="x"
                aria-label="Xoá hành động"
                onClick={async () => {
                  try {
                    await remove('actions', a.id)
                    setActions((xs) => xs.filter((x) => x.id !== a.id))
                  } catch (e) {
                    toast(errMsg(e))
                  }
                }}
              >
                ×
              </button>
            </div>
            <div className="act-f">
              <SmartChips value={a.smart ?? {}} onChange={(s) => patch(a, { smart: s })} />
              <button className="push" aria-pressed={!!a.push_to_period_id} onClick={() => togglePush(a)}>
                {a.push_to_period_id ? `✓ Đã đưa vào ${NEXT[p.kind]}` : `Đưa vào OKR ${NEXT[p.kind]}`}
              </button>
              {a.push_to_period_id && <span className={'badge ' + (a.done ? 'green' : 'none')}>{a.done ? 'Đã làm' : 'Chưa làm'}</span>}
            </div>
          </div>
        ))}
        <div className="addrow">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Hành động cụ thể, có con số" aria-label="Hành động mới" />
          <button className="btn" onClick={add} disabled={!draft.trim()}>
            Thêm
          </button>
        </div>
      </Sec>
    </>
  )
}

/* ---------- Tiêu điểm ---------- */
export function FocusBlock({ p, patch, pct, children, disabled }: { p: Period; patch: (f: Partial<Period>) => void; pct: number | null; children?: ReactNode; disabled?: boolean }) {
  return (
    <section className="sec focus">
      <h3>
        Tiêu điểm {LV[p.kind]}
        <span className="hint">Một tiêu điểm duy nhất. Đã nhắm vào gốc rễ chưa?</span>
      </h3>
      <div className="focus-row">
        <div className="ft">
          <Txt className="focus-title" value={p.focus_title} onSave={(v) => patch({ focus_title: v })} placeholder={`Tiêu điểm ${LV[p.kind]} này`} label="Tiêu điểm" disabled={disabled} />
          <SmartChips value={p.focus_smart ?? {}} onChange={(s) => patch({ focus_smart: s })} withO={p.kind !== 'day'} disabled={disabled} />
        </div>
        <div className="ring-w">
          <RingPct pct={pct} />
        </div>
      </div>
      {children}
    </section>
  )
}
function RingPct({ pct }: { pct: number | null }) {
  const p = pct ?? 0
  return (
    <div className="ring" style={{ ['--p' as string]: p }}>
      <span>{pct === null ? '–' : p + '%'}</span>
    </div>
  )
}
