import { useState } from 'react'
import { useApp } from '../../lib/ctx'
import { focusAutoChecks, looksLikeAction, O_CRITERIA, SMART5 } from '../../lib/okr'
import type { KA, KR, Objective } from '../../lib/types'
import { Criteria, PctPill, Txt, toNum } from '../ui'

type Rows<T> = {
  rows: T[]
  add: (r: Record<string, unknown>) => Promise<T | null>
  patch: (id: string, p: Partial<T>) => Promise<void>
  del: (id: string) => Promise<void>
}

/** Giải thích + ví dụ cho từng tiêu chí (C14). */
const GUIDE: Record<string, { q: string; why: string; good: string; bad: string }> = {
  S: { q: 'Tất cả đều hiểu?', why: 'Người khác đọc 1 lần là hiểu bạn sẽ làm xong cái gì, không cần giải thích thêm.', good: 'Chốt 3 lịch hẹn tư vấn tuyển dụng với data mới', bad: 'Đẩy mạnh tuyển dụng' },
  M: { q: 'Đo lường được?', why: 'Có con số hoặc dấu hiệu nhìn thấy để biết cuối ngày đạt hay chưa.', good: 'Đích: 3 lịch hẹn', bad: 'Làm tốt hơn hôm qua' },
  A: { q: 'Khả thi?', why: 'Vừa với quỹ thời gian còn lại sau lịch cố định và năng lực hiện tại.', good: '3 hẹn trong 2 khung gọi 09:30 và 14:00', bad: '20 hẹn khi chỉ còn 1 giờ trống' },
  R: { q: 'Quan trọng nhất?', why: 'Quan trọng nhất trong các việc làm được kỳ này để đạt O cấp trên.', good: 'Phục vụ KR tuần "10 hẹn"', bad: 'Việc gấp nhưng không dẫn tới mục tiêu tuần' },
  T: { q: 'Thời gian rõ ràng?', why: 'Biết hạn chót. Với O ngày, mặc định là hết ngày; ghi rõ nếu sớm hơn.', good: 'Trước 17:00', bad: 'Khi nào rảnh' },
  KRO: { q: 'Các KR đạt thì O có đạt không?', why: 'Hình dung 3 KR đã xong 100%. Nếu O vẫn có thể chưa đạt thì KR còn thiếu hoặc chọn sai.', good: 'KR: chuẩn bị kịch bản · gọi 20 data · chốt hẹn', bad: 'KR: đọc sách · dọn bàn · trả lời tin nhắn' },
}

function FocusCheck({ o, krCount, minKr, load, onDone }: { o: Objective; krCount: number; minKr: number; load: number; onDone: (smart: Objective['smart']) => void }) {
  const auto = focusAutoChecks(o, krCount, minKr, load)
  const [i, setI] = useState(0)
  const [ans, setAns] = useState<Record<string, boolean>>({ ...o.smart } as Record<string, boolean>)
  const [k] = O_CRITERIA[i]
  const g = GUIDE[k]
  const a = auto[k]
  const last = i === O_CRITERIA.length - 1
  return (
    <div className="fcheck" role="dialog" aria-label="Kiểm tra tiêu điểm">
      <div className="fcheck-h">
        Kiểm tra tiêu điểm · {i + 1}/{O_CRITERIA.length}
      </div>
      <p className="fcheck-o">“{o.title || 'Chưa viết tiêu điểm'}”</p>
      <h4>
        {k.length === 1 ? k + ' · ' : ''}
        {g.q}
      </h4>
      <p>{g.why}</p>
      <div className="grid2 ex">
        <span className="good">Đạt: {g.good}</span>
        <span className="bad">Chưa đạt: {g.bad}</span>
      </div>
      {a.ok === false && <p className="flag">{a.note}</p>}
      <div className="addrow">
        <button className="btn primary" disabled={a.ok === false} onClick={() => (setAns({ ...ans, [k]: true }), last ? onDone({ ...ans, [k]: true }) : setI(i + 1))}>
          Đạt
        </button>
        <button className="btn" onClick={() => (setAns({ ...ans, [k]: false }), last ? onDone({ ...ans, [k]: false }) : setI(i + 1))}>
          Chưa đạt, sửa lại
        </button>
        {i > 0 && (
          <button className="btn ghost" onClick={() => setI(i - 1)}>
            ‹ Câu trước
          </button>
        )}
        <button className="btn ghost" onClick={() => onDone(ans)}>
          Đóng
        </button>
      </div>
    </div>
  )
}

/** Bước 5 · Tiêu điểm O. */
export function ObjectiveBlock(props: {
  level: 'day' | 'week'
  o: Objective
  patch: (f: Partial<Objective>) => void
  editable: boolean
  causes: string[]
  krCount: number
  load: number
  weekKrs?: KR[]
  weekKas?: KA[]
  /** Tuần: KR tháng để ghi "đóng góp vào" (C5, §3.1). */
  monthKrs?: KR[]
  weekTargetHint?: string
}) {
  const { level, o, patch, editable, causes, krCount, load, weekKrs = [], weekKas = [], monthKrs = [], weekTargetHint } = props
  const { settings: s } = useApp()
  const [checking, setChecking] = useState(false)
  const serves = o.serves_ka_id ? 'ka:' + o.serves_ka_id : o.serves_kr_id ? 'kr:' + o.serves_kr_id : ''
  return (
    <div className="objective">
      {causes.length > 0 && (
        <p className="note">
          O phải xử lý nguyên nhân, không xử lý triệu chứng. Nguyên nhân đã tìm: <b>{causes.join(' · ')}</b>
        </p>
      )}
      <Txt className="focus-title" value={o.title} onSave={(v) => patch({ title: v })} disabled={!editable} placeholder={`Viết 1 câu tiêu điểm cho ${level === 'day' ? 'ngày' : 'tuần'}`} />
      <div className="grid2">
        <label className="fld">
          <span>Số đo O (M)</span>
          <Txt value={o.o_metric} onSave={(v) => patch({ o_metric: v })} disabled={!editable} placeholder="VD: số lịch hẹn chốt được" />
        </label>
        <label className="fld">
          <span>Đích số (nếu có)</span>
          <Txt type="number" value={o.o_target === null ? '' : String(o.o_target)} onSave={(v) => patch({ o_target: toNum(v) })} disabled={!editable} placeholder="VD: 3" />
        </label>
      </div>
      <Criteria keys={O_CRITERIA} value={o.smart} onChange={(v) => patch({ smart: v })} disabled={!editable} />
      {o.smart?.M && !o.o_metric.trim() && o.o_target === null && <span className="flag">M chưa có số đo</span>}
      {editable && !checking && (
        <button className="btn" onClick={() => setChecking(true)}>
          ✓ Kiểm tra tiêu điểm (6 tiêu chí)
        </button>
      )}
      {checking && (
        <FocusCheck
          o={o}
          krCount={krCount}
          minKr={s.day_min_kr}
          load={load}
          onDone={(smart) => {
            patch({ smart })
            setChecking(false)
          }}
        />
      )}
      {level === 'week' ? (
        <div className="grid2">
          <label className="fld">
            <span>Đóng góp vào KR tháng</span>
            <select value={o.contributes_kr_id ?? ''} disabled={!editable} onChange={(e) => patch({ contributes_kr_id: e.target.value || null })}>
              <option value="">{monthKrs.length ? '— chọn KR tháng —' : '— tháng này chưa có KR số (trang Tháng làm sau) —'}</option>
              {monthKrs.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Chỉ tiêu tuần</span>
            <Txt type="number" value={o.weekly_target === null ? '' : String(o.weekly_target)} onSave={(v) => patch({ weekly_target: toNum(v) })} disabled={!editable} placeholder={weekTargetHint ?? 'VD: 3'} />
          </label>
        </div>
      ) : (
      <label className="fld">
        <span>Phục vụ KR / KA tuần (khuyến nghị)</span>
        <select
          value={serves}
          disabled={!editable}
          onChange={(e) => {
            const [t, id] = e.target.value.split(':')
            patch({ serves_kr_id: t === 'kr' ? id : null, serves_ka_id: t === 'ka' ? id : null })
          }}
        >
          <option value="">{weekKrs.length ? '— không gắn (việc nền) —' : '— tuần này chưa có KR —'}</option>
          {weekKrs.map((k, i) => (
            <optgroup key={k.id} label={`KR${i + 1} tuần: ${k.title || '(chưa đặt tên)'}`}>
              <option value={'kr:' + k.id}>Cả KR{i + 1}</option>
              {weekKas
                .filter((a) => a.kr_id === k.id)
                .map((a) => (
                  <option key={a.id} value={'ka:' + a.id}>
                    KA: {a.title}
                    {a.done ? ' ✓' : ''}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      )}
    </div>
  )
}

/** Bước 6–7 · KR và KA (KA là cấp dưới của từng KR). */
export function KrBlocks(props: { periodId: string; objectiveId: string; krs: Rows<KR>; kas: Rows<KA>; pcts: number[]; editable: boolean; canAdd: boolean; addBlockedMsg: string }) {
  const { periodId, objectiveId, krs, kas, pcts, editable, canAdd, addBlockedMsg } = props
  const { settings: s } = useApp()
  const [kaDraft, setKaDraft] = useState<Record<string, string>>({})
  const [ovOpen, setOvOpen] = useState<Record<string, { pct: string; reason: string } | undefined>>({})
  const full = krs.rows.length >= s.day_max_kr

  async function addKa(k: KR) {
    const t = (kaDraft[k.id] ?? '').trim()
    if (!t) return
    await kas.add({ kr_id: k.id, title: t, sort: kas.rows.filter((a) => a.kr_id === k.id).length })
    setKaDraft({ ...kaDraft, [k.id]: '' })
  }

  return (
    <>
      <div className="kr-grid">
        {krs.rows.map((k, i) => {
          const list = kas.rows.filter((a) => a.kr_id === k.id)
          const ov = ovOpen[k.id]
          return (
            <div key={k.id} className="krb">
              <div className="krb-h">
                <b>KR{i + 1}</b>
                {k.from_action_id && <span className="tag kz">Từ Kaizen</span>}
                <PctPill pct={pcts[i]} />
                {editable && (
                  <button className="x" aria-label="Xoá KR" onClick={() => krs.del(k.id)}>
                    ×
                  </button>
                )}
              </div>
              <Txt className="strong" value={k.title} onSave={(v) => krs.patch(k.id, { title: v })} disabled={!editable} placeholder="Kết quả đo được, VD: 100% kịch bản sẵn sàng" multiline rows={2} />
              {looksLikeAction(k.title) && <span className="flag">Viết như hành động. KR nên là kết quả đo được, hành động để ở KA.</span>}
              <Criteria keys={SMART5} value={k.smart} onChange={(v) => krs.patch(k.id, { smart: v })} disabled={!editable} />
              {(k.smart?.M || k.metric) && <Txt value={k.metric} onSave={(v) => krs.patch(k.id, { metric: v })} disabled={!editable} placeholder="Số đo (M), VD: 5 data đăng ký" />}
              {k.smart?.M && !k.metric.trim() && <span className="flag">M chưa có số đo</span>}
              {s.weights_enabled && (
                <label className="fld inline">
                  <span>Trọng số</span>
                  <Txt type="number" value={k.weight === null ? '' : String(k.weight)} onSave={(v) => krs.patch(k.id, { weight: (toNum(v) ?? 0) > 0 ? toNum(v) : null })} disabled={!editable} placeholder="1" />
                </label>
              )}

              <div className="kas">
                <div className="kas-h">KA của KR{i + 1}</div>
                {list.map((a) => (
                  <div key={a.id} className={'ka ' + (a.done ? 'done' : '')}>
                    <input type="checkbox" checked={a.done} aria-label="Xong" onChange={() => kas.patch(a.id, { done: !a.done })} />
                    <Txt value={a.title} onSave={(v) => v.trim() && kas.patch(a.id, { title: v.trim() })} disabled={!editable} label="KA" />
                    {a.from_action_id && <span className="tag kz">Kaizen</span>}
                    {s.weights_enabled && (
                      <Txt className="num" type="number" value={a.weight === null ? '' : String(a.weight)} onSave={(v) => kas.patch(a.id, { weight: (toNum(v) ?? 0) > 0 ? toNum(v) : null })} disabled={!editable} placeholder="1" label="Trọng số" />
                    )}
                    {editable && (
                      <button className="x" aria-label="Xoá KA" onClick={() => kas.del(a.id)}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {editable && canAdd && (
                  <div className="addrow">
                    <input
                      value={kaDraft[k.id] ?? ''}
                      onChange={(e) => setKaDraft({ ...kaDraft, [k.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addKa(k)}
                      placeholder="Động từ + việc cụ thể"
                      aria-label={`KA mới cho KR${i + 1}`}
                    />
                    <button className="btn" onClick={() => addKa(k)} disabled={!(kaDraft[k.id] ?? '').trim()}>
                      + KA
                    </button>
                  </div>
                )}
              </div>
              <p className="check-line">Hoàn thành các KA này thì KR có đạt không? Còn làm gì nữa để KR đạt trọn vẹn?</p>

              <div className="override">
                {k.pct_override !== null ? (
                  <span>
                    % chỉnh tay: <b>{k.pct_override}%</b> · {k.override_reason}{' '}
                    <button className="linkbtn" onClick={() => krs.patch(k.id, { pct_override: null, override_reason: null })}>
                      Bỏ chỉnh tay
                    </button>
                  </span>
                ) : !ov ? (
                  <button className="linkbtn" onClick={() => setOvOpen({ ...ovOpen, [k.id]: { pct: '', reason: '' } })}>
                    KA xong nhưng KR chưa đạt? Chỉnh % tay
                  </button>
                ) : (
                  <div className="addrow">
                    <input className="num" inputMode="decimal" value={ov.pct} onChange={(e) => setOvOpen({ ...ovOpen, [k.id]: { ...ov, pct: e.target.value } })} placeholder="%" aria-label="% thực tế" />
                    <input value={ov.reason} onChange={(e) => setOvOpen({ ...ovOpen, [k.id]: { ...ov, reason: e.target.value } })} placeholder="Lý do (bắt buộc)" aria-label="Lý do chỉnh %" />
                    <button
                      className="btn"
                      disabled={toNum(ov.pct) === null || toNum(ov.pct)! < 0 || toNum(ov.pct)! > 100 || !ov.reason.trim()}
                      onClick={() => {
                        krs.patch(k.id, { pct_override: toNum(ov.pct), override_reason: ov.reason.trim() })
                        setOvOpen({ ...ovOpen, [k.id]: undefined })
                      }}
                    >
                      Lưu
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {editable &&
        (canAdd ? (
          <button className="add" disabled={full} onClick={() => krs.add({ period_id: periodId, objective_id: objectiveId, title: '', sort: krs.rows.length })}>
            {full ? `Đã đủ tối đa ${s.day_max_kr} KR` : `+ Thêm KR${krs.rows.length + 1}`}
          </button>
        ) : (
          <p className="flag">{addBlockedMsg}</p>
        ))}
      {krs.rows.length < s.day_min_kr && <p className="note">Cần {s.day_min_kr} KR. Hỏi: để O hoàn thành cần những kết quả nào?</p>}
    </>
  )
}
