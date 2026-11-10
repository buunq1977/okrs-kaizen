import { Fragment, useMemo, useState } from 'react'
import { useAff } from '../components/aff/useAff'
import { Sec, Txt, toNum } from '../components/ui'
import { analyze, ceilCount, monthOf, physOf, saasOf, targetsFor, winsLabel } from '../lib/affiliate'
import {
  advance, countBetween, flags, kindOf, measure, metrics, MODEL_NAME, nextStage, OP_COLOR, OP_NAME, parseImport, STAGE_NAME, STAGES, totals,
  type AffEntry, type AffProject, type ImportRow, type Model, type OpStatus, type Stage, type Tally,
} from '../lib/affProjects'
import { useApp, useRows } from '../lib/ctx'
import { errMsg, insertMany, listAll } from '../lib/db'
import { addDays, addMonths, fmtDM, monthEnd, mondayOf, today } from '../lib/dates'
import { fmtNum } from '../lib/pace'

const usd = (n: number | null) => (n === null || !Number.isFinite(n) ? '–' : (n < 0 ? '−$' : '$') + fmtNum(Math.round(Math.abs(n) * 100) / 100))
const pct = (n: number | null) => (n === null ? '–' : Math.round(n) + '%')
const c1 = (n: number) => fmtNum(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10)

type Filter = 'active' | 'all' | Stage

/** Sổ dự án Affiliate (§ bước 2): mỗi dự án một dòng, bấm để chuyển giai đoạn, nhập số khi đang test. */
export default function Projects() {
  const { toast } = useApp()
  const aff = useAff()
  const ps = useRows<AffProject>('aff_projects', 'all', () => listAll<AffProject>('aff_projects'))
  const es = useRows<AffEntry>('aff_entries', 'all', () => listAll<AffEntry>('aff_entries', 'date'))
  const ts = useRows<Tally>('aff_tallies', 'all', () => listAll<Tally>('aff_tallies', 'date'))
  const t0 = today()
  const [model, setModel] = useState<'all' | Model>('all')
  const [filter, setFilter] = useState<Filter>('active')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', link: '', model: 'phys' as Model })
  const [imp, setImp] = useState<{ sheet: string; rows: ImportRow[] } | null>(null)

  const byP = useMemo(() => {
    const m = new Map<string, AffEntry[]>()
    for (const e of es.rows) m.set(e.project_id, [...(m.get(e.project_id) ?? []), e])
    return m
  }, [es.rows])
  const cfg = aff.cfg
  const coeffs = cfg ? { phys: physOf(cfg.phys), saas: saasOf(cfg.saas) } : null
  const a = useMemo(() => (cfg ? analyze(aff.months, cfg, t0) : null), [cfg, aff.months, t0])

  if (aff.err) return <p className="flag">{aff.err}</p>
  if (!cfg || !coeffs || !a) return <p className="note">Đang tải…</p>

  const wk = { from: mondayOf(t0), to: addDays(mondayOf(t0), 6) }
  const mo = { from: monthOf(t0), to: monthEnd(t0) }
  const cw = countBetween(ps.rows, ts.rows, wk.from, wk.to)
  const cm = countBetween(ps.rows, ts.rows, mo.from, mo.to)
  const tw = targetsFor([monthOf(t0)], a, aff.months, cfg, 'week')
  const tm = targetsFor([monthOf(t0)], a, aff.months, cfg, 'month')
  const pace = (done: number, [lo, hi]: [number, number]) => (
    <span className={'pace-n ' + (done >= lo ? 'ok' : '')}>
      <b>{done}</b> / {ceilCount(lo)}
      {ceilCount(hi) > ceilCount(lo) ? ` (mục tiêu ${ceilCount(hi)})` : ''}
    </span>
  )

  const since = addMonths(t0, -3)
  const meas = { phys: measure(ps.rows, es.rows, ts.rows, 'phys', since, t0), saas: measure(ps.rows, es.rows, ts.rows, 'saas', since, t0) }
  const apprAll = { phys: measure(ps.rows, es.rows, ts.rows, 'phys', '2000-01-01', t0).approval, saas: measure(ps.rows, es.rows, ts.rows, 'saas', '2000-01-01', t0).approval }
  const todayTally = ts.rows.find((x) => x.date === t0 && x.model === draft.model)
  async function setSearch(n: number) {
    const v = Math.max(0, Math.round(n))
    if (todayTally) ts.patch(todayTally.id, { count: v })
    else if (v > 0) await ts.add({ date: t0, kind: 'search', model: draft.model, count: v })
  }
  const list = ps.rows
    .filter((p) => model === 'all' || p.model === model)
    .filter((p) => (filter === 'all' ? true : filter === 'active' ? p.stage !== 'dung' : p.stage === filter))
    .filter((p) => !q.trim() || (p.name + ' ' + p.network + ' ' + p.niche).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((x, y) => STAGES.indexOf(y.stage) - STAGES.indexOf(x.stage) || y.created_at.localeCompare(x.created_at))

  async function addProject() {
    if (!draft.name.trim()) return
    const r = await ps.add({ name: draft.name.trim(), link: draft.link.trim(), model: draft.model, stage: 'dat_loc', dates: { dat_loc: t0 } })
    if (r) setDraft({ ...draft, name: '', link: '' })
  }
  function move(p: AffProject, to: Stage) {
    ps.patch(p.id, advance(p, to, t0) as Partial<AffProject>)
  }
  async function readFile(f: File) {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer())
      for (const name of wb.SheetNames) {
        const table = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })
        const r = parseImport(table, t0)
        if (r.rows.length) return setImp({ sheet: name, rows: r.rows })
      }
      toast('Không đọc được dự án nào: cần một sheet có dòng tiêu đề gồm cột tên dự án (Tên / Dự án / Store) và cột "Chi phí".')
    } catch (e) {
      toast(errMsg(e))
    }
  }
  async function doImport() {
    if (!imp) return
    try {
      const added = await insertMany<AffProject>(
        'aff_projects',
        imp.rows.map((r) => {
          const dates: Partial<Record<Stage, string>> = { test: r.date }
          if (r.stage === 'win') dates.win = r.date
          if (r.stage === 'dung') dates.dung = r.date
          return { name: r.name, link: r.link, model: r.model, network: r.network, stage: r.stage, op_status: r.op_status, dates, note: 'Nhập từ file' }
        }),
      )
      const ents = added
        .map((p, i) => ({ p, r: imp.rows[i] }))
        .filter(({ r }) => r.totals.cost || r.totals.revenue || r.totals.received || r.totals.orders)
        .map(({ p, r }) => ({ project_id: p.id, date: r.date, ...r.totals, note: 'Nhập từ file (tổng)' }))
      await insertMany('aff_entries', ents)
      toast(`Đã nhập ${added.length} dự án`)
      setImp(null)
      ps.reload()
      es.reload()
    } catch (e) {
      toast(errMsg(e))
    }
  }


  return (
    <div className="stack">
      <h1>Sổ dự án</h1>

      <Sec title="Nhịp tuần này & tháng này" hint="Search lấy từ bộ đếm; các bước sau đếm theo ngày dự án vào giai đoạn · số / chỉ tiêu tối thiểu">
        <div className="tbl">
          <table className="ktable aff-t">
            <thead>
              <tr>
                <th />
                <th>Tuần {fmtDM(wk.from)}–{fmtDM(wk.to)}</th>
                <th>Tháng {t0.slice(5, 7)}/{t0.slice(0, 4)}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Search</td>
                <td className="n">{pace(cw.search, tw.research)}</td>
                <td className="n">{pace(cm.search, tm.research)}</td>
              </tr>
              <tr>
                <td>Đã chọn</td>
                <td className="n">
                  <b>{cw.chon}</b>
                </td>
                <td className="n">
                  <b>{cm.chon}</b>
                </td>
              </tr>
              <tr>
                <td>Đăng ký</td>
                <td className="n">{pace(cw.dang_ky, tw.reg)}</td>
                <td className="n">{pace(cm.dang_ky, tm.reg)}</td>
              </tr>
              <tr>
                <td>Duyệt link</td>
                <td className="n">
                  <b>{cw.duyet}</b>
                </td>
                <td className="n">
                  <b>{cm.duyet}</b>
                </td>
              </tr>
              <tr>
                <td>Test (lên camp)</td>
                <td className="n">{pace(cw.test, tw.tests)}</td>
                <td className="n">{pace(cm.test, tm.tests)}</td>
              </tr>
              <tr>
                <td>Thắng</td>
                <td className="n">
                  <b>{cw.win}</b> <span className="note">(không đặt)</span>
                </td>
                <td className="n">
                  {tm.wins ? (
                    <span className={'pace-n ' + (cm.win >= tm.wins[0] ? 'ok' : '')}>
                      <b>{cm.win}</b> / {winsLabel(tm.wins[0])}
                    </span>
                  ) : (
                    cm.win
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {!aff.months.length && <p className="note">Chưa có bảng phân bổ: tạo ở Mô hình thu nhập → Affiliate Global để có chỉ tiêu.</p>}
      </Sec>

      <Sec title="Search & chọn dự án" hint="Search chỉ cần đếm số; dự án đủ điều kiện mới ghi vào Sổ">
        <div className="tally">
          <span className="tally-l">
            Đã search hôm nay ({draft.model === 'phys' ? 'Vật lý' : 'SaaS'})
          </span>
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
        <div className="fld-l">Chọn dự án để đăng ký (đủ điều kiện)</div>
        <div className="addrow proj-add">
          <input placeholder="Tên dự án / store" aria-label="Tên dự án" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addProject()} />
          <input placeholder="Link" aria-label="Link" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addProject()} />
          <select aria-label="Mô hình" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value as Model })}>
            <option value="phys">Vật lý</option>
            <option value="saas">SaaS</option>
          </select>
          <button className="btn primary" disabled={!draft.name.trim()} onClick={addProject}>
            + Đã chọn
          </button>
        </div>
        <div className="addrow">
          <label className="btn">
            Nhập từ Excel/CSV
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          <span className="note">File cần dòng tiêu đề có: Tên/Dự án, Chi phí; tuỳ chọn: Network, Loại, Trạng thái, Doanh số, Thực nhận, Số đơn, Ngày, Mô hình (Vật lý/SaaS).</span>
        </div>
        {imp && (
          <div className="pace-box">
            <b>
              Đọc được {imp.rows.length} dự án từ sheet "{imp.sheet}"
            </b>
            <p className="note">
              Tổng chi phí {usd(imp.rows.reduce((s, r) => s + r.totals.cost, 0))} · doanh số {usd(imp.rows.reduce((s, r) => s + r.totals.revenue, 0))} · thực nhận {usd(imp.rows.reduce((s, r) => s + r.totals.received, 0))}. Mỗi dự án nhập thành 1 dòng số tổng, ngày = cột Ngày (trống thì hôm nay).
            </p>
            <div className="addrow">
              <button className="btn primary" onClick={doImport}>
                Nhập {imp.rows.length} dự án
              </button>
              <button className="btn ghost" onClick={() => setImp(null)}>
                Huỷ
              </button>
            </div>
          </div>
        )}
      </Sec>

      <Sec title={`Danh sách (${list.length})`} hint="Bấm tên để mở chi tiết, nhập số">
        <div className="filters">
          <select aria-label="Lọc mô hình" value={model} onChange={(e) => setModel(e.target.value as 'all' | Model)}>
            <option value="all">Vật lý + SaaS</option>
            <option value="phys">Vật lý</option>
            <option value="saas">SaaS</option>
          </select>
          <select aria-label="Lọc giai đoạn" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="active">Đang theo (trừ Dừng)</option>
            <option value="all">Tất cả</option>
            {[...STAGES, 'dung' as Stage].map((s) => (
              <option key={s} value={s}>
                {STAGE_NAME[s]} ({ps.rows.filter((p) => p.stage === s).length})
              </option>
            ))}
          </select>
          <input placeholder="Tìm tên, network, ngách" aria-label="Tìm" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="tbl">
          <table className="ktable proj-t">
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Giai đoạn</th>
                <th>Chi phí</th>
                <th>Doanh số</th>
                <th>Thực nhận</th>
                <th>Đơn</th>
                <th>ROI</th>
                <th>% Duyệt</th>
                <th>Loại · Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const t = totals(byP.get(p.id) ?? [])
                const m = metrics(t)
                const f = flags(p, t, coeffs, cfg.test_cap_mult, cfg.win_min_orders ?? 3, (p.model === 'phys' ? apprAll.phys : apprAll.saas))
                const k = kindOf(p, t)
                const nx = nextStage(p.stage)
                return (
                  <Fragment key={p.id}>
                    <tr className={open === p.id ? 'open' : ''}>
                      <td>
                        <button className="linkbtn" onClick={() => setOpen(open === p.id ? null : p.id)}>
                          {p.name}
                        </button>
                        <small className="sub">
                          {MODEL_NAME[p.model]}
                          {p.network && ` · ${p.network}`}
                        </small>
                      </td>
                      <td>
                        <span className={'stg ' + p.stage}>{STAGE_NAME[p.stage]}</span>
                        {nx && p.stage !== 'dung' && (
                          <button className="btn mini" onClick={() => move(p, nx)} title={`Chuyển sang ${STAGE_NAME[nx]}`}>
                            → {STAGE_NAME[nx]}
                          </button>
                        )}
                        {p.stage === 'dang_ky' && (
                          <button className="btn mini ghost" onClick={() => ps.patch(p.id, { ...advance(p, 'dung', t0), stop_reason: p.stop_reason || 'Không được duyệt' } as Partial<AffProject>)}>
                            Không được duyệt
                          </button>
                        )}
                      </td>
                      <td className="n">{t.cost ? usd(t.cost) : ''}</td>
                      <td className="n">{t.revenue ? usd(t.revenue) : ''}</td>
                      <td className="n">{t.received ? usd(t.received) : ''}</td>
                      <td className="n">{t.orders || ''}</td>
                      <td className={'n ' + (m.roi !== null && m.roi < 0 ? 'neg' : '')}>{t.cost ? pct(m.roi) : ''}</td>
                      <td className="n">{t.revenue ? pct(m.approval) : ''}</td>
                      <td>
                        {k && <span className={'chip-k ' + (k === 'Winner' ? 'green' : k === 'Ra đơn' ? 'blue' : 'red')}>{k}</span>}
                        {p.op_status && <span className={'chip-k ' + OP_COLOR[p.op_status]}>{OP_NAME[p.op_status]}</span>}
                        {f.kill && <span className="chip-k red solid">Nên dừng</span>}
                        {!f.kill && f.overCap && <span className="chip-k yellow solid">Vượt trần test</span>}
                        {f.winReady && <span className="chip-k green solid">Đạt tiêu chí thắng</span>}
                      </td>
                    </tr>
                    {open === p.id && (
                      <tr className="detail">
                        <td colSpan={9}>
                          <Detail p={p} entries={byP.get(p.id) ?? []} cap={f.cap} capMult={cfg.test_cap_mult} winReady={f.winReady} patch={(x) => ps.patch(p.id, x)} move={(s) => move(p, s)} del={() => ps.del(p.id)} es={es} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!list.length && (
                <tr>
                  <td colSpan={9} className="note">
                    Chưa có dự án nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec title="Hệ số đo được (3 tháng gần nhất)" hint="So với hệ số đang đặt trong Cài đặt">
        <div className="tbl">
          <table className="ktable aff-t">
            <thead>
              <tr>
                <th />
                <th>Vật lý: đặt</th>
                <th>Vật lý: đo được</th>
                <th>SaaS: đặt</th>
                <th>SaaS: đo được</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Số dự án đã test · thắng</td>
                <td />
                <td className="n">
                  {meas.phys.n_tests} · {meas.phys.n_wins}
                </td>
                <td />
                <td className="n">
                  {meas.saas.n_tests} · {meas.saas.n_wins}
                </td>
              </tr>
              <tr>
                <td>Tiền test 1 dự án</td>
                <td className="n">{usd(coeffs.phys.test_cost)}</td>
                <td className="n">{usd(meas.phys.test_cost)}</td>
                <td className="n">{usd(coeffs.saas.test_cost)}</td>
                <td className="n">{usd(meas.saas.test_cost)}</td>
              </tr>
              <tr>
                <td>Số test ra 1 thắng</td>
                <td className="n">{coeffs.phys.tests_per_win}</td>
                <td className="n">{meas.phys.tests_per_win === null ? (meas.phys.n_tests ? `chưa có thắng (${meas.phys.n_tests} test)` : '–') : Math.round(meas.phys.tests_per_win)}</td>
                <td className="n">{coeffs.saas.tests_per_win}</td>
                <td className="n">{meas.saas.tests_per_win === null ? (meas.saas.n_tests ? `chưa có thắng (${meas.saas.n_tests} test)` : '–') : Math.round(meas.saas.tests_per_win)}</td>
              </tr>
              <tr>
                <td>Lợi nhuận 1 thắng / tháng</td>
                <td className="n">{usd(coeffs.phys.win_profit)}</td>
                <td className="n">{usd(meas.phys.win_profit)}</td>
                <td className="n">–</td>
                <td className="n">{usd(meas.saas.win_profit)}</td>
              </tr>
              <tr>
                <td>% đăng ký được duyệt link</td>
                <td />
                <td className="n">{pct(meas.phys.reg_approved)}</td>
                <td />
                <td className="n">{pct(meas.saas.reg_approved)}</td>
              </tr>
              <tr>
                <td>% dự án test có đơn</td>
                <td />
                <td className="n">{pct(meas.phys.order_rate)}</td>
                <td />
                <td className="n">{pct(meas.saas.order_rate)}</td>
              </tr>
              <tr>
                <td>% Duyệt (thực nhận / doanh số)</td>
                <td />
                <td className="n">{pct(meas.phys.approval)}</td>
                <td />
                <td className="n">{pct(meas.saas.approval)}</td>
              </tr>
              <tr>
                <td>Đăng ký · Search / 1 test</td>
                <td className="n">
                  {cfg.reg_per_test} · {cfg.research_per_test}
                </td>
                <td className="n">{meas.phys.reg_per_test === null ? '–' : `${c1(meas.phys.reg_per_test)} · ${c1(meas.phys.research_per_test!)}`}</td>
                <td className="n">
                  {cfg.reg_per_test} · {cfg.research_per_test}
                </td>
                <td className="n">{meas.saas.reg_per_test === null ? '–' : `${c1(meas.saas.reg_per_test)} · ${c1(meas.saas.research_per_test!)}`}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">Số đo chưa tự thay hệ số đặt. Ở buổi rà đầu tháng, anh xem rồi sửa trong Cài đặt → Mô hình Affiliate. Mẫu còn nhỏ (ít thắng) thì chỉ để tham khảo.</p>
      </Sec>
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
