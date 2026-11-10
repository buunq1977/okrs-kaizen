import { useCallback, useEffect, useMemo, useState } from 'react'
import { monthOf, nextBudget, physOf, saasOf, winsLabel } from '../../lib/affiliate'
import { loadAffData } from '../../lib/affData'
import { affTickChanges, kpiTargets, metricSum, METRIC_NAME, METRIC_UNIT, type AffData, type Level } from '../../lib/affLink'
import { flags, measure, totals } from '../../lib/affProjects'
import { useApp } from '../../lib/ctx'
import { errMsg, update } from '../../lib/db'
import { fmtDM, monthEnd, today } from '../../lib/dates'
import { fmtNum } from '../../lib/pace'
import type { AffMetric, KA, KR, Objective } from '../../lib/types'
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

/* ---------- Ngày / Tuần: KR "Nhịp phễu Affiliate" + KA tự tick ---------- */
export function AffDayWeek(props: { level: 'day' | 'week'; start: string; end: string; periodId: string; objectiveId: string; krs: Rows<KR>; kas: Rows<KA> & { rows: KA[] }; editable: boolean; maxKr: number }) {
  const { level, start, end, periodId, objectiveId, krs, kas, editable, maxKr } = props
  const { toast, go } = useApp()
  const aff = useAff()
  const kaKey = kas.rows.map((k) => k.id + (k.done ? 1 : 0)).join(',')
  const data = useAffData(start + kaKey)
  const affKas = kas.rows.filter((k) => k.aff_metric)
  const t = useMemo(() => (aff.cfg && aff.months.length ? kpiTargets(level, start, end, aff.months, aff.cfg, start) : null), [aff.cfg, aff.months, level, start, end])
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
    for (const m of items) await kas.add({ kr_id: kr.id, title: `${METRIC_NAME[m]} ${t[m]} ${METRIC_UNIT[m]}`, sort: i++, aff_metric: m, aff_target: t[m] })
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
        <p className="note">KA Affiliate tự tick khi số đếm ở Sổ dự án đạt chỉ tiêu.</p>
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
  if (!aff.cfg || !aff.months.length) return <p className="note">Chưa có bảng phân bổ Affiliate (Mô hình thu nhập → Affiliate Global) nên chưa lấy được chỉ tiêu.</p>
  const t = kpiTargets(level, start, end, aff.months, aff.cfg, start)
  const plan: [AffMetric, number | null][] = [
    ['test', t.test],
    ['search', t.search],
    ['dang_ky', t.dang_ky],
    ['win', t.win],
    ['profit', t.profit],
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
        source: 'Sổ dự án (tự đếm)',
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
          Tạo {todo.length} KR tự đếm từ Sổ dự án
        </button>
      ) : (
        <p className="note">Đã có đủ KR Affiliate. Thực tế tự đếm từ bộ đếm search và Sổ dự án.</p>
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
  const t = aff.months.length ? kpiTargets(level, start, end, aff.months, cfg, start) : null
  const c = { phys: physOf(cfg.phys), saas: saasOf(cfg.saas) }
  const byP = new Map<string, typeof data.entries>()
  for (const e of data.entries) byP.set(e.project_id, [...(byP.get(e.project_id) ?? []), e])
  const testing = data.projects.filter((p) => p.stage === 'test')
  const appr = measure(data.projects, data.entries, data.tallies, 'phys', '2000-01-01', end).approval
  const fl = testing.map((p) => flags(p, totals(byP.get(p.id) ?? []), c, cfg.test_cap_mult, cfg.win_min_orders ?? 3, appr))
  const kill = fl.filter((f) => f.kill).length
  const ready = fl.filter((f) => f.winReady).length
  const noCost = level === 'day' ? testing.filter((p) => !(byP.get(p.id) ?? []).some((e) => e.date === start)).length : 0
  const profit = metricSum('profit', data, start, end)
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
  return (
    <div className="aff-q">
      <div className="aff-q-h">
        <b>Sổ dự án Affiliate · đo lường</b>
        <button className="linkbtn" onClick={() => go('projects')}>
          Mở Sổ dự án để cập nhật
        </button>
      </div>
      <div className="aff-q-h">
        {rows.map(([m, v]) => {
          const n = metricSum(m, data, start, end)
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
        {kill > 0 && <li className="red">🔴 {kill} dự án nên dừng: đã tiêu hết tiền test mà 0 đơn.</li>}
        {ready > 0 && <li className="green">🟢 {ready} dự án đạt tiêu chí thắng: xem để đánh dấu Thắng và scale.</li>}
        {level === 'week' && <li>Cuối tuần: nhập Doanh số + Thực nhận từ network cho các dự án đang chạy.</li>}
        {isLong && (
          <li>
            Ngân sách test tháng sau đề xuất: <b>{usd(nextBudget(cfg.base_budget, cfg.reinvest_pct, recvMonth))}</b> = {usd(cfg.base_budget)} + {cfg.reinvest_pct}% lợi nhuận đã nhận tháng {curMonth.slice(5, 7)} ({usd(recvMonth)}).
          </li>
        )}
      </ul>
    </div>
  )
}
