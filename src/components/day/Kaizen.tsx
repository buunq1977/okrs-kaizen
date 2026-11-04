import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../../lib/ctx'
import { errMsg, getMainObjective, getPeriod, insert, listBy } from '../../lib/db'
import { addDays, fmtDM } from '../../lib/dates'
import { ACTION_CRITERIA, GAP_KEYWORD, gapSuggest, highlight } from '../../lib/okr'
import type { JournalRow, KA, KaizenData, KR, Lesson, NextAction, Objective, Period, PeriodKind } from '../../lib/types'
import { Criteria, FocusBand, PctPill, Step, Txt, toNum } from '../ui'

type ActRows = {
  rows: NextAction[]
  add: (r: Record<string, unknown>) => Promise<NextAction | null>
  patch: (id: string, p: Partial<NextAction>) => Promise<void>
  del: (id: string) => Promise<void>
}
const uid = () => Math.random().toString(36).slice(2, 10)

/** Tóm tắt OKR chỉ đọc ở đầu tab Kaizen (C19). */
export function OkrSummary({ o, krs, kas, pcts }: { o: Objective; krs: KR[]; kas: KA[]; pcts: number[] }) {
  return (
    <section className="summary">
      <div className="fld-l">Kế hoạch đã lập (chỉ đọc)</div>
      <b className="sum-o">{o.title || 'Chưa đặt tiêu điểm'}</b>
      {(o.o_metric || o.o_target !== null) && (
        <span className="note">
          Số đo O: {o.o_metric} {o.o_target !== null && `· đích ${o.o_target}`}
        </span>
      )}
      <div className="sum-krs">
        {krs.map((k, i) => (
          <div key={k.id} className="sum-kr">
            <div>
              <b>KR{i + 1}</b> {k.title} <PctPill pct={pcts[i]} />
            </div>
            <ul>
              {kas
                .filter((a) => a.kr_id === k.id)
                .map((a) => (
                  <li key={a.id} className={a.done ? 'done' : ''}>
                    {a.done ? '✓' : '○'} {a.title}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

const NEXT_LABEL = { day: 'ngày mai', week: 'tuần sau' } as const

/** Kaizen 4 bước cho Ngày (§6) và Tuần (§7). */
export function Kaizen(props: {
  level: 'day' | 'week'
  p: Period
  save: (k: Partial<KaizenData>) => void
  o: Objective
  patchO: (f: Partial<Objective>) => void
  exec: number | null
  actual: number | null
  acts: ActRows
  /** Dòng nhật ký gợi ý (từ lịch + KA đã tick ở Ngày; từ O các ngày ở Tuần). */
  prefill: () => { time: string; did: string; result?: string }[]
  /** Từ khoá đỏ lặp lại từ cấp dưới (Kaizen tuần tổng hợp từ các ngày). */
  suggest?: { keyword: string; count: number }[]
  suggestLessons?: string[]
  extraMeasure?: ReactNode
}) {
  const { level, p, save, o, patchO, exec, actual, acts, prefill: prefillRows, suggest = [], suggestLessons = [], extraMeasure } = props
  const { settings: s } = useApp()
  const k = p.kaizen ?? {}
  const keywords = k.keywords ?? []
  const lessons = k.lessons ?? []
  const journal: JournalRow[] = Array.isArray(k.journal) ? k.journal : []
  const [kw, setKw] = useState('')
  const [act, setAct] = useState('')

  const addKw = (w0?: string) => {
    const w = (w0 ?? kw).trim()
    if (!w || keywords.some((x) => x.toLowerCase() === w.toLowerCase())) return setKw('')
    save({ keywords: [...keywords, w] })
    setKw('')
  }
  const setLesson = (id: string, part: Partial<Lesson>) => save({ lessons: lessons.map((l) => (l.id === id ? { ...l, ...part } : l)) })
  const setRow = (id: string, part: Partial<JournalRow>) => save({ journal: journal.map((r) => (r.id === id ? { ...r, ...part } : r)) })

  /** Tự điền dòng nhật ký (C9). Chỉ thêm dòng chưa có. */
  function prefill() {
    const have = new Set(journal.map((r) => r.time + '|' + r.did))
    const rows = prefillRows()
      .filter((r) => r.did.trim() && !have.has(r.time + '|' + r.did))
      .map((r) => ({ id: uid(), time: r.time, did: r.did, result: r.result ?? '' }))
    if (rows.length) save({ journal: level === 'day' ? [...journal, ...rows].sort((a, b) => (a.time || '99').localeCompare(b.time || '99')) : [...journal, ...rows] })
  }
  const showGap = gapSuggest(exec, actual, s.gap_suggest_pts)

  return (
    <div className="kaizen">
      <Step n="1" title="Đo lường" hint="% thực thi lấy tự động từ KR/KA. Đo thêm O thực tế: tiêu điểm có đạt thật không?" open done={actual !== null}>
        <FocusBand title={o.title} exec={exec} actual={actual} />
        {o.o_target !== null ? (
          <label className="fld inline">
            <span>O thực tế ({o.o_metric || 'số đo'})</span>
            <Txt type="number" value={o.o_actual === null ? '' : String(o.o_actual)} onSave={(v) => patchO({ o_actual: toNum(v) })} placeholder="0" />
            <span className="unit">/ đích {o.o_target}</span>
          </label>
        ) : (
          <div className="seg3" role="group" aria-label="O thực tế">
            <span className="fld-l">O thực tế</span>
            {(
              [
                ['dat', 'Đạt'],
                ['mot_phan', 'Một phần'],
                ['chua', 'Chưa đạt'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} className="chip" aria-pressed={o.o_result === v} onClick={() => patchO({ o_result: o.o_result === v ? null : v })}>
                {l}
              </button>
            ))}
          </div>
        )}
        {showGap && (
          <div className="alert yellow">
            % thực thi {exec}% nhưng O thực tế {actual}%: các KR có thể chưa trúng O.{' '}
            {!keywords.includes(GAP_KEYWORD) && (
              <button className="btn" onClick={() => addKw(GAP_KEYWORD)}>
                Thêm từ khoá “{GAP_KEYWORD}”
              </button>
            )}
          </div>
        )}
        {extraMeasure}
        <Txt multiline value={k.assessment} onSave={(v) => save({ assessment: v })} placeholder="Đánh giá ngắn: vì sao ra con số này?" />
      </Step>

      <Step
        n="2a"
        title="Nhật ký"
        hint={level === 'day' ? 'Giờ nào · đã làm gì · kết quả ra sao. Chỉ ghi sự thật, có số liệu.' : 'Ngày nào · đã làm gì · kết quả ra sao. Điền sẵn từ O và % từng ngày.'}
        open
        done={journal.some((r) => r.result.trim())}
      >
        <button className="btn" onClick={prefill}>
          {level === 'day' ? 'Điền sẵn từ lịch và KA đã tick' : 'Điền sẵn từ các ngày trong tuần'}
        </button>
        <div className="journal">
          <div className="jr jh">
            <span>{level === 'day' ? 'Giờ' : 'Ngày'}</span>
            <span>Đã làm gì</span>
            <span>Kết quả</span>
            <span />
          </div>
          {journal.map((r) => (
            <div key={r.id} className="jr">
              <Txt value={r.time} onSave={(v) => setRow(r.id, { time: v })} placeholder={level === 'day' ? '09:30' : 'T2 02/11'} label={level === 'day' ? 'Giờ' : 'Ngày'} />
              <Txt value={r.did} onSave={(v) => setRow(r.id, { did: v })} placeholder="Gọi Phonetem 20 data" label="Đã làm gì" />
              <Txt value={r.result} onSave={(v) => setRow(r.id, { result: v })} placeholder="12 nghe máy, 2 hẹn" label="Kết quả" />
              <button className="x" aria-label="Xoá dòng" onClick={() => save({ journal: journal.filter((x) => x.id !== r.id) })}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="add" onClick={() => save({ journal: [...journal, { id: uid(), time: '', did: '', result: '' }] })}>
          + Thêm dòng
        </button>
      </Step>

      <Step n="2b" title="Nguyên nhân % tiêu điểm" hint="Nguyên nhân của cả thành công lẫn thất bại, tới tận cùng, dừng ở nguyên nhân đổi được bằng 1 hành động. Bôi đỏ từ khoá." open done={keywords.length > 0}>
        <Txt multiline rows={4} value={k.causes} onSave={(v) => save({ causes: v })} placeholder="VD: Chưa tập trung vì không rõ tiêu điểm từ tối hôm trước…" />
        <div className="addrow">
          <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addKw()} placeholder="Từ khoá nguyên nhân, VD: chưa tập trung" aria-label="Từ khoá đỏ" />
          <button className="btn" onClick={() => addKw()} disabled={!kw.trim()}>
            Bôi đỏ
          </button>
        </div>
        {suggest.filter((x) => !keywords.some((w) => w.toLowerCase() === x.keyword.toLowerCase())).length > 0 && (
          <div className="kws sugg">
            <span className="fld-l">Lặp lại trong tuần:</span>
            {suggest
              .filter((x) => !keywords.some((w) => w.toLowerCase() === x.keyword.toLowerCase()))
              .slice(0, 8)
              .map((x) => (
                <button key={x.keyword} className="chip" onClick={() => addKw(x.keyword)} title="Bấm để bôi đỏ">
                  + {x.keyword} ×{x.count}
                </button>
              ))}
          </div>
        )}
        {keywords.length > 0 && (
          <div className="kws">
            {keywords.map((w) => (
              <span key={w} className="kw">
                {w}
                <button aria-label={`Bỏ ${w}`} onClick={() => save({ keywords: keywords.filter((x) => x !== w) })}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {k.causes?.trim() && keywords.length > 0 && (
          <p className="hl-preview">{highlight(k.causes, keywords).map((seg, i) => (seg.hit ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>))}</p>
        )}
      </Step>

      <Step n="3" title="Bài học" hint="Đúc kết ngắn, dễ nhớ. Mỗi bài học gắn 1 từ khoá đỏ." open={keywords.length > 0} done={lessons.some((l) => l.text.trim())} lockedMsg="Bôi đỏ ít nhất 1 từ khoá ở bước 2b trước.">
        {lessons.map((l) => (
          <div key={l.id} className="lesson">
            <div className="li">
              <Txt className="strong" value={l.text} onSave={(v) => setLesson(l.id, { text: v })} placeholder="Bài học" />
              <button className="x" aria-label="Xoá bài học" onClick={() => save({ lessons: lessons.filter((x) => x.id !== l.id) })}>
                ×
              </button>
            </div>
            <div className="grid2">
              <select value={l.keyword} onChange={(e) => setLesson(l.id, { keyword: e.target.value })} aria-label="Gắn từ khoá" className={l.keyword ? '' : 'need'}>
                <option value="">— gắn từ khoá đỏ —</option>
                {keywords.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <Txt value={l.signal} onSave={(v) => setLesson(l.id, { signal: v })} placeholder="Dấu hiệu nhận biết khi nó xảy ra" />
            </div>
          </div>
        ))}
        <button className="add" onClick={() => save({ lessons: [...lessons, { id: uid(), text: '', keyword: keywords[0] ?? '', signal: '' }] })}>
          + Thêm bài học
        </button>
        {suggestLessons.length > 0 && (
          <div className="kws sugg">
            <span className="fld-l">Bài học từ các ngày:</span>
            {suggestLessons
              .filter((t) => !lessons.some((l) => l.text.trim().toLowerCase() === t.trim().toLowerCase()))
              .slice(0, 6)
              .map((t) => (
                <button key={t} className="chip" onClick={() => save({ lessons: [...lessons, { id: uid(), text: t, keyword: keywords[0] ?? '', signal: '' }] })}>
                  + {t}
                </button>
              ))}
          </div>
        )}
      </Step>

      <Step n="4" title="Hành động tiếp theo" hint={`Phát huy thành công, cải tiến thất bại. Tick đủ tiêu chí rồi chuyển vào OKR ${NEXT_LABEL[level]}.`} open={lessons.some((l) => l.text.trim())} done={acts.rows.some((a) => a.converted_period_id)} lockedMsg="Viết ít nhất 1 bài học trước.">
        {acts.rows.map((a) => (
          <div key={a.id} className="act">
            <div className="li">
              <Txt className="strong" value={a.text} onSave={(v) => acts.patch(a.id, { text: v })} placeholder="Hành động cụ thể" />
              {!a.converted_period_id && (
                <button className="x" aria-label="Xoá hành động" onClick={() => acts.del(a.id)}>
                  ×
                </button>
              )}
            </div>
            <Criteria keys={ACTION_CRITERIA} value={a.smart} onChange={(v) => acts.patch(a.id, { smart: v })} />
            <Convert action={a} date={p.start_date} acts={acts} kind={level} />
          </div>
        ))}
        {level === 'day' && acts.rows.length >= s.max_daily_actions && <p className="flag">Đã {acts.rows.length} hành động. Khuyến nghị tối đa {s.max_daily_actions}/ngày để làm được thật.</p>}
        <div className="addrow">
          <input
            value={act}
            onChange={(e) => setAct(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && act.trim()) {
                await acts.add({ period_id: p.id, text: act.trim(), sort: acts.rows.length })
                setAct('')
              }
            }}
            placeholder="VD: Xác định mục tiêu SMART cho từng công việc"
            aria-label="Hành động mới"
          />
          <button
            className="btn"
            disabled={!act.trim()}
            onClick={async () => {
              await acts.add({ period_id: p.id, text: act.trim(), sort: acts.rows.length })
              setAct('')
            }}
          >
            Thêm
          </button>
        </div>
      </Step>

      <section className="selfcheck">
        <p className="redq">Bản Kaizen đã cụ thể chưa? Bạn hài lòng với nó chưa? Nếu chưa thì chưa hài lòng chỗ nào? Ai có thể giúp mình làm rõ phần này? Liên hệ tham vấn ngay.</p>
        <label className="li">
          <input type="checkbox" checked={!!k.satisfied} onChange={() => save({ satisfied: !k.satisfied })} />
          Tôi hài lòng với bản Kaizen này
        </label>
        {!k.satisfied && <Txt value={k.consult_who} onSave={(v) => save({ consult_who: v })} placeholder="Người cần tham vấn, chưa rõ chỗ nào" />}
      </section>
    </div>
  )
}

/** Chuyển hành động thành KR mới hoặc KA trong KR của kỳ kế tiếp (§6). */
function Convert({ action, date, acts, kind }: { action: NextAction; date: string; acts: ActRows; kind: Extract<PeriodKind, 'day' | 'week'> }) {
  const { uid: userId, settings: s, toast } = useApp()
  const next = addDays(date, kind === 'day' ? 1 : 7)
  const label = kind === 'day' ? `ngày ${fmtDM(next)}` : `tuần ${fmtDM(next)}`
  const [krs, setKrs] = useState<KR[] | null>(null)
  const [target, setTarget] = useState('new')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (action.converted_period_id) return
    let live = true
    getPeriod(userId, kind, next)
      .then((np) => listBy<KR>('key_results', 'period_id', np.id))
      .then((x) => live && setKrs(x))
      .catch((e) => toast(errMsg(e)))
    return () => {
      live = false
    }
  }, [action.converted_period_id, userId, next, toast, kind])

  if (action.converted_period_id) return <p className="converted">✓ Đã chuyển vào OKR {label} ({action.converted_kr_id ? 'KR mới' : 'KA'})</p>
  const ready = !!action.smart?.NEXT && action.text.trim()
  const krFull = (krs?.length ?? 0) >= s.day_max_kr

  async function run() {
    setBusy(true)
    try {
      const np = await getPeriod(userId, kind, next)
      if (target === 'new') {
        const no = await getMainObjective(userId, np.id)
        const kr = await insert<KR>('key_results', { period_id: np.id, objective_id: no.id, title: action.text.trim(), from_action_id: action.id, sort: krs?.length ?? 0 })
        await acts.patch(action.id, { converted_period_id: np.id, converted_kr_id: kr.id })
      } else {
        const ka = await insert<{ id: string }>('key_actions', { kr_id: target, title: action.text.trim(), from_action_id: action.id, sort: 99 })
        await acts.patch(action.id, { converted_period_id: np.id, converted_ka_id: ka.id })
      }
    } catch (e) {
      toast(errMsg(e))
    }
    setBusy(false)
  }

  return (
    <div className="addrow convert">
      <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Chuyển thành">
        <option value="new" disabled={krFull}>
          KR mới {label}
          {krFull ? ' (đã đủ KR)' : ''}
        </option>
        {(krs ?? []).map((k, i) => (
          <option key={k.id} value={k.id}>
            KA trong KR{i + 1}: {k.title || '(chưa đặt tên)'}
          </option>
        ))}
      </select>
      <button className="btn" disabled={!ready || busy || (target === 'new' && krFull)} onClick={run} title={ready ? '' : 'Tick tiêu chí "Đưa được vào OKR kỳ tới" trước'}>
        Chuyển vào kỳ tới
      </button>
      {!action.smart?.NEXT && <span className="flag">Tick "Đưa được vào OKR kỳ tới" để chuyển</span>}
    </div>
  )
}
