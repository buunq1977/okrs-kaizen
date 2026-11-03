import { useEffect, useState } from 'react'
import { useApp } from '../../lib/ctx'
import { errMsg, getPeriod, insert, listBy } from '../../lib/db'
import { addDays, fmtDM } from '../../lib/dates'
import { ACTION_CRITERIA, highlight, type Pct } from '../../lib/okr'
import type { KaizenData, KR, Lesson, NextAction, Period } from '../../lib/types'
import { Criteria, FocusBand, Step, Txt } from '../ui'

type ActRows = {
  rows: NextAction[]
  add: (r: Record<string, unknown>) => Promise<NextAction | null>
  patch: (id: string, p: Partial<NextAction>) => Promise<void>
  del: (id: string) => Promise<void>
}
const uid = () => Math.random().toString(36).slice(2, 10)

/** Kaizen ngày, 4 bước (§6). */
export function Kaizen({ p, save, pct, acts }: { p: Period; save: (k: Partial<KaizenData>) => void; pct: Pct; acts: ActRows }) {
  const { settings: s } = useApp()
  const k = p.kaizen ?? {}
  const keywords = k.keywords ?? []
  const lessons = k.lessons ?? []
  const [kw, setKw] = useState('')
  const [act, setAct] = useState('')

  const addKw = () => {
    const w = kw.trim()
    if (!w || keywords.some((x) => x.toLowerCase() === w.toLowerCase())) return setKw('')
    save({ keywords: [...keywords, w] })
    setKw('')
  }
  const setLesson = (id: string, part: Partial<Lesson>) => save({ lessons: lessons.map((l) => (l.id === id ? { ...l, ...part } : l)) })

  return (
    <div className="kaizen">
      <Step n="1" title="Đo lường" hint="Hoàn thành bao nhiêu % tiêu điểm? Số lấy tự động từ OKR." open done={!!k.assessment?.trim()}>
        <FocusBand title={p.o_title} pct={pct} />
        <Txt multiline value={k.assessment} onSave={(v) => save({ assessment: v })} placeholder="Đánh giá ngắn: vì sao ra con số này?" />
      </Step>

      <Step n="2a" title="Nguyên nhân · Viết nhật ký" hint="Đã làm gì? Kết quả là gì? Còn gì nữa không? Chỉ ghi sự thật có giờ và số liệu." open done={!!(k.journal?.s || k.journal?.c || k.journal?.t)}>
        <div className="grid3">
          {(
            [
              ['s', 'Sáng', '4h30–6h15 trại mentor → khởi đầu đầy năng lượng'],
              ['c', 'Chiều', '12h00–13h20 training → …'],
              ['t', 'Tối', '19h10–19h45 học tập → …'],
            ] as const
          ).map(([key, label, ph]) => (
            <label key={key} className="fld">
              <span>{label}</span>
              <Txt multiline rows={4} value={k.journal?.[key]} onSave={(v) => save({ journal: { ...k.journal, [key]: v } })} placeholder={ph} />
            </label>
          ))}
        </div>
      </Step>

      <Step n="2b" title="Nguyên nhân % tiêu điểm" hint="Đâu là nguyên nhân dẫn đến kết quả, cả thành công lẫn thất bại? Phân tích tới tận cùng. Rút ra từ khoá và bôi đỏ." open done={keywords.length > 0}>
        <Txt multiline rows={4} value={k.causes} onSave={(v) => save({ causes: v })} placeholder="VD: Chưa tập trung vì không rõ tiêu điểm từ tối hôm trước…" />
        <div className="addrow">
          <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addKw()} placeholder="Từ khoá nguyên nhân, VD: chưa tập trung" aria-label="Từ khoá đỏ" />
          <button className="btn" onClick={addKw} disabled={!kw.trim()}>
            Bôi đỏ
          </button>
        </div>
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
          <p className="hl-preview">
            {highlight(k.causes, keywords).map((seg, i) => (seg.hit ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>))}
          </p>
        )}
      </Step>

      <Step n="3" title="Bài học" hint="Đúc kết ngắn gọn, dễ nhớ. Mỗi bài học gắn với 1 từ khoá đỏ." open={keywords.length > 0} done={lessons.some((l) => l.text.trim())} lockedMsg="Bôi đỏ ít nhất 1 từ khoá ở bước 2b trước.">
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
              <Txt value={l.signal} onSave={(v) => setLesson(l.id, { signal: v })} placeholder="Dấu hiệu nhận biết khi nó xảy ra (khuyến nghị)" />
            </div>
            {!l.keyword && <span className="flag">Chưa gắn từ khoá</span>}
          </div>
        ))}
        <button className="add" onClick={() => save({ lessons: [...lessons, { id: uid(), text: '', keyword: keywords[0] ?? '', signal: '' }] })}>
          + Thêm bài học
        </button>
      </Step>

      <Step
        n="4"
        title="Hành động tiếp theo"
        hint="Tưới hạt giống: phát huy thành công, cải tiến thất bại. Tick đủ tiêu chí rồi chuyển vào OKR ngày mai."
        open={lessons.some((l) => l.text.trim())}
        done={acts.rows.some((a) => a.converted_period_id)}
        lockedMsg="Viết ít nhất 1 bài học trước."
      >
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
            <Convert action={a} date={p.start_date} acts={acts} />
          </div>
        ))}
        {acts.rows.length >= s.max_daily_actions && <p className="flag">Đã {acts.rows.length} hành động. Khuyến nghị tối đa {s.max_daily_actions}/ngày để làm được thật.</p>}
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

/** Chuyển hành động thành KR mới hoặc KA trong KR của ngày mai (§6). */
function Convert({ action, date, acts }: { action: NextAction; date: string; acts: ActRows }) {
  const { uid: userId, settings: s, toast } = useApp()
  const next = addDays(date, 1)
  const [krs, setKrs] = useState<KR[] | null>(null)
  const [target, setTarget] = useState('new')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (action.converted_period_id) return
    let live = true
    getPeriod(userId, 'day', next)
      .then((np) => listBy<KR>('key_results', 'period_id', np.id))
      .then((x) => live && setKrs(x))
      .catch((e) => toast(errMsg(e)))
    return () => {
      live = false
    }
  }, [action.converted_period_id, userId, next, toast])

  if (action.converted_period_id)
    return (
      <p className="converted">
        ✓ Đã chuyển vào OKR ngày {fmtDM(next)} ({action.converted_kr_id ? 'KR mới' : 'KA'})
      </p>
    )
  const ready = !!action.smart?.NEXT && action.text.trim()
  const krFull = (krs?.length ?? 0) >= s.day_max_kr

  async function run() {
    setBusy(true)
    try {
      const np = await getPeriod(userId, 'day', next)
      if (target === 'new') {
        const kr = await insert<KR>('key_results', { period_id: np.id, title: action.text.trim(), from_action_id: action.id, sort: krs?.length ?? 0 })
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
          KR mới ngày {fmtDM(next)}
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
