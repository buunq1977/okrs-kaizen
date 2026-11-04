import { useState } from 'react'
import { useApp } from '../../lib/ctx'
import { errMsg, insert, update } from '../../lib/db'
import { changeRule, type CauseGroup, type ChangeType } from '../../lib/numeric'
import type { KR } from '../../lib/types'
import { toNum } from '../ui'

export const CAUSES: { id: CauseGroup; label: string; sign: string }[] = [
  { id: 'a', label: '(a) Đầu vào thiếu: làm chưa đủ', sign: 'Chỉ số dẫn trước thấp hơn nhịp độ' },
  { id: 'b', label: '(b) Chuyển đổi thấp: làm đủ mà ít kết quả', sign: 'Dẫn trước đạt, tỷ lệ chuyển đổi thấp hơn hệ số mô hình' },
  { id: 'c', label: '(c) Giữ chân kém: có vào nhưng rời đi', sign: 'Tỷ lệ giữ chân thực tế thấp hơn hệ số' },
  { id: 'd', label: '(d) Yếu tố bên ngoài', sign: 'Ghi sự kiện cụ thể + ngày' },
]

type Mode = 'target' | 'method' | 'pause' | 'stop'

/** Điều chỉnh KR sau khi chốt, theo luật §11.5. Mọi thay đổi ghi vào lịch sử phiên bản. */
export function ChangeDialog(props: { kr: KR; periodId: string; inReview: boolean; lowersThisQuarter: number; stopsThisQuarter: number; openKrs: number; onDone: () => void; onCancel: () => void }) {
  const { kr, periodId, inReview, lowersThisQuarter, stopsThisQuarter, openKrs, onDone, onCancel } = props
  const { settings: s, toast } = useApp()
  const [mode, setMode] = useState<Mode>('target')
  const [target, setTarget] = useState(kr.target === null || kr.target === undefined ? '' : String(kr.target))
  const [deadline, setDeadline] = useState(kr.deadline ?? '')
  const [reason, setReason] = useState('')
  const [cause, setCause] = useState<CauseGroup | ''>('')
  const [evidence, setEvidence] = useState('')
  const [mentor, setMentor] = useState('')
  const [busy, setBusy] = useState(false)

  const b = kr.baseline ?? 0
  const sign = Math.sign((kr.target ?? 0) - b) || 1
  const nt = toNum(target)
  const lowerTarget = nt !== null && kr.target != null && (nt - b) * sign < (kr.target - b) * sign
  const laterDeadline = !!deadline && !!kr.deadline && deadline > kr.deadline
  const type: ChangeType = mode === 'method' ? 'method' : mode === 'pause' ? 'pause' : mode === 'stop' ? 'stop' : lowerTarget || laterDeadline ? 'lower' : 'raise'
  const verdict = changeRule({ type, inReview, cause: cause || null, evidence, lowersThisQuarter, stopsThisQuarter, openKrs, mentor }, s)
  const changed = mode !== 'target' || nt !== kr.target || deadline !== (kr.deadline ?? '')
  const ok = verdict.allowed && reason.trim() && changed && (mode !== 'target' || nt !== null)

  async function submit() {
    setBusy(true)
    try {
      const after: Record<string, unknown> =
        mode === 'target' ? { target: nt, deadline: deadline || null } : mode === 'pause' ? { status: 'paused' } : mode === 'stop' ? { status: 'stopped' } : {}
      const pending = verdict.pending
      const now = new Date()
      await insert('plan_changes', {
        kr_id: kr.id,
        period_id: periodId,
        type,
        before: { target: kr.target, deadline: kr.deadline, status: kr.status },
        after,
        reason: reason.trim(),
        cause_group: cause || null,
        evidence: evidence.trim(),
        mentor: mentor.trim(),
        status: pending ? 'pending' : 'applied',
        apply_at: pending ? new Date(now.getTime() + s.change_cooldown_h * 3600e3).toISOString() : null,
        applied_at: pending ? null : now.toISOString(),
      })
      if (!pending && Object.keys(after).length) await update('key_results', kr.id, after)
      toast(pending ? `Đã ghi đề xuất. Áp dụng sau ${s.change_cooldown_h} giờ (huỷ được trước đó).` : 'Đã điều chỉnh, lưu vào lịch sử phiên bản.')
      onDone()
    } catch (e) {
      toast(errMsg(e))
    }
    setBusy(false)
  }

  return (
    <div className="change" role="dialog" aria-label="Điều chỉnh KR">
      <div className="fcheck-h">Điều chỉnh: {kr.title || 'KR'}</div>
      <div className="seg3" role="group" aria-label="Loại điều chỉnh">
        {(
          [
            ['target', 'Đổi đích / hạn'],
            ['method', 'Đổi cách làm'],
            ['pause', 'Tạm dừng'],
            ['stop', 'Dừng'],
          ] as const
        ).map(([m, l]) => (
          <button key={m} className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'target' && (
        <div className="grid2">
          <label className="fld">
            <span>Đích mới (hiện {kr.target ?? '–'} {kr.unit})</span>
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="fld">
            <span>Hạn mới (hiện {kr.deadline ?? '–'})</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>
      )}
      {(type === 'lower' || type === 'stop') && (
        <>
          <p className="note">
            {type === 'lower' ? 'Đây là HẠ mục tiêu (đích thấp hơn hoặc lùi hạn).' : 'Dừng KR.'} Chọn nhóm nguyên nhân và ghi số liệu chứng minh.
          </p>
          <div className="list">
            {CAUSES.map((c) => (
              <label key={c.id} className={'li pick ' + (cause === c.id ? 'hl' : '')}>
                <input type="radio" name="cause" checked={cause === c.id} onChange={() => setCause(c.id)} />
                <span>
                  {c.label} <small>· {c.sign}</small>
                </span>
              </label>
            ))}
          </div>
          <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Số liệu, VD: gọi 160/160, hẹn/gọi 8% < 20% trong mô hình" aria-label="Số liệu chứng minh" />
        </>
      )}
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do điều chỉnh (bắt buộc)" aria-label="Lý do" />
      {verdict.needMentor && <input value={mentor} onChange={(e) => setMentor(e.target.value)} placeholder="Tên mentor đã duyệt (vượt giới hạn điều chỉnh)" aria-label="Mentor duyệt" />}
      {!verdict.allowed && verdict.reason && <p className="flag">{verdict.reason}</p>}
      {verdict.allowed && verdict.pending && <p className="note">Đang ngoài buổi rà: thay đổi thành đề xuất, áp dụng sau {s.change_cooldown_h} giờ.</p>}
      <div className="addrow">
        <button className="btn primary" disabled={!ok || busy} onClick={submit}>
          {verdict.pending ? 'Ghi đề xuất điều chỉnh' : 'Áp dụng điều chỉnh'}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </div>
  )
}
