import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/ctx'
import { errMsg, listAll, listIn } from '../lib/db'
import { fmtDMY } from '../lib/dates'
import { keywordStats } from '../lib/okr'
import type { KR, Period } from '../lib/types'

const KIND = { day: 'Ngày', week: 'Tuần', month: 'Tháng', quarter: 'Quý', year: 'Năm', kickoff: 'Khởi động' } as Record<string, string>
const GROUP = { a: '(a) Đầu vào thiếu', b: '(b) Chuyển đổi thấp', c: '(c) Giữ chân kém', d: '(d) Bên ngoài' } as Record<string, string>
const DEC = { keep: 'Giữ', increase: 'Tăng nỗ lực', cut: 'Cắt phạm vi', change: 'Đổi cách làm', stop: 'Dừng' } as Record<string, string>

/** Lịch sử Kaizen (§14.9): tìm theo từ khoá đỏ, nhóm nguyên nhân, quyết định. */
export default function History() {
  const { toast, go } = useApp()
  const [periods, setPeriods] = useState<Period[]>([])
  const [krs, setKrs] = useState<KR[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    listAll<Period>('periods', 'start_date')
      .then(async (ps) => {
        const withK = ps.filter((p) => p.kaizen && Object.keys(p.kaizen).length).reverse()
        setPeriods(withK)
        setKrs(await listIn<KR>('key_results', 'period_id', withK.filter((p) => p.kaizen.diagnoses || p.kaizen.decisions).map((p) => p.id)))
      })
      .catch((e) => toast(errMsg(e)))
  }, [toast])

  const stats = useMemo(() => keywordStats(periods.map((p) => p.kaizen)), [periods])
  const groups = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of periods) for (const d of Object.values(p.kaizen.diagnoses ?? {})) c[d.group] = (c[d.group] ?? 0) + 1
    return c
  }, [periods])
  const needle = q.trim().toLowerCase()
  const shown = periods.filter((p) => {
    if (!needle) return true
    const k = p.kaizen
    const hay = [k.causes, k.assessment, ...(k.keywords ?? []), ...(k.lessons ?? []).map((l) => l.text + ' ' + l.keyword), ...(k.num_lessons ?? []).map((l) => l.text), ...Object.values(k.diagnoses ?? {}).map((d) => GROUP[d.group] + ' ' + d.evidence), ...Object.values(k.decisions ?? {}).map((d) => DEC[d.decision] + ' ' + d.reason)]
      .join(' ')
      .toLowerCase()
    return hay.includes(needle)
  })

  return (
    <div className="stack">
      <h1>Lịch sử Kaizen</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm từ khoá đỏ, bài học, nhóm nguyên nhân, quyết định…" aria-label="Tìm" />
      <section className="sec">
        <h3>Từ khoá đỏ lặp lại nhiều nhất</h3>
        <div className="kws">
          {stats.slice(0, 20).map((x) => (
            <button key={x.keyword} className="kw kwb" onClick={() => setQ(x.keyword)}>
              {x.keyword} ×{x.count}
            </button>
          ))}
          {!stats.length && <span className="note">Chưa có từ khoá.</span>}
        </div>
        {Object.keys(groups).length > 0 && (
          <p className="note">
            Nhóm nguyên nhân (Kaizen số liệu):{' '}
            {Object.entries(groups)
              .map(([g, n]) => `${GROUP[g]} ×${n}`)
              .join(' · ')}
          </p>
        )}
      </section>
      {shown.map((p) => {
        const k = p.kaizen
        return (
          <section key={p.id} className="sec hist">
            <h3>
              {KIND[p.kind]} {fmtDMY(p.start_date)}
              <button className="linkbtn" onClick={() => go(p.kind === 'day' ? 'day' : p.kind, p.start_date)}>
                mở
              </button>
            </h3>
            {k.keywords?.length ? (
              <div className="kws">
                {k.keywords.map((w) => (
                  <span key={w} className="kw kwb">
                    {w}
                  </span>
                ))}
              </div>
            ) : null}
            {k.causes && <p>{k.causes}</p>}
            {(k.lessons ?? []).filter((l) => l.text.trim()).map((l) => (
              <p key={l.id} className="note">
                Bài học: <b>{l.text}</b> {l.keyword && `(${l.keyword})`}
              </p>
            ))}
            {(k.num_lessons ?? []).filter((l) => l.text.trim()).map((l) => (
              <p key={l.id} className="note">
                Bài học: <b>{l.text}</b> · {l.number}
              </p>
            ))}
            {Object.entries(k.diagnoses ?? {}).map(([id, d]) => (
              <p key={id} className="note">
                Chẩn đoán {krs.find((x) => x.id === id)?.title ?? ''}: {GROUP[d.group]} · {d.evidence}
              </p>
            ))}
            {Object.entries(k.decisions ?? {}).map(([id, d]) => (
              <p key={'d' + id} className="note">
                Quyết định {krs.find((x) => x.id === id)?.title ?? ''}: <b>{DEC[d.decision]}</b> {d.reason}
              </p>
            ))}
          </section>
        )
      })}
    </div>
  )
}
