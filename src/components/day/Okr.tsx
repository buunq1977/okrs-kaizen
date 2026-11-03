import { useState } from 'react'
import { useApp } from '../../lib/ctx'
import { looksLikeAction, O_CRITERIA, SMART5 } from '../../lib/okr'
import type { KA, KR, Period } from '../../lib/types'
import { Criteria, PctPill, Txt, toNum } from '../ui'

type KrRows = {
  rows: KR[]
  add: (r: Record<string, unknown>) => Promise<KR | null>
  patch: (id: string, p: Partial<KR>) => Promise<void>
  del: (id: string) => Promise<void>
}
type KaRows = {
  rows: KA[]
  add: (r: Record<string, unknown>) => Promise<KA | null>
  patch: (id: string, p: Partial<KA>) => Promise<void>
  del: (id: string) => Promise<void>
}

/** Ô "liên quan" kèm lý do bắt buộc (§3). */
export function LinkToggle({ linked, reason, onChange, label, disabled }: { linked: boolean; reason: string; onChange: (p: { linked?: boolean; link_reason?: string }) => void; label: string; disabled?: boolean }) {
  const [draft, setDraft] = useState(reason)
  const [open, setOpen] = useState(false)
  if (linked)
    return (
      <div className="link on">
        <label className="li">
          <input type="checkbox" checked disabled={disabled} onChange={() => onChange({ linked: false })} />
          <b>{label}</b>
        </label>
        <Txt value={reason} onSave={(v) => v.trim() && onChange({ link_reason: v.trim() })} disabled={disabled} placeholder="Đạt thì O cấp trên tiến lên thế nào, đo bằng gì?" />
      </div>
    )
  return (
    <div className="link">
      {!open ? (
        <label className="li">
          <input type="checkbox" checked={false} disabled={disabled} onChange={() => setOpen(true)} />
          {label}
        </label>
      ) : (
        <div className="addrow">
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Đạt thì O cấp trên tiến lên thế nào, đo bằng gì? (bắt buộc)" aria-label="Lý do liên quan" />
          <button
            className="btn"
            disabled={!draft.trim()}
            onClick={() => {
              onChange({ linked: true, link_reason: draft.trim() })
              setOpen(false)
            }}
          >
            Đánh dấu liên quan
          </button>
          <button className="btn ghost" onClick={() => setOpen(false)}>
            Huỷ
          </button>
        </div>
      )}
    </div>
  )
}

/** Bước 5 · Tiêu điểm O. */
export function Objective({ p, patch, editable, weekTitle, causes }: { p: Period; patch: (f: Partial<Period>) => void; editable: boolean; weekTitle: string; causes: string[] }) {
  return (
    <div className="objective">
      {causes.length > 0 && (
        <p className="note">
          O phải xử lý nguyên nhân, không xử lý triệu chứng. Nguyên nhân đã tìm: <b>{causes.join(' · ')}</b>
        </p>
      )}
      <Txt className="focus-title" value={p.o_title} onSave={(v) => patch({ o_title: v })} disabled={!editable} placeholder="Viết 1 câu tiêu điểm cho ngày" />
      <Criteria keys={O_CRITERIA} value={p.o_smart} onChange={(v) => patch({ o_smart: v })} disabled={!editable} />
      {(p.o_smart?.M || p.o_metric) && (
        <label className="fld inline">
          <span>Số đo (M)</span>
          <Txt value={p.o_metric} onSave={(v) => patch({ o_metric: v })} disabled={!editable} placeholder="Con số / dấu hiệu đo, VD: 20 data, 3 cuộc hẹn" />
          {p.o_smart?.M && !p.o_metric.trim() && <span className="flag">M chưa có số đo</span>}
        </label>
      )}
      <LinkToggle
        linked={p.linked}
        reason={p.link_reason}
        label={weekTitle ? `Liên quan O tuần: “${weekTitle}”` : 'Liên quan O tuần (tuần này chưa đặt O)'}
        onChange={(x) => patch(x)}
        disabled={!editable}
      />
    </div>
  )
}

/** Bước 6–7 · KR và KA. */
export function KrBlocks(props: { periodId: string; krs: KrRows; kas: KaRows; pcts: number[]; editable: boolean; canAdd: boolean; addBlockedMsg: string }) {
  const { periodId, krs, kas, pcts, editable, canAdd, addBlockedMsg } = props
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
            <div key={k.id} className={'krb ' + (k.linked ? 'linked' : '')}>
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
              {(k.smart?.M || k.metric) && (
                <Txt value={k.metric} onSave={(v) => krs.patch(k.id, { metric: v })} disabled={!editable} placeholder="Số đo (M), VD: 5 data đăng ký" />
              )}
              {k.smart?.M && !k.metric.trim() && <span className="flag">M chưa có số đo</span>}
              <LinkToggle linked={k.linked} reason={k.link_reason} label="Liên quan trực tiếp O ngày" onChange={(x) => krs.patch(k.id, x)} disabled={!editable} />
              {s.weights_enabled && (
                <label className="fld inline">
                  <span>Trọng số</span>
                  <Txt type="number" value={k.weight === null ? '' : String(k.weight)} onSave={(v) => krs.patch(k.id, { weight: toNum(v) && toNum(v)! > 0 ? toNum(v) : null })} disabled={!editable} placeholder="1" />
                </label>
              )}

              <div className="kas">
                {list.map((a) => (
                  <div key={a.id} className={'ka ' + (a.done ? 'done' : '')}>
                    <input type="checkbox" checked={a.done} aria-label="Xong" onChange={() => kas.patch(a.id, { done: !a.done })} />
                    <Txt value={a.title} onSave={(v) => v.trim() && kas.patch(a.id, { title: v.trim() })} disabled={!editable} label="KA" />
                    {a.from_action_id && <span className="tag kz">Kaizen</span>}
                    {s.weights_enabled && (
                      <Txt className="num" type="number" value={a.weight === null ? '' : String(a.weight)} onSave={(v) => kas.patch(a.id, { weight: toNum(v) && toNum(v)! > 0 ? toNum(v) : null })} disabled={!editable} placeholder="1" label="Trọng số" />
                    )}
                    {editable && (
                      <button className="x" aria-label="Xoá KA" onClick={() => kas.del(a.id)}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="check-line">Hoàn thành các KA này thì KR có đạt không? Còn có thể làm gì nữa để KR đạt trọn vẹn?</p>
              {editable && canAdd && (
                <div className="addrow">
                  <input
                    value={kaDraft[k.id] ?? ''}
                    onChange={(e) => setKaDraft({ ...kaDraft, [k.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addKa(k)}
                    placeholder="Động từ + việc cụ thể, VD: Đăng ký 5 data"
                    aria-label="KA mới"
                  />
                  <button className="btn" onClick={() => addKa(k)} disabled={!(kaDraft[k.id] ?? '').trim()}>
                    + Thêm KA
                  </button>
                </div>
              )}

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
          <button className="add" disabled={full} onClick={() => krs.add({ period_id: periodId, title: '', sort: krs.rows.length })}>
            {full ? `Đã đủ tối đa ${s.day_max_kr} KR` : `+ Thêm KR${krs.rows.length + 1}`}
          </button>
        ) : (
          <p className="flag">{addBlockedMsg}</p>
        ))}
      {krs.rows.length < s.day_min_kr && <p className="note">Ngày cần ít nhất {s.day_min_kr} KR. Hỏi: để O hoàn thành cần những KR nào?</p>}
    </>
  )
}
