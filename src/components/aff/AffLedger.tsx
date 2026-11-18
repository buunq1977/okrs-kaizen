import { Fragment, useEffect, useMemo, useState } from 'react'
import { coeffsOf, v2Of } from '../../lib/affiliate'
import { loadAh, loadWs, type SrcResult } from '../../lib/affData'
import type { AffProject } from '../../lib/affProjects'
import {
  approvalStat, buildLedger, liveOrders, MODEL3, MODEL3_NAME, receivedComm, SCALE_MANUAL, stopCheck, winCheck,
  type AhData, type ApprovalStat, type LedgerRow, type Model3, type ScaleManual, type StopCheck, type WinCheck, type WsData,
} from '../../lib/affSource'
import { addDays, fmtDM, today } from '../../lib/dates'
import { fmtNum } from '../../lib/pace'
import { Sec, Txt } from '../ui'
import { useAff } from './useAff'

const usd = (n: number | null) => (n === null || !Number.isFinite(n) ? '–' : '$' + n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const x2 = (n: number | null) => (n === null ? '–' : (Math.round(n * 100) / 100).toLocaleString('vi-VN'))
const pct = (n: number | null) => (n === null ? 'chưa đủ dữ liệu' : Math.round(n) + '%')

interface Links {
  rows: AffProject[]
  add: (row: Record<string, unknown>) => Promise<AffProject | null>
  patch: (id: string, part: Partial<AffProject>) => Promise<void> | void
}
interface Item {
  r: LedgerRow
  link: AffProject | undefined
  stop: StopCheck
  win: WinCheck
}

/** Sổ dự án GĐ3: dự án đã lên camp ở Research + số Ads-Hub. Chỉ đọc hai app; lý do mở rộng và checklist scale lưu ở OKR. */
export default function AffLedger({ links }: { links: Links }) {
  const aff = useAff()
  const t0 = today()
  const [ws, setWs] = useState<SrcResult<WsData> | null>(null)
  const [ah, setAh] = useState<SrcResult<AhData> | null>(null)
  const [model, setModel] = useState<'all' | Model3>('all')
  const [only, setOnly] = useState<'testing' | 'all'>('testing')
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadWs(), loadAh(addDays(t0, -399), t0)]).then(([w, a]) => {
      if (!alive) return
      setWs(w)
      setAh(a)
    })
    return () => {
      alive = false
    }
  }, [t0])

  const cfg = aff.cfg
  const th = aff.th
  const wsD = ws?.data ?? null
  const ahD = ah?.data ?? null
  const rows = useMemo(() => (wsD ? buildLedger(wsD, ahD) : []), [wsD, ahD])
  if (!cfg || !ws) return <Sec title="Dự án từ Research + Ads-Hub"><p className="note">Đang đọc Research và Ads-Hub…</p></Sec>
  if (!wsD)
    return (
      <Sec title="Dự án từ Research + Ads-Hub">
        <p className="flag">{ws.error ?? 'Chưa đọc được Research.'} Đăng nhập ở Cài đặt → Kết nối nguồn số. Trong lúc chờ, Sổ dự án nhập tay bên dưới vẫn dùng được.</p>
      </Sec>
    )

  const v2 = v2Of(cfg)
  const co = coeffsOf({ coeffs: null }, cfg, aff.live)
  const payout: Record<Model3, number> = { phys: co.phys.payout_days, tools_ai: co.tools.payout_days, saas: co.saas.payout_days }
  const appr: Record<Model3, ApprovalStat> | null = ahD
    ? (Object.fromEntries(MODEL3.map((m) => [m, approvalStat(ahD, wsD, t0, payout[m], m)])) as Record<Model3, ApprovalStat>)
    : null
  const thr = th ?? { usd_vnd: null, max_test_usd: null, roa: null, winner_orders: null, click_rules: [] }
  const items: Item[] = rows.map((r) => {
    const link = links.rows.find((p) => p.ws_reg_id === r.reg_id)
    const ext = !!link?.ext_reason?.trim()
    return {
      r,
      link,
      stop: stopCheck(r, thr, cfg.test_cap_mult, ext, t0, co.phys.test_cost),
      win: winCheck(r, ahD, r.model && appr ? appr[r.model].pct : null, thr, (link?.scale_check ?? {}) as ScaleManual, t0, { roa: co.phys.roas, winner: cfg.win_min_orders ?? 3 }),
    }
  })
  const shown = items
    .filter((x) => model === 'all' || x.r.model === model)
    .filter((x) => only === 'all' || x.r.test_status === 'Đang Testing')
    .sort((a, b) => rank(b) - rank(a) || (b.r.first_test ?? '').localeCompare(a.r.first_test ?? ''))
  // đếm theo đúng bộ lọc đang chọn; cờ dừng chỉ xét dự án Đang Testing
  const count = (f: (x: Item) => boolean) => shown.filter(f).length
  const testing = (x: Item) => x.r.test_status === 'Đang Testing'
  const nStop = count((x) => testing(x) && x.stop.level === 'stop')
  const nConsider = count((x) => testing(x) && x.stop.level === 'consider')
  const nTrial = count((x) => testing(x) && x.stop.level === 'trial')
  const nCand = count((x) => x.win.candidate && !x.win.ready)
  const nReady = count((x) => x.win.ready)

  async function save(it: Item, part: Partial<AffProject>) {
    if (it.link) await links.patch(it.link.id, part)
    else await links.add({ name: it.r.name, model: it.r.model ?? 'phys', stage: 'research', ws_reg_id: it.r.reg_id, ...part })
  }

  return (
    <Sec title={`Dự án từ Research + Ads-Hub (${items.length})`} hint="Chỉ đọc: trạng thái test sửa ở Research; chi phí, click, đơn lấy từ Ads-Hub">
      {!ahD && <p className="flag">{ah?.needSql ? 'Ads-Hub chưa chạy file 12_okr_read.sql.' : (ah?.error ?? 'Chưa đọc được Ads-Hub.')} Đang dùng chi phí, click của lần test ở Research; chưa có đơn hàng.</p>}
      {!th?.max_test_usd && <p className="flag">Chưa đọc được maxtest ở Research: trần tiền test tạm dùng {usd(co.phys.test_cost)}.</p>}

      <div className="badges">
        {nStop > 0 && <span className="badge red">🔴 {nStop} nên dừng</span>}
        {nConsider > 0 && <span className="badge yellow">🟡 {nConsider} cân nhắc dừng</span>}
        {nTrial > 0 && <span className="badge">⏳ {nTrial} chờ dùng thử</span>}
        {nCand > 0 && <span className="badge green">🟢 {nCand} ứng viên thắng</span>}
        {nReady > 0 && <span className="badge green">✅ {nReady} đủ điều kiện scale</span>}
        {!nStop && !nConsider && !nTrial && !nCand && !nReady && <span className="note">Chưa có cờ nào.</span>}
      </div>

      {appr && (
        <div className="tbl">
          <table className="ktable">
            <thead>
              <tr>
                <th>% duyệt hoa hồng (đơn đã quá hạn payout)</th>
                {MODEL3.map((m) => (
                  <th key={m} style={{ textAlign: 'right' }}>
                    {MODEL3_NAME[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Đã duyệt ÷ (đã duyệt + bị huỷ)</td>
                {MODEL3.map((m) => (
                  <td key={m} className={'n ' + (appr[m].pct !== null && appr[m].pct! < v2.approval_warn_pct ? 'neg' : '')}>
                    {pct(appr[m].pct)} <small>· {appr[m].resolved} đơn</small>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Đang chờ duyệt</td>
                {MODEL3.map((m) => (
                  <td key={m} className="n">
                    {appr[m].pending_n} đơn · {usd(appr[m].pending_comm)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {appr && MODEL3.some((m) => appr[m].pct !== null && appr[m].pct! < v2.approval_warn_pct) && (
        <p className="flag">
          % duyệt dưới {v2.approval_warn_pct}%: kiểm lại bộ lọc dự án trước khi test thêm: Payout Rate ≥ 70% (UpPromote), Trustpilot có phàn nàn không trả hoa hồng, danh sách dự án loại trừ, 10 câu hỏi chính sách.
        </p>
      )}
      <p className="note">
        % duyệt chỉ tính đơn đã quá hạn payout (Vật lý {payout.phys} ngày, Tools AI {payout.tools_ai}, SaaS {payout.saas}) và cần ≥ 5 đơn có kết quả; đơn đang chờ tính riêng.
      </p>

      <div className="badges">
        {(['all', ...MODEL3] as const).map((m) => (
          <button key={m} className="chip" aria-pressed={model === m} onClick={() => setModel(m)}>
            {m === 'all' ? 'Tất cả mô hình' : MODEL3_NAME[m]}
          </button>
        ))}
        <button className="chip" aria-pressed={only === 'testing'} onClick={() => setOnly(only === 'testing' ? 'all' : 'testing')}>
          Chỉ dự án Đang Testing
        </button>
      </div>

      {!shown.length ? (
        <p className="note">Chưa có dự án nào {only === 'testing' ? 'đang test' : 'đã lên camp'} ở Research.</p>
      ) : (
        <div className="tbl">
          <table className="ktable">
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Research</th>
                <th style={{ textAlign: 'right' }}>Chi phí</th>
                <th style={{ textAlign: 'right' }}>Click · CPC</th>
                <th style={{ textAlign: 'right' }}>Đơn chờ / duyệt / huỷ</th>
                <th style={{ textAlign: 'right' }}>HH đã duyệt</th>
                <th style={{ textAlign: 'right' }}>ROAS thực nhận</th>
                <th>Cờ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => (
                <Fragment key={it.r.reg_id}>
                  <tr className={open === it.r.reg_id ? "open" : ""}>
                    <td>
                      <button className="linkbtn" onClick={() => setOpen(open === it.r.reg_id ? null : it.r.reg_id)}>
                        <b>{it.r.name}</b>
                      </button>
                      <small className="sub">
                        {it.r.model ? MODEL3_NAME[it.r.model] : 'Chưa rõ loại'}
                        {it.r.first_test && ` · test từ ${fmtDM(it.r.first_test)}`}
                        {it.r.source === 'research' && ' · số từ Research'}
                      </small>
                    </td>
                    <td>
                      {it.r.test_status}
                      {it.r.test_result && it.r.test_result !== it.r.test_status && <small className="sub">{it.r.test_result}</small>}
                    </td>
                    <td className="n">{usd(it.r.cost)}</td>
                    <td className="n">
                      {fmtNum(it.r.clicks)}
                      <small className="sub">{it.stop.cpc_vnd !== null ? fmtNum(Math.round(it.stop.cpc_vnd)) + 'đ' : '–'}</small>
                    </td>
                    <td className="n">
                      {it.r.orders.pending} / {it.r.orders.approved + it.r.orders.paid} / {it.r.orders.denied}
                    </td>
                    <td className="n">{usd(receivedComm(it.r))}</td>
                    <td className="n">{x2(it.win.roas_real)}</td>
                    <td>
                      <Flags it={it} />
                    </td>
                  </tr>
                  {open === it.r.reg_id && (
                    <tr className="detail">
                      <td colSpan={8}>
                        <Detail it={it} capMult={cfg.test_cap_mult} roaMin={th?.roa?.[0] ?? co.phys.roas} winN={th?.winner_orders ?? cfg.win_min_orders ?? 3} save={(p) => save(it, p)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sec>
  )
}

const rank = (x: Item) => (x.win.ready ? 6 : x.win.candidate ? 5 : x.stop.level === 'stop' ? 4 : x.stop.level === 'consider' ? 3 : x.stop.level === 'trial' ? 2 : 1)

function Flags({ it }: { it: Item }) {
  const out: [string, string][] = []
  if (it.win.ready) out.push(['green', '✅ Đủ điều kiện scale'])
  else if (it.win.candidate) out.push(['green', '🟢 Ứng viên thắng'])
  if (it.r.test_status === 'Đang Testing') {
    if (it.stop.level === 'stop') out.push(['red', '🔴 Nên dừng'])
    if (it.stop.level === 'consider') out.push(['yellow', '🟡 Cân nhắc dừng'])
    if (it.stop.level === 'trial') out.push(['', `⏳ Chờ dùng thử ${it.stop.trial_left} ngày`])
  }
  if (!out.length) return null
  return (
    <div className="badges">
      {out.map(([c, t]) => (
        <span key={t} className={'badge ' + c}>
          {t}
        </span>
      ))}
    </div>
  )
}

function Detail({ it, capMult, roaMin, winN, save }: { it: Item; capMult: number; roaMin: number; winN: number; save: (p: Partial<AffProject>) => void }) {
  const { r, stop, win, link } = it
  const manual = (link?.scale_check ?? {}) as ScaleManual
  const ok = (b: boolean) => (b ? '✅' : '❌')
  return (
    <div className="aff-q">
      <b>Luật dừng (giống Research)</b>
      <ul className="alerts">
        <li>
          CPC thực tế {stop.cpc_vnd !== null ? fmtNum(Math.round(stop.cpc_vnd)) + 'đ' : 'chưa có (chưa có click)'} → click cho 1 sale theo bảng Loại dự án: <b>{stop.cps ?? '–'}</b>; click tối đa theo maxtest: <b>{stop.max_clicks ?? '–'}</b>.
        </li>
        <li>
          Trần tiền test: <b>{usd(stop.cap)}</b>
          {link?.ext_reason?.trim() ? ` (đã mở rộng ×${capMult})` : ''}. Đã tiêu {usd(r.cost)}, {fmtNum(r.clicks)} click, {liveOrders(r)} đơn.
          {stop.by_money && ' Chưa có click: chỉ xét theo tiền, cần số click để chính xác.'}
        </li>
        {stop.level === 'trial' && <li>SaaS / Tools AI còn trong cửa sổ dùng thử ({r.trial_days ?? 14} ngày tính từ click gần nhất {r.last_click && fmtDM(r.last_click)}): chưa kết luận, còn {stop.trial_left} ngày.</li>}
      </ul>
      <label className="fld">
        <span>Lý do mở rộng test (có lý do thì trần × {capMult})</span>
        <Txt value={link?.ext_reason ?? ''} placeholder="VD: có đơn chờ duyệt, CPC đang giảm…" onSave={(v) => save({ ext_reason: v })} />
      </label>

      <b>Ứng viên thắng</b>
      <p className="note">
        {ok(win.candidate)} ≥ {winN} đơn (đang có {win.orders}) và ROAS thực nhận dự kiến ≥ {fmtNum(roaMin)} (đang {x2(win.roas_expected)}; = đã duyệt + chờ duyệt × % duyệt, chia chi phí).
        {win.candidate && ' Cẩn thận "dự án mồi": vài đơn đầu có thể không bền, chưa đủ để scale.'}
      </p>

      <b>Đủ điều kiện scale</b>
      <ul className="alerts">
        <li>
          {ok(win.auto.conv30)} ≥ 30 chuyển đổi trong 30 ngày (đang {win.conv30})
        </li>
        <li>
          {ok(win.auto.roas)} ROAS thực nhận ≥ {fmtNum(roaMin)} (đang {x2(win.roas_real)}, chỉ tính hoa hồng đã duyệt / đã trả)
        </li>
        <li>
          {ok(win.auto.steady)} Có đơn đều: ≥ 7 ngày có đơn trong 14 ngày gần nhất (đang {win.steady_days} ngày)
        </li>
        {SCALE_MANUAL.map((m) => (
          <li key={m.k}>
            <label>
              <input type="checkbox" checked={!!manual[m.k]} onChange={(e) => save({ scale_check: { ...manual, [m.k]: e.target.checked } })} /> {m.label}{' '}
              <small className="note">(xem ở Google Ads, tick tay)</small>
            </label>
          </li>
        ))}
      </ul>
      {win.low_volume && win.candidate && <p className="flag">Dưới 20 chuyển đổi / 30 ngày: đừng scale dù đang lãi.</p>}
      {win.ready ? (
        <p className="note">Đủ điều kiện scale. Tăng ngân sách tối đa 30%/ngày, giữ ROAS thực nhận ≥ {fmtNum(roaMin)}.</p>
      ) : (
        win.candidate && (
          <label className="fld">
            <span>Muốn scale khi chưa đủ điều kiện: ghi lý do (bắt buộc)</span>
            <Txt value={link?.scale_override_reason ?? ''} placeholder="Lý do scale sớm" onSave={(v) => save({ scale_override_reason: v })} />
          </label>
        )
      )}
      <p className="note">Trạng thái test (Đang Testing, Đã Test, Lãi, Lỗ…) và đánh dấu thắng sửa ở Research. OKR chỉ lưu lý do mở rộng, checklist scale và lý do scale sớm.</p>
    </div>
  )
}
