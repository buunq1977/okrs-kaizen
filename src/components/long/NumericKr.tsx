import { useState } from 'react'
import { useApp } from '../../lib/ctx'
import { fmtDM, today } from '../../lib/dates'
import { evenPlan, funnelPace, quarterMilestones, type KrStat, type LongKind } from '../../lib/numeric'
import { fmtNum } from '../../lib/pace'
import { repeatLabel } from '../../lib/schedule'
import type { IncomeModel, KR, Leading, ScheduleSeries } from '../../lib/types'
import { Txt, toNum } from '../ui'

const uid = () => Math.random().toString(36).slice(2, 10)
const n = (v: string) => toNum(v)

export function StatusPill({ v, color }: { v: number | null; color: string }) {
  return (
    <span className={'pill ' + color} title="Tình trạng = thực tế cộng dồn / kế hoạch cộng dồn đến hôm nay">
      TT {v === null ? '–' : v + '%'}
    </span>
  )
}

/** Thẻ 1 KR số (§4.3, §8.3–§8.5). */
export function NumericKr(props: {
  kr: KR
  st: KrStat
  kind: LongKind
  area: string
  end: string
  locked: boolean
  checkpoints: string[]
  entries: { date: string; value: number; source: string }[]
  parents: { kr: KR; label: string }[]
  models: IncomeModel[]
  series: ScheduleSeries[]
  onPatch: (p: Partial<KR>) => void
  onAddActual: (date: string, value: number, note: string) => void
  onAdjust: () => void
  onDelete: () => void
}) {
  const { kr, st, kind, area, end, locked, checkpoints, entries, parents, models, series, onPatch, onAddActual, onAdjust, onDelete } = props
  const { settings: s } = useApp()
  const [act, setAct] = useState({ date: today() < end ? today() : end, value: '', note: '' })
  const [showLog, setShowLog] = useState(false)
  const b = kr.baseline ?? null
  const t = kr.target ?? null
  const gain = b !== null && t !== null ? t - b : null
  const plannedFrac = gain ? Math.max(0, Math.min(1, st.plannedGain / gain)) : 0
  const model = models.find((m) => m.id === kr.income_model_id)
  const pace = model ? funnelPace(model) : null
  const leading = kr.leading_ind ?? []
  const plan = kr.cumulative_plan ?? []
  const lockedNum = locked // sau khi chốt: đổi số qua "Điều chỉnh"

  const setLeading = (list: Leading[]) => onPatch({ leading_ind: list })
  const changedFromOrig = kr.orig_target != null && (kr.orig_target !== kr.target || (kr.orig_deadline ?? null) !== (kr.deadline ?? null))

  return (
    <div className={'nkr ' + st.color + (kr.status && kr.status !== 'active' ? ' off' : '')}>
      <div className="nkr-h">
        <Txt className="strong" value={kr.title} onSave={(v) => onPatch({ title: v })} placeholder="Kết quả đo được, VD: Số người hoạt động mới" label="Tên KR" />
        {kr.is_team && <span className="tag kz">Đội ngũ</span>}
        {kr.is_coef && <span className="tag kz">Đo hệ số</span>}
        {kr.status === 'paused' && <span className="tag">Tạm dừng</span>}
        {kr.status === 'stopped' && <span className="tag dropped">Đã dừng</span>}
        <span className={'pill ' + st.color}>{st.pct === null ? '–' : st.pct + '%'}</span>
        <StatusPill v={st.status} color={st.color} />
        {locked ? (
          <button className="btn" onClick={onAdjust}>
            Điều chỉnh
          </button>
        ) : (
          <button className="x" aria-label="Xoá KR" onClick={onDelete}>
            ×
          </button>
        )}
      </div>

      <div className="nkr-f">
        <label className="fld">
          <span>Từ</span>
          <Txt type="number" value={b === null ? '' : String(b)} onSave={(v) => onPatch({ baseline: n(v) })} disabled={lockedNum} placeholder="0" />
        </label>
        <label className="fld">
          <span>Đến</span>
          <Txt type="number" value={t === null ? '' : String(t)} onSave={(v) => onPatch({ target: n(v) })} disabled={lockedNum} placeholder="10" />
        </label>
        <label className="fld">
          <span>Đơn vị</span>
          <Txt value={kr.unit} onSave={(v) => onPatch({ unit: v })} placeholder="người" />
        </label>
        <label className="fld">
          <span>Hạn</span>
          <input type="date" value={kr.deadline ?? ''} disabled={lockedNum} onChange={(e) => onPatch({ deadline: e.target.value || null })} />
        </label>
        <label className="fld wide2">
          <span>Nguồn đo</span>
          <Txt value={kr.source} onSave={(v) => onPatch({ source: v })} placeholder="VD: bảng theo dõi hệ thống" />
        </label>
      </div>
      {changedFromOrig && (
        <p className="note">
          Bản gốc: {fmtNum(kr.orig_target!)} {kr.unit}
          {kr.orig_deadline ? ` trước ${fmtDM(kr.orig_deadline)}` : ''} → hiện tại {t !== null ? fmtNum(t) : '–'} {kr.unit}
          {kr.deadline ? ` trước ${fmtDM(kr.deadline)}` : ''}
        </p>
      )}

      {gain !== null && (
        <div className={'pace ' + st.color}>
          <div className="pbar">
            <i style={{ width: (st.pct ?? 0) + '%' }} />
            <em style={{ left: plannedFrac * 100 + '%' }} />
          </div>
          <small>
            Thực tế <b>{st.actual === null ? '–' : fmtNum(st.actual)}</b> {kr.unit} · kế hoạch đến hôm nay {b !== null ? fmtNum(Math.round((b + st.plannedGain) * 10) / 10) : '–'} · đích {fmtNum(t!)}
            {st.triggered && <b className="trig"> · Trễ &gt;{s.trigger_lag_pct}% {s.trigger_weeks} mốc liên tiếp</b>}
          </small>
        </div>
      )}

      <div className="addrow nkr-act">
        <input type="date" value={act.date} onChange={(e) => setAct({ ...act, date: e.target.value })} aria-label="Ngày" />
        <input className="num" inputMode="decimal" value={act.value} onChange={(e) => setAct({ ...act, value: e.target.value })} placeholder="+ tăng" aria-label="Phần tăng thêm" />
        <input value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value })} placeholder="Ghi chú (tuỳ chọn)" aria-label="Ghi chú" />
        <button
          className="btn"
          disabled={n(act.value) === null}
          onClick={() => {
            onAddActual(act.date, n(act.value)!, act.note.trim())
            setAct({ ...act, value: '', note: '' })
          }}
        >
          Ghi thực tế
        </button>
        <button className="linkbtn" onClick={() => setShowLog(!showLog)}>
          {entries.length} lần ghi
        </button>
      </div>
      {showLog && (
        <ul className="log">
          {entries.map((e, i) => (
            <li key={i}>
              {fmtDM(e.date)}: {e.value > 0 ? '+' : ''}
              {fmtNum(e.value)} <small>· {e.source}</small>
            </li>
          ))}
        </ul>
      )}

      <div className="nkr-x">
        {parents.length > 0 && (
          <label className="fld">
            <span>{kind === 'month' ? 'Phân kỳ của KR quý/năm' : 'Mốc của KR năm'}</span>
            <select
              value={kr.parent_kr_id ?? ''}
              disabled={lockedNum}
              onChange={(e) => {
                const p = parents.find((x) => x.kr.id === e.target.value)?.kr
                const part: Partial<KR> = { parent_kr_id: e.target.value || null }
                if (p && kr.baseline == null && kr.target == null) Object.assign(part, { unit: p.unit, source: p.source, baseline: p.baseline, target: p.target })
                onPatch(part)
              }}
            >
              <option value="">— không gắn —</option>
              {parents.map((x) => (
                <option key={x.kr.id} value={x.kr.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="li">
          <input type="checkbox" checked={!!kr.is_team} onChange={() => onPatch({ is_team: !kr.is_team })} /> KR đội ngũ tự vận hành / đòn bẩy
        </label>
        <label className="li">
          <input type="checkbox" checked={!!kr.is_coef} onChange={() => onPatch({ is_coef: !kr.is_coef })} /> KR đo hệ số
        </label>
      </div>

      {kind === 'year' && b !== null && t !== null && (
        <div className="miles">
          <span className="fld-l">4 mốc quý</span>
          {[1, 2, 3, 4].map((q) => {
            const m = (kr.milestones ?? []).find((x) => x.q === q)
            return (
              <label key={q} className="fld">
                <span>Q{q}</span>
                <Txt
                  type="number"
                  value={m ? String(m.value) : ''}
                  disabled={lockedNum}
                  onSave={(v) => {
                    const rest = (kr.milestones ?? []).filter((x) => x.q !== q)
                    const val = n(v)
                    onPatch({ milestones: val === null ? rest : [...rest, { q, value: val }].sort((x, y) => x.q - y.q) })
                  }}
                />
              </label>
            )
          })}
          {!lockedNum && (
            <button className="btn" onClick={() => onPatch({ milestones: quarterMilestones(b, t) })}>
              Chia đều 4 quý
            </button>
          )}
        </div>
      )}

      {(kind === 'year' || (kind === 'month' && area === 'cv_tc')) && (
        <label className="fld">
          <span>Mô hình thu nhập (nhịp độ chia ngược)</span>
          <select value={kr.income_model_id ?? ''} onChange={(e) => onPatch({ income_model_id: e.target.value || null })}>
            <option value="">— không dùng —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || 'Mô hình chưa đặt tên'}
              </option>
            ))}
          </select>
        </label>
      )}
      {pace && (
        <p className={'note ' + (pace.overCapacity ? 'err' : '')}>
          {pace.ok
            ? `Nhịp độ${pace.estimated ? ' (ước lượng)' : ''}: ${fmtNum(Math.ceil(pace.stages[0].perWeek))} ${pace.stages[0].name}/tuần · ${fmtNum(Math.ceil(pace.topPerDay * 10) / 10)}/ngày${pace.overCapacity ? ' — VƯỢT công suất cá nhân, cần KR đội ngũ' : ''}`
            : `Mô hình còn thiếu: ${pace.missing.join(', ')}`}
        </p>
      )}

      {kind === 'month' && area === 'cv_tc' && (
        <>
          <div className="cum">
            <div className="fld-l">
              Kế hoạch cộng dồn theo tuần (phần tăng so với điểm bắt đầu)
              {!lockedNum && gain !== null && (
                <button className="linkbtn" onClick={() => onPatch({ cumulative_plan: evenPlan(checkpoints, gain) })}>
                  {' '}
                  Chia đều
                </button>
              )}
            </div>
            <div className="cum-r">
              {checkpoints.map((d, i) => {
                const pt = plan.find((x) => x.date === d)
                return (
                  <label key={d} className="fld">
                    <span>
                      T{i + 1} · {fmtDM(d)}
                    </span>
                    <Txt
                      type="number"
                      value={pt ? String(pt.planned) : ''}
                      disabled={lockedNum}
                      onSave={(v) => {
                        const rest = plan.filter((x) => x.date !== d)
                        const val = n(v)
                        onPatch({ cumulative_plan: val === null ? rest : [...rest, { date: d, planned: val }].sort((x, y) => x.date.localeCompare(y.date)) })
                      }}
                    />
                  </label>
                )
              })}
            </div>
          </div>
          <div className="lead">
            <div className="fld-l">Chỉ số dẫn trước (việc làm hằng tuần dẫn tới kết quả)</div>
            {leading.map((l) => (
              <div key={l.id} className="lead-r">
                <Txt value={l.name} onSave={(v) => setLeading(leading.map((x) => (x.id === l.id ? { ...x, name: v } : x)))} placeholder="VD: cuộc gọi" label="Tên chỉ số" />
                <Txt className="num" type="number" value={l.per_week === null ? '' : String(l.per_week)} onSave={(v) => setLeading(leading.map((x) => (x.id === l.id ? { ...x, per_week: n(v) } : x)))} placeholder="/tuần" label="Chỉ tiêu mỗi tuần" />
                {checkpoints.map((d, i) => {
                  const v = l.actuals?.[d]
                  const low = v !== undefined && l.per_week !== null && v < l.per_week
                  return (
                    <Txt
                      key={d}
                      className={'num ' + (low ? 'need' : '')}
                      type="number"
                      value={v === undefined ? '' : String(v)}
                      onSave={(x) => setLeading(leading.map((y) => (y.id === l.id ? { ...y, actuals: { ...y.actuals, [d]: n(x) ?? 0 } } : y)))}
                      placeholder={`T${i + 1}`}
                      label={`Thực tế tuần ${i + 1}`}
                    />
                  )
                })}
                <button className="x" aria-label="Xoá chỉ số" onClick={() => setLeading(leading.filter((x) => x.id !== l.id))}>
                  ×
                </button>
              </div>
            ))}
            <button className="add" onClick={() => setLeading([...leading, { id: uid(), name: '', per_week: null, actuals: {} }])}>
              + Chỉ số dẫn trước
            </button>
          </div>
        </>
      )}

      {kind === 'month' && area !== 'cv_tc' && (
        <label className="fld">
          <span>Tự đếm từ lịch lặp lại (mỗi lần Check ở trang Ngày = +1)</span>
          <select value={kr.series_id ?? ''} onChange={(e) => onPatch({ series_id: e.target.value || null })}>
            <option value="">— nhập tay —</option>
            {series.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title} · {repeatLabel(x)} {x.time_from.slice(0, 5)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
