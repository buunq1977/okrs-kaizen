import { Fragment, useMemo, useState } from 'react'
import AffLedger from '../components/aff/AffLedger'
import { useAff, useLedger } from '../components/aff/useAff'
import { Sec, Txt, toNum } from '../components/ui'
import { analyze, ceilCount, coeffsOf, monthOf, targetsFor, winsLabel } from '../lib/affiliate'
import { advance, countBetween, flags, kindOf, measure, metrics, MODEL_NAME, nextStage, OP_COLOR, OP_NAME, searchSum, STAGE_NAME, STAGES, totals, type AffEntry, type AffProject, type Model, type OpStatus, type Stage, type Tally } from '../lib/affProjects'
import { MODEL3, MODEL3_NAME, wsCounts, type Model3 } from '../lib/affSource'
import { useRows } from '../lib/ctx'
import { listAll } from '../lib/db'
import { addDays, fmtDM, monthEnd, mondayOf, today } from '../lib/dates'
import { fmtNum } from '../lib/pace'

const usd = (n: number | null) => (n === null || !Number.isFinite(n) ? '–' : (n < 0 ? '−$' : '$') + fmtNum(Math.round(Math.abs(n) * 100) / 100))
const pct = (n: number | null) => (n === null ? '–' : Math.round(n) + '%')

/** Sổ dự án: mục tiêu tuần/tháng (KR Affiliate), bộ đếm search, việc cần xử lý từ Research + Ads-Hub.
 *  Dự án, đăng ký, lần test nhập ở Research; chi phí, click, đơn xem ở Ads-Hub. OKR không nhập lại. */
export default function Projects() {
  const aff = useAff()
  const ps = useRows<AffProject>('aff_projects', 'all', () => listAll<AffProject>('aff_projects'))
  const es = useRows<AffEntry>('aff_entries', 'all', () => listAll<AffEntry>('aff_entries', 'date'))
  const ts = useRows<Tally>('aff_tallies', 'all', () => listAll<Tally>('aff_tallies', 'date'))
  const t0 = today()
  const [open, setOpen] = useState<string | null>(null)
  const [tm3, setTm3] = useState<Model3>('phys')
  const led = useLedger(ps)

  const byP = useMemo(() => {
    const m = new Map<string, AffEntry[]>()
    for (const e of es.rows) m.set(e.project_id, [...(m.get(e.project_id) ?? []), e])
    return m
  }, [es.rows])
  const cfg = aff.cfg
  const maxTest = aff.live.max_test_usd
  const coeffs = cfg ? coeffsOf({ coeffs: null }, cfg, { max_test_usd: maxTest }) : null
  const a = useMemo(() => (cfg ? analyze(aff.months, cfg, t0, { max_test_usd: maxTest }) : null), [cfg, aff.months, t0, maxTest])

  if (aff.err) return <p className="flag">{aff.err}</p>
  if (!cfg || !coeffs || !a) return <p className="note">Đang tải…</p>

  const wk = { from: mondayOf(t0), to: addDays(mondayOf(t0), 6) }
  const mo = { from: monthOf(t0), to: monthEnd(t0) }
  const manual = ps.rows.filter((p) => !p.ws_reg_id) // dòng nối Research chỉ giữ checklist, không phải dự án nhập tay
  const wsD = led.ws?.data ?? null
  // Đầu vào: Research nếu đọc được; chưa kết nối thì đếm Sổ nhập tay cũ. Search luôn từ bộ đếm của OKR.
  const cnt = (r: { from: string; to: string }) => {
    const search = searchSum(ts.rows, r.from, r.to)
    if (wsD) {
      const c = wsCounts(wsD, r.from, r.to)
      return { search, reg: c.dang_ky, test: c.test }
    }
    const c = countBetween(manual, ts.rows, r.from, r.to)
    return { search, reg: c.dang_ky as number | null, test: c.test }
  }
  const cw = cnt(wk)
  const cm = cnt(mo)
  const tw = targetsFor([monthOf(t0)], a, aff.months, cfg, 'week')
  const tmo = targetsFor([monthOf(t0)], a, aff.months, cfg, 'month')
  const nReady = led.items.filter((x) => x.win.ready).length
  const nCand = led.items.filter((x) => x.win.candidate && !x.win.ready).length
  const pace = (done: number | null, [lo, hi]: [number, number]) =>
    done === null ? (
      <span className="note">chưa có ngày</span>
    ) : (
      <span className={'pace-n ' + (done >= ceilCount(lo) ? 'ok' : '')}>
        <b>{done}</b> / {ceilCount(lo)}
        {ceilCount(hi) > ceilCount(lo) ? ` (mục tiêu ${ceilCount(hi)})` : ''}
      </span>
    )

  const todayTally = ts.rows.find((x) => x.date === t0 && x.model === (tm3 as Tally['model']))
  async function setSearch(n: number) {
    const v = Math.max(0, Math.round(n))
    if (todayTally) ts.patch(todayTally.id, { count: v })
    else if (v > 0) await ts.add({ date: t0, kind: 'search', model: tm3, count: v })
  }
  const apprAll = { phys: measure(manual, es.rows, ts.rows, 'phys', '2000-01-01', t0).approval, saas: measure(manual, es.rows, ts.rows, 'saas', '2000-01-01', t0).approval }
  function move(p: AffProject, to: Stage) {
    ps.patch(p.id, advance(p, to, t0) as Partial<AffProject>)
  }

  return (
    <div className="stack">
      <h1>Sổ dự án</h1>

      <Sec title="Mục tiêu tuần & tháng" hint="số đã làm / chỉ tiêu tối thiểu theo ngân sách · Lên camp test là KR chính">
        <div className="tbl">
          <table className="ktable aff-t">
            <thead>
              <tr>
                <th />
                <th style={{ textAlign: 'right' }}>
                  Tuần {fmtDM(wk.from)}–{fmtDM(wk.to)}
                </th>
                <th style={{ textAlign: 'right' }}>
                  Tháng {t0.slice(5, 7)}/{t0.slice(0, 4)}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>Lên camp test</b>
                </td>
                <td className="n">{pace(cw.test, tw.tests)}</td>
                <td className="n">{pace(cm.test, tmo.tests)}</td>
              </tr>
              <tr>
                <td>
                  Đăng ký <small className="note">(tham khảo)</small>
                </td>
                <td className="n">{pace(cw.reg, tw.reg)}</td>
                <td className="n">{pace(cm.reg, tmo.reg)}</td>
              </tr>
              <tr>
                <td>
                  Search <small className="note">(tham khảo)</small>
                </td>
                <td className="n">{pace(cw.search, tw.research)}</td>
                <td className="n">{pace(cm.search, tmo.research)}</td>
              </tr>
              <tr>
                <td>Thắng</td>
                <td className="n">
                  <span className="note">không đặt</span>
                </td>
                <td className="n">
                  <b>{nReady}</b> đủ scale · {nCand} ứng viên
                  {tmo.wins && <span className="note"> / mục tiêu {winsLabel(tmo.wins[0])}</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="tally">
          <span className="tally-l">Search hôm nay</span>
          {MODEL3.map((m) => (
            <button key={m} className="chip" aria-pressed={tm3 === m} onClick={() => setTm3(m)}>
              {MODEL3_NAME[m]}
            </button>
          ))}
          <button className="btn" aria-label="Bớt 1" disabled={!todayTally?.count} onClick={() => setSearch((todayTally?.count ?? 0) - 1)}>
            −1
          </button>
          <input type="number" min={0} aria-label="Số dự án đã search hôm nay" value={todayTally?.count ?? 0} onChange={(e) => setSearch(Number(e.target.value))} />
          {[1, 5, 10].map((n) => (
            <button key={n} className="btn" onClick={() => setSearch((todayTally?.count ?? 0) + n)}>
              +{n}
            </button>
          ))}
        </div>
        <p className="note">
          {wsD
            ? `Đăng ký, lên camp đếm từ Research${wsD.hasDates ? '' : ' (Research chưa có ngày đăng ký: chạy 09_reg_dates.sql)'}; search đếm ở đây (chỉ số, không cần tên).`
            : 'Chưa đọc được Research: đang đếm từ Sổ nhập tay cũ. Đăng nhập ở Cài đặt → Kết nối nguồn số.'}{' '}
          Dự án mới, đăng ký, lần test nhập ở Research; chi phí, click, đơn xem ở Ads-Hub.
          {!aff.months.length && ' Chưa có bảng phân bổ: tạo ở Mô hình thu nhập → Affiliate Global để có chỉ tiêu.'}
        </p>
      </Sec>

      <AffLedger led={led} links={ps} />

      {manual.length > 0 && (
        <Sec title={`Dự án nhập tay (${manual.length})`} hint="Dữ liệu cũ trước khi dùng Research · bấm tên để mở chi tiết">
          <div className="tbl">
            <table className="ktable proj-t">
              <thead>
                <tr>
                  <th>Dự án</th>
                  <th>Giai đoạn</th>
                  <th>Chi phí</th>
                  <th>Thực nhận</th>
                  <th>Đơn</th>
                  <th>% Duyệt</th>
                  <th>Cờ</th>
                </tr>
              </thead>
              <tbody>
                {manual.map((p) => {
                  const t = totals(byP.get(p.id) ?? [])
                  const m = metrics(t)
                  const f = flags(p, t, coeffs, cfg.test_cap_mult, aff.th?.winner_orders ?? cfg.win_min_orders ?? 3, p.model === 'phys' ? apprAll.phys : apprAll.saas, aff.th?.roa?.[0])
                  const k = kindOf(p, t)
                  const nx = nextStage(p.stage)
                  return (
                    <Fragment key={p.id}>
                      <tr className={open === p.id ? 'open' : ''}>
                        <td>
                          <button className="linkbtn" onClick={() => setOpen(open === p.id ? null : p.id)}>
                            {p.name}
                          </button>
                          <small className="sub">{MODEL_NAME[p.model] ?? p.model}</small>
                        </td>
                        <td>
                          <span className={'stg ' + p.stage}>{STAGE_NAME[p.stage]}</span>
                          {nx && p.stage !== 'dung' && (
                            <button className="btn mini" onClick={() => move(p, nx)} title={`Chuyển sang ${STAGE_NAME[nx]}`}>
                              → {STAGE_NAME[nx]}
                            </button>
                          )}
                        </td>
                        <td className="n">{t.cost ? usd(t.cost) : ''}</td>
                        <td className="n">{t.received ? usd(t.received) : ''}</td>
                        <td className="n">{t.orders || ''}</td>
                        <td className="n">{t.revenue ? pct(m.approval) : ''}</td>
                        <td>
                          {k && <span className={'chip-k ' + (k === 'Winner' ? 'green' : k === 'Ra đơn' ? 'blue' : 'red')}>{k}</span>}
                          {p.op_status && <span className={'chip-k ' + OP_COLOR[p.op_status]}>{OP_NAME[p.op_status]}</span>}
                          {f.kill && <span className="chip-k red solid">Nên dừng</span>}
                          {f.winReady && <span className="chip-k green solid">Ứng viên thắng</span>}
                        </td>
                      </tr>
                      {open === p.id && (
                        <tr className="detail">
                          <td colSpan={7}>
                            <Detail p={p} entries={byP.get(p.id) ?? []} cap={f.cap} capMult={cfg.test_cap_mult} winReady={f.winReady} patch={(x) => ps.patch(p.id, x)} move={(s) => move(p, s)} del={() => ps.del(p.id)} es={es} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Sec>
      )}
    </div>
  )
}

function Detail(props: {
  p: AffProject
  entries: AffEntry[]
  cap: number
  capMult: number
  winReady: boolean
  patch: (x: Partial<AffProject>) => void
  move: (s: Stage) => void
  del: () => void
  es: { add: (r: Record<string, unknown>) => Promise<AffEntry | null>; del: (id: string) => void }
}) {
  const { p, entries, cap, capMult, winReady, patch, move, del, es } = props
  const t0 = today()
  const blank = { date: t0, cost: '', revenue: '', received: '', orders: '', refs: '', customers: '' }
  const [e, setE] = useState(blank)
  const [sure, setSure] = useState(false)
  const field = (k: 'name' | 'link' | 'network' | 'niche' | 'geo' | 'note', label: string) => (
    <label className="fld">
      <span>{label}</span>
      <Txt value={p[k]} onSave={(v) => (k === 'name' && !v.trim() ? undefined : patch({ [k]: v } as Partial<AffProject>))} />
    </label>
  )
  const n = (k: keyof typeof blank) => <input type="number" min={0} step="any" aria-label={k} value={e[k]} onChange={(x) => setE({ ...e, [k]: x.target.value })} />
  async function addEntry() {
    const row = {
      project_id: p.id,
      date: e.date || t0,
      cost: toNum(e.cost) ?? 0,
      revenue: toNum(e.revenue) ?? 0,
      received: toNum(e.received) ?? 0,
      orders: toNum(e.orders) ?? 0,
      refs: toNum(e.refs) ?? 0,
      customers: toNum(e.customers) ?? 0,
    }
    if (!row.cost && !row.revenue && !row.received && !row.orders && !row.refs && !row.customers) return
    if (await es.add(row)) setE(blank)
  }
  return (
    <div className="proj-d">
      <div className="grid3">
        {field('name', 'Tên')}
        {field('link', 'Link')}
        {field('network', 'Network')}
        {field('niche', 'Ngách')}
        {field('geo', 'Geo')}
        <label className="fld">
          <span>Mô hình</span>
          <select value={p.model} onChange={(x) => patch({ model: x.target.value as Model })}>
            <option value="phys">Vật lý</option>
            <option value="saas">SaaS</option>
          </select>
        </label>
        <label className="fld">
          <span>Giai đoạn</span>
          <select value={p.stage} onChange={(x) => move(x.target.value as Stage)}>
            {[...STAGES, 'dung' as Stage].map((s) => (
              <option key={s} value={s}>
                {STAGE_NAME[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>Trạng thái vận hành</span>
          <select value={p.op_status ?? ''} onChange={(x) => patch({ op_status: (x.target.value || null) as OpStatus | null })}>
            <option value="">—</option>
            {(Object.keys(OP_NAME) as OpStatus[]).map((o) => (
              <option key={o} value={o}>
                {OP_NAME[o]}
              </option>
            ))}
          </select>
        </label>
        {field('note', 'Ghi chú')}
      </div>
      <p className="note">
        Ngày vào giai đoạn:{' '}
        {[...STAGES, 'dung' as Stage]
          .filter((s) => p.dates[s])
          .map((s) => `${STAGE_NAME[s]} ${fmtDM(p.dates[s]!)}`)
          .join(' · ') || 'chưa có'}
      </p>
      {winReady && (
        <p className="flag ok">
          Đạt tiêu chí thắng.{' '}
          <button className="btn mini" onClick={() => move('win')}>
            Đánh dấu Thắng
          </button>
        </p>
      )}
      <div className="grid2">
        <label className="fld">
          <span>
            Lý do mở rộng test (trần {usd(cap)}{p.ext_reason.trim() ? '' : `; ghi lý do → ×${capMult}`})
          </span>
          <Txt value={p.ext_reason} onSave={(v) => patch({ ext_reason: v })} placeholder="VD: đã có đơn trong ngưỡng click, CPC dưới mức tối đa" />
        </label>
        <label className="fld">
          <span>Lý do dừng</span>
          <Txt value={p.stop_reason} onSave={(v) => patch({ stop_reason: v })} placeholder="VD: hết trần test, 0 đơn" />
        </label>
      </div>

      <div className="fld-l">Số liệu theo đợt (cộng dồn thành tổng)</div>
      <div className="tbl">
        <table className="ktable">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Chi phí</th>
              <th>Doanh số</th>
              <th>Thực nhận</th>
              <th>Đơn</th>
              {p.model === 'saas' && <th>Ref</th>}
              {p.model === 'saas' && <th>Khách trả tiền</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((x) => (
              <tr key={x.id}>
                <td>{fmtDM(x.date)}</td>
                <td className="n">{usd(Number(x.cost))}</td>
                <td className="n">{usd(Number(x.revenue))}</td>
                <td className="n">{usd(Number(x.received))}</td>
                <td className="n">{x.orders}</td>
                {p.model === 'saas' && <td className="n">{x.refs}</td>}
                {p.model === 'saas' && <td className="n">{x.customers}</td>}
                <td>
                  <button className="x" aria-label="Xoá dòng" onClick={() => es.del(x.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr className="ent-new">
              <td>
                <input type="date" aria-label="Ngày" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} />
              </td>
              <td>{n('cost')}</td>
              <td>{n('revenue')}</td>
              <td>{n('received')}</td>
              <td>{n('orders')}</td>
              {p.model === 'saas' && <td>{n('refs')}</td>}
              {p.model === 'saas' && <td>{n('customers')}</td>}
              <td>
                <button className="btn mini" onClick={addEntry}>
                  + Ghi
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="addrow">
        {p.stage !== 'dung' && (
          <button className="btn" onClick={() => move('dung')}>
            Dừng dự án
          </button>
        )}
        <button className={'btn danger' + (sure ? ' solid' : '')} onClick={() => (sure ? del() : setSure(true))} onBlur={() => setSure(false)}>
          {sure ? 'Bấm lần nữa để xoá hẳn' : 'Xoá dự án'}
        </button>
      </div>
    </div>
  )
}
