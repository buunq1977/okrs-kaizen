import { useCallback, useEffect, useMemo, useState } from 'react'
import { adCharges, analyze, coeffsOf, extraNeeded, monthOf, nextBudget, paceSpend, profitAfterFees, seasonWarn, v2Of, winsLabel, type AffConfig } from '../../lib/affiliate'
import { loadAffData } from '../../lib/affData'
import { affTickChanges, gateFromData, kpiTargets, metricSum, METRIC_NAME, METRIC_UNIT, type AffData, type Level, type MonthActuals } from '../../lib/affLink'
import { BENCH, diagnose, extraFindings } from '../../lib/affDiag'
import { countBetween, flags, measure, totals } from '../../lib/affProjects'
import { buildLedger, MODEL3, ROI_MIN_TOTAL, roiByField } from '../../lib/affSource'
import { useApp } from '../../lib/ctx'
import { errMsg, update } from '../../lib/db'
import { addMonths, fmtDM, monthEnd, today } from '../../lib/dates'
import { fmtNum } from '../../lib/pace'
import type { AffMetric, KA, KaizenData, KR, Objective } from '../../lib/types'
import { useAff } from './useAff'

const usd = (n: number) => (n < 0 ? '−$' : '$') + fmtNum(Math.round(Math.abs(n)))
interface Rows<T> {
  rows: T[]
  add: (r: Record<string, unknown>) => Promise<T | null>
  reload: () => void
}

/** Dữ liệu Sổ dự án; tải lại khi `key` đổi. */
function useAffData(key: string) {
  const [data, setData] = useState<AffData | null>(null)
  useEffect(() => {
    let live = true
    loadAffData().then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [key])
  return data
}

/** Đang ở Cổng 0 (chưa có dự án đủ điều kiện scale) → chỉ tiêu test theo nhịp khối lượng; chưa có số Research → null (theo mô hình). */
function paceOf(data: AffData | null, cfg: AffConfig | null): number | null {
  if (!cfg) return null
  const g = gateFromData(data, cfg)
  return g && g.gate === 0 ? v2Of(cfg).kickoff_tests_month : null
}
const srcLabel = (d: AffData | null) => (d?.source === 'research' ? 'Research + Ads-Hub' : 'Sổ dự án')

/* ---------- Ngày / Tuần: KR "Nhịp phễu Affiliate" + KA tự tick ---------- */
export function AffDayWeek(props: { level: 'day' | 'week'; start: string; end: string; periodId: string; objectiveId: string; krs: Rows<KR>; kas: Rows<KA> & { rows: KA[] }; editable: boolean; maxKr: number }) {
  const { level, start, end, periodId, objectiveId, krs, kas, editable, maxKr } = props
  const { toast, go } = useApp()
  const aff = useAff()
  const kaKey = kas.rows.map((k) => k.id + (k.done ? 1 : 0)).join(',')
  const data = useAffData(start + kaKey)
  const affKas = kas.rows.filter((k) => k.aff_metric)
  const pace = paceOf(data, aff.cfg)
  const t = useMemo(() => (aff.cfg && (aff.months.length || pace) ? kpiTargets(level, start, end, aff.months, aff.cfg, start, aff.live, pace) : null), [aff.cfg, aff.months, level, start, end, aff.live, pace])
  const count = useCallback((m: AffMetric) => (data ? metricSum(m, data, start, end) : 0), [data, start, end])

  // Tự tick KA Affiliate theo số đếm thật
  const kasReload = kas.reload
  useEffect(() => {
    if (!data || !affKas.length) return
    const ch = affTickChanges(affKas, count)
    if (!ch.length) return
    Promise.all(ch.map((c) => update('key_actions', c.id, { done: c.done, auto_ticked: c.auto_ticked })))
      .then(kasReload)
      .catch((e) => toast(errMsg(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (!aff.cfg) return null
  async function create() {
    if (!t) return
    if (krs.rows.length >= maxKr) return toast(`Đã đủ ${maxKr} KR. Xoá bớt 1 KR hoặc gộp trước khi lấy chỉ tiêu Affiliate.`)
    const kr = await krs.add({ period_id: periodId, objective_id: objectiveId, title: level === 'day' ? `Nhịp phễu Affiliate ngày ${fmtDM(start)}` : 'Nhịp phễu Affiliate tuần này', sort: krs.rows.length })
    if (!kr) return
    const items = (['search', 'dang_ky', 'test'] as const).filter((m) => t[m] > 0)
    let i = 0
    // Search / đăng ký theo phễu minh hoạ 5:2:1 → mức tham khảo; Lên camp test là chỉ tiêu bắt buộc
    for (const m of items) await kas.add({ kr_id: kr.id, title: `${METRIC_NAME[m]} ${t[m]} ${METRIC_UNIT[m]}${m === 'test' ? '' : ' (tham khảo)'}`, sort: i++, aff_metric: m, aff_target: t[m] })
    kas.reload()
  }
  const hasAff = affKas.length > 0
  return (
    <div className="aff-q">
      <div className="aff-q-h">
        <b>Affiliate {level === 'week' ? 'tuần này' : start === today() ? 'hôm nay' : `ngày ${fmtDM(start)}`}</b>
        {(['search', 'dang_ky', 'test'] as const).map((m) => (
          <span key={m} className={'pace-n ' + (t && count(m) >= t[m] ? 'ok' : '')}>
            {METRIC_NAME[m]} <b>{count(m)}</b>
            {t ? ` / ${t[m]}` : ''}
          </span>
        ))}
        <button className="linkbtn" onClick={() => go('projects')}>
          Mở Sổ dự án
        </button>
      </div>
      {!aff.months.length ? (
        <p className="note">Chưa có bảng phân bổ Affiliate: tạo ở Mô hình thu nhập → Affiliate Global để có chỉ tiêu.</p>
      ) : hasAff ? (
        <p className="note">
          KA Affiliate tự tick khi số đếm ở {srcLabel(data)} đạt chỉ tiêu.{pace ? ` Cổng 0: chỉ tiêu theo nhịp ${pace} test/tháng.` : ''}
        </p>
      ) : editable ? (
        <button className="btn" onClick={create} disabled={!t}>
          Lấy chỉ tiêu từ mô hình Affiliate
        </button>
      ) : (
        <p className="note">Kế hoạch đang khoá thêm KR: mở khoá (hoặc viết Bài học nếu đang khoá do đỏ liên tiếp) rồi lấy chỉ tiêu Affiliate.</p>
      )}
    </div>
  )
}

/* ---------- Tháng / Quý / Năm / Khởi động: KR số tự đếm ---------- */
export function AffLongKrs(props: { level: Level; start: string; end: string; periodId: string; o: Objective; krs: Rows<KR>; locked: boolean; openKrs: number; maxOpen: number; patchObj: (p: Partial<Objective>) => void }) {
  const { level, start, end, periodId, o, krs, locked, openKrs, maxOpen, patchObj } = props
  const { toast } = useApp()
  const aff = useAff()
  const data = useAffData('long' + start + end)
  const pace = paceOf(data, aff.cfg)
  if (!aff.cfg || (!aff.months.length && !pace)) return <p className="note">Chưa có bảng phân bổ Affiliate (Mô hình thu nhập → Affiliate Global) nên chưa lấy được chỉ tiêu.</p>
  const t = kpiTargets(level, start, end, aff.months, aff.cfg, start, aff.live, pace)
  const gate = gateFromData(data, aff.cfg)
  const plan: [AffMetric, number | null][] = [
    ['test', t.test],
    ['search', t.search],
    ['dang_ky', t.dang_ky],
    ['win', t.win],
    ['profit', t.profit],
    // Cổng 0–1: KR kết quả là có dự án đủ điều kiện scale (winner đầu tiên)
    ['scale_ready', gate && gate.gate <= 1 ? Math.max(1, (data?.flags?.ready ?? 0) + (gate.gate === 1 ? 1 : 0)) : null],
  ]
  const have = new Set(krs.rows.filter((k) => k.objective_id === o.id && k.aff_metric).map((k) => k.aff_metric))
  const todo = plan.filter(([m, v]) => v !== null && v > 0 && !have.has(m)) as [AffMetric, number][]
  const val = (m: AffMetric, v: number) => (m === 'profit' ? usd(v) : `${v} ${METRIC_UNIT[m]}`)

  async function create() {
    const room = Math.max(0, maxOpen - openKrs)
    const take = todo.slice(0, room)
    for (const [m, v] of take)
      await krs.add({
        period_id: periodId,
        objective_id: o.id,
        kind: 'numeric',
        title: m === 'profit' ? `Lợi nhuận đã nhận tháng cuối kỳ ${usd(v)}` : `${METRIC_NAME[m]} ${v} ${METRIC_UNIT[m]}`,
        baseline: 0,
        target: v,
        unit: METRIC_UNIT[m],
        deadline: end,
        source: `${srcLabel(data)} (tự đếm)`,
        aff_metric: m,
        sort: krs.rows.length,
      })
    if (!o.title.trim()) patchObj({ title: `Affiliate: ${t.test} camp test${t.win ? `, ${t.win} camp thắng` : ''}${t.profit ? `, lợi nhuận ${usd(t.profit)}/tháng` : ''}` })
    if (take.length < todo.length) toast(`Chỉ thêm được ${take.length} KR (trần ${maxOpen} KR đang mở). Còn thiếu: ${todo.slice(take.length).map(([m]) => METRIC_NAME[m]).join(', ')}.`)
  }
  return (
    <div className="aff-q">
      <div className="aff-q-h">
        <b>Mô hình Affiliate gợi ý</b>
        {plan.map(([m, v]) => (
          <span key={m} className="pace-n ok">
            {METRIC_NAME[m]} <b>{v === null ? (m === 'win' ? '< 1' : '–') : val(m, v)}</b>
          </span>
        ))}
      </div>
      {locked ? (
        <p className="note">Kế hoạch đã chốt: thêm KR theo luật điều chỉnh (ô lý do bên dưới).</p>
      ) : todo.length ? (
        <button className="btn" onClick={create}>
          Tạo {todo.length} KR tự đếm từ {srcLabel(data)}
        </button>
      ) : (
        <p className="note">
          Đã có đủ KR Affiliate. Thực tế tự đếm từ bộ đếm search và {srcLabel(data)}.{pace ? ` Cổng 0: chỉ tiêu theo nhịp ${pace} test/tháng.` : ''}
        </p>
      )}
    </div>
  )
}

/* ---------- Kaizen: cập nhật Sổ dự án ---------- */
export function AffPulse({ level, start, end }: { level: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'kickoff'; start: string; end: string }) {
  const { go } = useApp()
  const aff = useAff()
  const data = useAffData(start + end)
  if (!aff.cfg || !data) return null
  const cfg = aff.cfg
  const pace = paceOf(data, cfg)
  const t = aff.months.length || pace ? kpiTargets(level, start, end, aff.months, cfg, start, aff.live, pace) : null
  const c = coeffsOf({ coeffs: null }, cfg, aff.live)
  const byP = new Map<string, typeof data.entries>()
  for (const e of data.entries) byP.set(e.project_id, [...(byP.get(e.project_id) ?? []), e])
  const testing = data.projects.filter((p) => p.stage === 'test')
  const appr = measure(data.projects, data.entries, data.tallies, 'phys', '2000-01-01', end).approval
  const fl = testing.map((p) => flags(p, totals(byP.get(p.id) ?? []), c, cfg.test_cap_mult, aff.th?.winner_orders ?? cfg.win_min_orders ?? 3, appr, aff.th?.roa?.[0]))
  const fromRs = data.source === 'research'
  const kill = fromRs ? (data.flags?.stop ?? 0) : fl.filter((f) => f.kill).length
  const ready = fromRs ? (data.flags?.candidate ?? 0) + (data.flags?.ready ?? 0) : fl.filter((f) => f.winReady).length
  const noCost = level === 'day' && !fromRs ? testing.filter((p) => !(byP.get(p.id) ?? []).some((e) => e.date === start)).length : 0
  // Kaizen tháng đã chốt sổ: đọc bản chụp số thực tế (không đổi theo dữ liệu Ads-Hub về sau)
  const snap = level === 'month' ? (aff.months.find((x) => x.month === start && x.actuals)?.actuals as MonthActuals | undefined) : undefined
  const sum = (m: AffMetric) => (snap && m in snap.counts ? snap.counts[m as keyof MonthActuals['counts']] : metricSum(m, data, start, end))
  const profit = sum('profit')
  const isLong = level !== 'day' && level !== 'week'
  const rows: [AffMetric, number | null][] = [
    ['search', t?.search ?? null],
    ['chon', null],
    ['dang_ky', t?.dang_ky ?? null],
    ['duyet', null],
    ['test', t?.test ?? null],
    ...(isLong ? ([['win', t?.win ?? null]] as [AffMetric, number | null][]) : []),
  ]
  const curMonth = monthOf(end)
  const recvMonth = metricSum('profit', data, curMonth, monthEnd(curMonth))
  const recvTotals = totals(data.entries, curMonth, monthEnd(curMonth))
  const netRecv = profitAfterFees(recvTotals, cfg).net
  const floor = paceSpend(cfg, c.phys.test_cost)
  const nb = nextBudget(floor, cfg.reinvest_pct, netRecv)
  return (
    <div className="aff-q">
      <div className="aff-q-h">
        <b>Affiliate · đo lường ({snap ? `bản chụp lúc chốt sổ ${fmtDM(snap.at.slice(0, 10))}` : srcLabel(data)})</b>
        <button className="linkbtn" onClick={() => go('projects')}>
          Mở Sổ dự án để cập nhật
        </button>
      </div>
      <div className="aff-q-h">
        {rows.map(([m, v]) => {
          const n = sum(m)
          return (
            <span key={m} className={'pace-n ' + (v === null || n >= v ? 'ok' : '')}>
              {METRIC_NAME[m]} <b>{n}</b>
              {v !== null ? ` / ${m === 'win' ? winsLabel(v) : v}` : ''}
            </span>
          )
        })}
        <span className={'pace-n ' + (profit >= 0 ? 'ok' : '')}>
          Lợi nhuận đã nhận <b>{usd(profit)}</b>
        </span>
      </div>
      <ul className="alerts">
        {noCost > 0 && <li className="yellow">🟡 {noCost} camp đang test chưa nhập chi phí hôm nay (lấy số từ Google Ads).</li>}
        {kill > 0 && <li className="red">🔴 {kill} dự án nên dừng: {fromRs ? 'chạm trần tiền test (maxtest) mà 0 đơn' : 'đã tiêu hết tiền test mà 0 đơn'}.</li>}
        {fromRs && (data.flags?.consider ?? 0) > 0 && <li className="yellow">🟡 {data.flags!.consider} dự án cân nhắc dừng: đủ click/sale mà 0 đơn.</li>}
        {ready > 0 && <li className="green">🟢 {ready} dự án {fromRs ? 'ứng viên thắng / đủ điều kiện scale' : 'đạt tiêu chí thắng'}: xem checklist scale ở Sổ dự án.</li>}
        {level === 'week' && !fromRs && <li>Cuối tuần: nhập Doanh số + Thực nhận từ network cho các dự án đang chạy.</li>}
        {isLong && (
          <li>
            Ngân sách test tháng sau: <b>{usd(nb)}</b> = lớn hơn trong hai số: sàn nhịp {usd(floor)} ({v2Of(cfg).kickoff_tests_month} test × maxtest {usd(c.phys.test_cost)}) hoặc {cfg.reinvest_pct}% lợi nhuận đã nhận tháng {curMonth.slice(5, 7)} sau phí, thuế ({usd(netRecv)}; trước phí {usd(recvMonth)}). Vốn ngoài cần bù:{' '}
            <b>{usd(extraNeeded(adCharges(nb, v2Of(cfg).fee_pct, v2Of(cfg).tax_pct).total, cfg.reinvest_pct, netRecv))}</b>.
          </li>
        )}
      </ul>
    </div>
  )
}

/* ---------- Kaizen tháng/quý/năm: chẩn đoán phễu ---------- */
export function AffDiagnosis({ level, start, end, k, save }: { level: Level; start: string; end: string; k: KaizenData; save: (p: Partial<KaizenData>) => void }) {
  const aff = useAff()
  const data = useAffData('diag' + start + end)
  if (!aff.cfg || !data) return null
  const cfg = aff.cfg
  const pace = paceOf(data, cfg)
  const t = aff.months.length || pace ? kpiTargets(level, start, end, aff.months, cfg, start, aff.live, pace) : null
  const c = countBetween(data.projects, data.tallies, start, end)
  const to = end < today() ? end : today()
  const since = addMonths(to, -3)
  const mp = measure(data.projects, data.entries, data.tallies, 'phys', since, to)
  const ms = measure(data.projects, data.entries, data.tallies, 'saas', since, to)
  const set = coeffsOf({ coeffs: null }, cfg, aff.live)
  const waiting = data.projects.filter((p) => p.stage === 'duoc_duyet').length
  const fromRs = data.source === 'research'
  // % duyệt: Ads-Hub tính trên đơn đã quá hạn payout (không lẫn đơn chờ); Sổ nhập tay thì như cũ
  const apprR = fromRs && data.appr ? data.appr.phys : null
  const fs = [
    ...diagnose(c, t, fromRs ? { ...mp, approval: null } : mp, set, waiting),
    ...(fromRs
      ? extraFindings({
          testCost: mp.test_cost,
          nTests: mp.n_tests,
          maxTest: aff.th?.max_test_usd ?? null,
          approval: data.appr ? { pct: data.appr.phys.pct, resolved: MODEL3.reduce((s, m) => s + data.appr![m].resolved, 0) } : null,
          warnPct: v2Of(cfg).approval_warn_pct,
          pendingComm: (data.ah?.orders ?? []).filter((o) => o.status === 'pending' && o.d >= start && o.d <= end).reduce((s, o) => s + Number(o.comm), 0),
          deniedComm: (data.ah?.orders ?? []).filter((o) => o.status === 'denied' && o.d >= start && o.d <= end).reduce((s, o) => s + Number(o.comm), 0),
          seasonWarn: seasonWarn(aff.months, today()),
          capitalShort: aff.months.length ? (analyze(aff.months, cfg, today(), aff.live).capitalShort[0] ?? null) : null,
        })
      : []),
  ]
  const lessons = k.num_lessons ?? []
  const saved = new Set(lessons.map((l) => l.text))
  const icon = { red: '🔴', yellow: '🟡', green: '🟢', info: 'ℹ️' } as const
  const pct = (n: number | null) => (n === null ? '–' : Math.round(n) + '%')
  const money = (n: number | null) => (n === null ? '–' : usd(n))
  const rowsM: [string, string, string, string, string][] = [
    ['Số dự án đã test · thắng', '', `${mp.n_tests} · ${mp.n_wins}`, '', `${ms.n_tests} · ${ms.n_wins}`],
    ['Tiền test 1 dự án', usd(set.phys.test_cost), money(mp.test_cost), usd(set.saas.test_cost), money(ms.test_cost)],
    ['Số test ra 1 thắng', String(set.phys.tests_per_win), mp.tests_per_win === null ? '–' : String(Math.round(mp.tests_per_win)), String(set.saas.tests_per_win), ms.tests_per_win === null ? '–' : String(Math.round(ms.tests_per_win))],
    ['Lợi nhuận 1 thắng / tháng', usd(set.phys.win_profit), money(mp.win_profit), '–', money(ms.win_profit)],
    ['% đăng ký được duyệt link', `${BENCH.reg_approved}% (minh hoạ)`, pct(mp.reg_approved), '', pct(ms.reg_approved)],
    ['% dự án test có đơn', `${BENCH.order_rate}% (minh hoạ)`, pct(mp.order_rate), '', pct(ms.order_rate)],
    fromRs
      ? ['% duyệt hoa hồng (đơn quá hạn payout)', `cảnh báo < ${v2Of(cfg).approval_warn_pct}%`, apprR ? pct(apprR.pct) : '–', '', data.appr ? pct(data.appr.saas.pct) : '–']
      : ['% duyệt hoa hồng', `${BENCH.commission_approval}% (giả định)`, pct(mp.approval), '', pct(ms.approval)],
  ]
  return (
    <div className="aff-q">
      <div className="aff-q-h">
        <b>Chẩn đoán phễu Affiliate</b>
        <span className="note">Khối lượng tính trong kỳ; tỷ lệ đo trên 3 tháng gần nhất để đủ mẫu</span>
      </div>
      <div className="tbl">
        <table className="ktable aff-t">
          <thead>
            <tr>
              <th />
              <th>Vật lý: đặt / chuẩn</th>
              <th>Vật lý: đo được</th>
              <th>SaaS: đặt</th>
              <th>SaaS: đo được</th>
            </tr>
          </thead>
          <tbody>
            {rowsM.map((r) => (
              <tr key={r[0]}>
                <td>{r[0]}</td>
                <td className="n">{r[1]}</td>
                <td className="n">{r[2]}</td>
                <td className="n">{r[3]}</td>
                <td className="n">{r[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="alerts">
        {fs.map((f) => {
          const text = `${f.stage}: ${f.text} → ${f.action}`
          return (
            <li key={f.key} className={f.level === 'info' ? '' : f.level}>
              {icon[f.level]} <b>{f.stage}:</b> {f.text}. {f.action}{' '}
              {f.level !== 'green' &&
                (saved.has(text) ? (
                  <span className="note">· đã ghi bài học</span>
                ) : (
                  <button className="btn mini" onClick={() => save({ num_lessons: [...lessons, { id: Math.random().toString(36).slice(2, 10), text, number: f.number }] })}>
                    Ghi thành bài học có số
                  </button>
                ))}
            </li>
          )
        })}
      </ul>
      {fromRs && data.ws && <RoiByField data={data} />}
      <p className="note">Hệ số đo được khác số đặt nhiều thì cập nhật ở Mô hình thu nhập → Cấu hình mô hình trong buổi rà đầu kỳ (nút "Dùng số đo").</p>
    </div>
  )
}

/** GĐ6: ROI theo trường lọc của Research (hoa hồng / đơn, loại hoa hồng, thị trường, cookie). Chỉ kết luận khi đủ dự án đã test. */
function RoiByField({ data }: { data: AffData }) {
  const r = roiByField(buildLedger(data.ws!, data.ah ?? null), data.ws!)
  if (!r.enough)
    return (
      <p className="note">
        ROI theo trường lọc của Research: cần ≥ {ROI_MIN_TOTAL} dự án đã test để so (đang có {r.total}).
      </p>
    )
  const pct = (n: number | null) => (n === null ? '–' : `${n > 0 ? '+' : ''}${Math.round(n)}%`)
  return (
    <div className="aff-q">
      <b>ROI theo trường lọc của Research ({r.total} dự án đã test, từ trước tới nay)</b>
      <div className="tbl">
        <table className="ktable">
          <thead>
            <tr>
              <th>Trường lọc</th>
              <th>Nhóm</th>
              <th style={{ textAlign: 'right' }}>Dự án</th>
              <th style={{ textAlign: 'right' }}>Chi phí</th>
              <th style={{ textAlign: 'right' }}>Đã nhận</th>
              <th style={{ textAlign: 'right' }}>ROI</th>
            </tr>
          </thead>
          <tbody>
            {r.groups.flatMap((g) =>
              g.buckets.map((b, i) => (
                <tr key={g.field + b.bucket}>
                  <td>{i === 0 ? <b>{g.field}</b> : ''}</td>
                  <td>
                    {b.bucket}
                    {b.few && <small className="sub">ít mẫu</small>}
                  </td>
                  <td className="n">{b.n}</td>
                  <td className="n">{usd(b.cost)}</td>
                  <td className="n">{usd(b.received)}</td>
                  <td className={'n ' + (b.roi !== null && b.roi < 0 ? 'neg' : '')}>{pct(b.roi)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className="note">Nhóm nào ROI âm rõ và đủ mẫu thì siết bộ lọc ở Research (ví dụ bỏ dự án hoa hồng / đơn thấp). Nhóm "ít mẫu" chỉ để tham khảo.</p>
    </div>
  )
}
