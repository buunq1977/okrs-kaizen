import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Sec, Txt, toNum, PaceBar } from '../components/ui'
import { useApp } from '../lib/ctx'
import { errMsg, insert, listGoals, listMetrics, listVisions, remove, update } from '../lib/db'
import { today } from '../lib/dates'
import { fmtNum, goalStatus } from '../lib/pace'
import type { Goal, GoalStatus, Metric, Vision } from '../lib/types'

const MAX_ACTIVE = 5
const MAX_VISIONS = 3
const STATUS_VI: Record<GoalStatus, string> = { active: 'Đang mở', paused: 'Tạm dừng', dropped: 'Đã bỏ', done: 'Hoàn thành' }

export default function Goals() {
  const { toast } = useApp()
  const [visions, setVisions] = useState<Vision[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const [v, g, m] = await Promise.all([listVisions(), listGoals(), listMetrics()])
      setVisions(v)
      setGoals(g)
      setMetrics(m)
      setLoaded(true)
    } catch (e) {
      toast(errMsg(e))
    }
  }, [toast])
  useEffect(() => {
    load()
  }, [load])

  const active = goals.filter((g) => g.status === 'active')
  const others = goals.filter((g) => g.status !== 'active')

  if (!loaded) return <p className="note">Đang tải mục tiêu…</p>

  return (
    <div className="stack">
      <Sec title="Tầm nhìn 5 năm" hint={`Tối đa ${MAX_VISIONS}. Mỗi tầm nhìn phải có con số và năm đích.`}>
        {visions.map((v) => (
          <VisionRow key={v.id} v={v} onChange={load} />
        ))}
        {visions.length < MAX_VISIONS ? <VisionForm onDone={load} /> : <p className="note">Đã đủ {MAX_VISIONS} tầm nhìn.</p>}
      </Sec>

      <Sec title={`Mục tiêu năm · ${active.length}/${MAX_ACTIVE} đang mở`} hint="Mỗi mục tiêu: điểm xuất phát, đích, đơn vị, hạn chót và ít nhất 1 chỉ số hành động.">
        {!active.length && <p className="empty">Chưa có mục tiêu năm. Bắt đầu bằng mục tiêu quan trọng nhất của 12 tháng tới.</p>}
        {active.map((g) => (
          <GoalCard key={g.id} g={g} visions={visions} metrics={metrics.filter((m) => m.goal_id === g.id)} onChange={load} canActivate />
        ))}
        {active.length < MAX_ACTIVE ? (
          <GoalForm visions={visions} onDone={load} />
        ) : (
          <p className="warnbox">Đã đủ {MAX_ACTIVE} mục tiêu đang mở. Muốn thêm mục tiêu mới, hãy Tạm dừng hoặc Bỏ một mục tiêu ở trên trước.</p>
        )}
      </Sec>

      {!!others.length && (
        <Sec title="Tạm dừng · Hoàn thành · Đã bỏ">
          {others.map((g) => (
            <GoalCard key={g.id} g={g} visions={visions} metrics={metrics.filter((m) => m.goal_id === g.id)} onChange={load} canActivate={active.length < MAX_ACTIVE} />
          ))}
        </Sec>
      )}
    </div>
  )
}

function VisionRow({ v, onChange }: { v: Vision; onChange: () => void }) {
  const { toast } = useApp()
  const save = async (part: Partial<Vision>) => {
    try {
      await update('visions', v.id, part)
      onChange()
    } catch (e) {
      toast(errMsg(e))
    }
  }
  return (
    <div className="vision">
      <Txt className="strong" value={v.title} onSave={(x) => x.trim() && save({ title: x.trim() })} label="Tầm nhìn" />
      <div className="nums">
        <Txt type="number" value={String(v.target_value)} onSave={(x) => toNum(x) !== null && save({ target_value: toNum(x)! })} label="Con số" />
        <Txt value={v.unit} onSave={(x) => x.trim() && save({ unit: x.trim() })} label="Đơn vị" />
        <Txt type="number" value={String(v.target_year)} onSave={(x) => toNum(x) !== null && save({ target_year: toNum(x)! })} label="Năm đích" />
        <button
          className="x"
          aria-label="Xoá tầm nhìn"
          onClick={async () => {
            try {
              await remove('visions', v.id)
              onChange()
            } catch (e) {
              toast(errMsg(e))
            }
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function VisionForm({ onDone }: { onDone: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState({ title: '', value: '', unit: '', year: String(new Date().getFullYear() + 5) })
  const ok = f.title.trim() && toNum(f.value) !== null && f.unit.trim() && toNum(f.year)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    try {
      await insert('visions', { title: f.title.trim(), target_value: toNum(f.value), unit: f.unit.trim(), target_year: toNum(f.year) })
      setF({ ...f, title: '', value: '', unit: '' })
      onDone()
    } catch (e) {
      toast(errMsg(e))
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <label className="fld wide">
        <span>Tầm nhìn mới</span>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="VD: Agency affiliate tự vận hành" />
      </label>
      <label className="fld">
        <span>Con số</span>
        <input inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="VD: 5" />
      </label>
      <label className="fld">
        <span>Đơn vị</span>
        <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="VD: tỷ đồng/năm" />
      </label>
      <label className="fld">
        <span>Năm đích</span>
        <input inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
      </label>
      <button className="btn primary" disabled={!ok}>
        Thêm tầm nhìn
      </button>
    </form>
  )
}

function GoalForm({ visions, onDone }: { visions: Vision[]; onDone: () => void }) {
  const { toast } = useApp()
  const empty = { title: '', baseline: '0', target: '', unit: '', deadline: `${new Date().getFullYear() + 1}-${today().slice(5)}`, vision: '', lname: '', lunit: '' }
  const [f, setF] = useState(empty)
  const [open, setOpen] = useState(false)
  const missing: string[] = []
  if (!f.title.trim()) missing.push('tên mục tiêu')
  if (toNum(f.baseline) === null) missing.push('điểm xuất phát')
  if (toNum(f.target) === null) missing.push('con số đích')
  else if (toNum(f.target) === toNum(f.baseline)) missing.push('đích khác điểm xuất phát')
  if (!f.unit.trim()) missing.push('đơn vị')
  if (!f.deadline) missing.push('hạn chót')
  if (!f.lname.trim() || !f.lunit.trim()) missing.push('chỉ số hành động')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (missing.length) return
    try {
      const g = await insert<Goal>('goals', {
        title: f.title.trim(),
        baseline: toNum(f.baseline),
        current: toNum(f.baseline),
        target: toNum(f.target),
        unit: f.unit.trim(),
        deadline: f.deadline,
        vision_id: f.vision || null,
      })
      await insert('metrics', { goal_id: g.id, name: f.lname.trim(), unit: f.lunit.trim(), kind: 'leading' })
      setF(empty)
      setOpen(false)
      onDone()
    } catch (e) {
      toast(errMsg(e))
    }
  }

  if (!open)
    return (
      <button className="add" onClick={() => setOpen(true)}>
        + Thêm mục tiêu năm
      </button>
    )
  return (
    <form className="form goal-form" onSubmit={submit}>
      <label className="fld wide">
        <span>Mục tiêu năm</span>
        <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="VD: Doanh thu affiliate từ Google Ads" />
      </label>
      <label className="fld">
        <span>Điểm xuất phát</span>
        <input inputMode="decimal" value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} />
      </label>
      <label className="fld">
        <span>Đích</span>
        <input inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="VD: 120000" />
      </label>
      <label className="fld">
        <span>Đơn vị</span>
        <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="VD: USD commission" />
      </label>
      <label className="fld">
        <span>Hạn chót</span>
        <input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
      </label>
      <label className="fld wide">
        <span>Phục vụ tầm nhìn</span>
        <select value={f.vision} onChange={(e) => setF({ ...f, vision: e.target.value })}>
          <option value="">— không gắn —</option>
          {visions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </label>
      <div className="leading wide">
        <b>Chỉ số hành động (bắt buộc)</b> · việc bạn tự làm được mỗi ngày/tuần, không phụ thuộc may rủi.
        <div className="grid2">
          <label className="fld">
            <span>Tên chỉ số</span>
            <input value={f.lname} onChange={(e) => setF({ ...f, lname: e.target.value })} placeholder="VD: Campaign mới launch" />
          </label>
          <label className="fld">
            <span>Đơn vị</span>
            <input value={f.lunit} onChange={(e) => setF({ ...f, lunit: e.target.value })} placeholder="VD: campaign" />
          </label>
        </div>
      </div>
      <div className="wide form-f">
        <button className="btn primary" disabled={!!missing.length}>
          Lưu mục tiêu
        </button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
          Huỷ
        </button>
        {!!missing.length && <span className="flag">Còn thiếu: {missing.join(', ')}</span>}
      </div>
    </form>
  )
}

function GoalCard({ g, visions, metrics, onChange, canActivate }: { g: Goal; visions: Vision[]; metrics: Metric[]; onChange: () => void; canActivate: boolean }) {
  const { toast, settings } = useApp()
  const [dropping, setDropping] = useState(false)
  const [reason, setReason] = useState('')
  const [m, setM] = useState({ name: '', unit: '', kind: 'leading' as 'leading' | 'lagging' })
  const save = async (part: Partial<Goal>) => {
    try {
      await update('goals', g.id, part)
      onChange()
    } catch (e) {
      toast(errMsg(e))
    }
  }
  const { frac } = goalStatus(g, today(), settings)
  const vision = visions.find((v) => v.id === g.vision_id)
  const hasLeading = metrics.some((x) => x.kind === 'leading')

  return (
    <div className={'goal ' + g.status}>
      <div className="goal-h">
        <Txt className="strong" value={g.title} onSave={(x) => x.trim() && save({ title: x.trim() })} label="Tên mục tiêu" disabled={g.status !== 'active'} />
        <span className={'tag ' + g.status}>{STATUS_VI[g.status]}</span>
      </div>
      <div className="goal-meta">
        Từ {fmtNum(g.baseline)} → <b>{fmtNum(g.target)} {g.unit}</b> · hạn {g.deadline.split('-').reverse().join('/')}
        {vision && <> · phục vụ “{vision.title}”</>}
        {g.status === 'dropped' && g.drop_reason && <> · lý do bỏ: {g.drop_reason}</>}
      </div>
      {g.status === 'active' && (
        <>
          <PaceBar actual={g.current - g.baseline} target={g.target - g.baseline} frac={frac} unit={g.unit} label="Tiến độ năm (tăng thêm so với điểm xuất phát)" />
          <label className="fld inline">
            <span>Giá trị hiện tại</span>
            <Txt type="number" value={String(g.current)} onSave={(x) => toNum(x) !== null && save({ current: toNum(x)! })} label="Giá trị hiện tại" />
            <span className="unit">{g.unit}</span>
          </label>
        </>
      )}
      <div className="metrics">
        <div className="fld-l">Chỉ số</div>
        {metrics.map((x) => (
          <div key={x.id} className="metric">
            <span className={'kind ' + x.kind}>{x.kind === 'leading' ? 'Hành động' : 'Kết quả'}</span>
            {x.name} <small>({x.unit})</small>
            {(x.kind !== 'leading' || metrics.filter((y) => y.kind === 'leading').length > 1) && (
              <button
                className="x"
                aria-label="Xoá chỉ số"
                onClick={async () => {
                  try {
                    await remove('metrics', x.id)
                    onChange()
                  } catch (e) {
                    toast(errMsg(e))
                  }
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!hasLeading && <p className="flag">Chưa có chỉ số hành động: mục tiêu này chưa thể kích hoạt trong tháng.</p>}
        {g.status === 'active' && (
          <div className="addrow">
            <select value={m.kind} onChange={(e) => setM({ ...m, kind: e.target.value as 'leading' | 'lagging' })} aria-label="Loại chỉ số">
              <option value="leading">Hành động</option>
              <option value="lagging">Kết quả</option>
            </select>
            <input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="Tên chỉ số" aria-label="Tên chỉ số" />
            <input value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value })} placeholder="Đơn vị" aria-label="Đơn vị chỉ số" className="short" />
            <button
              className="btn"
              disabled={!m.name.trim() || !m.unit.trim()}
              onClick={async () => {
                try {
                  await insert('metrics', { goal_id: g.id, name: m.name.trim(), unit: m.unit.trim(), kind: m.kind })
                  setM({ name: '', unit: '', kind: 'leading' })
                  onChange()
                } catch (e) {
                  toast(errMsg(e))
                }
              }}
            >
              Thêm
            </button>
          </div>
        )}
      </div>
      <div className="goal-a">
        {g.status === 'active' && (
          <>
            <button className="btn" onClick={() => save({ status: 'paused' })}>
              Tạm dừng
            </button>
            <button className="btn" onClick={() => save({ status: 'done' })}>
              Đánh dấu hoàn thành
            </button>
            <button className="btn danger" onClick={() => setDropping(true)}>
              Bỏ mục tiêu
            </button>
          </>
        )}
        {g.status !== 'active' && (
          <button className="btn" disabled={!canActivate} title={canActivate ? '' : 'Đã đủ 5 mục tiêu đang mở'} onClick={() => save({ status: 'active', drop_reason: null })}>
            Mở lại
          </button>
        )}
      </div>
      {dropping && (
        <div className="confirm">
          <label className="fld">
            <span>Vì sao bỏ? (bắt buộc)</span>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: thị trường không còn, ưu tiên mục tiêu X" />
          </label>
          <button className="btn danger" disabled={!reason.trim()} onClick={() => save({ status: 'dropped', drop_reason: reason.trim() })}>
            Xác nhận bỏ
          </button>
          <button className="btn ghost" onClick={() => setDropping(false)}>
            Huỷ
          </button>
        </div>
      )}
    </div>
  )
}
