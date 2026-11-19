import { Fragment, useState } from 'react'
import { coeffsOf, v2Of } from '../../lib/affiliate'
import type { AffProject } from '../../lib/affProjects'
import { liveOrders, MODEL3, MODEL3_NAME, SCALE_MANUAL, type ScaleManual } from '../../lib/affSource'
import { fmtDM } from '../../lib/dates'
import { fmtNum } from '../../lib/pace'
import { Sec, Txt } from '../ui'
import { needsAction, testing, type Item, type Ledger, type Links } from './useAff'

const usd = (n: number | null) => (n === null || !Number.isFinite(n) ? '–' : '$' + n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const x2 = (n: number | null) => (n === null ? '–' : (Math.round(n * 100) / 100).toLocaleString('vi-VN'))

/** Danh sách việc cần xử lý từ Research + Ads-Hub. Số chi tiết (chi phí, click, đơn từng camp) xem ở Ads-Hub. */
export default function AffLedger({ led, links }: { led: Ledger; links: Links }) {
  const [open, setOpen] = useState<number | null>(null)
  const { ws, ah, items, appr, cfg, th } = led
  if (!cfg || !ws) return <Sec title="Cần xử lý"><p className="note">Đang đọc Research và Ads-Hub…</p></Sec>
  if (!ws.data)
    return (
      <Sec title="Cần xử lý">
        <p className="flag">{ws.error ?? 'Chưa đọc được Research.'} Đăng nhập ở Cài đặt → Kết nối nguồn số.</p>
      </Sec>
    )
  const v2 = v2Of(cfg)
  const co = coeffsOf({ coeffs: null }, cfg, led.live)
  const shown = items.filter(needsAction).sort((a, b) => rank(b) - rank(a) || (b.r.first_test ?? '').localeCompare(a.r.first_test ?? ''))
  const nTesting = items.filter(testing).length
  const lowAppr = appr ? MODEL3.filter((m) => appr[m].pct !== null && appr[m].pct! < v2.approval_warn_pct) : []

  async function save(it: Item, part: Partial<AffProject>) {
    if (it.link) await links.patch(it.link.id, part)
    else await links.add({ name: it.r.name, model: it.r.model ?? 'phys', stage: 'research', ws_reg_id: it.r.reg_id, ...part })
  }

  return (
    <Sec title={`Cần xử lý (${shown.length})`} hint={`${nTesting} dự án đang test ở Research · số chi tiết xem ở Ads-Hub`}>
      {!ah?.data && <p className="flag">{ah?.needSql ? 'Ads-Hub chưa chạy file 12_okr_read.sql.' : (ah?.error ?? 'Chưa đọc được Ads-Hub.')} Đang dùng chi phí, click của lần test ở Research; chưa có đơn hàng.</p>}
      {appr && (
        <p className="note">
          % duyệt hoa hồng (đơn đã quá hạn payout):{' '}
          {MODEL3.map((m, i) => (
            <span key={m} className={appr[m].pct !== null && appr[m].pct! < v2.approval_warn_pct ? 'neg' : ''}>
              {i > 0 && ' · '}
              {MODEL3_NAME[m]} {appr[m].pct === null ? 'chưa đủ dữ liệu' : Math.round(appr[m].pct!) + '%'}
            </span>
          ))}
          {MODEL3.some((m) => appr[m].pending_n > 0) && ` · đang chờ duyệt ${MODEL3.reduce((s, m) => s + appr[m].pending_n, 0)} đơn`}
        </p>
      )}
      {lowAppr.length > 0 && (
        <p className="flag">
          % duyệt dưới {v2.approval_warn_pct}% ({lowAppr.map((m) => MODEL3_NAME[m]).join(', ')}): kiểm lại bộ lọc dự án ở Research: Payout Rate ≥ 70%, Trustpilot có phàn nàn không trả hoa hồng, danh sách loại trừ, 10 câu chính sách.
        </p>
      )}
      {!shown.length ? (
        <p className="note">Không có dự án nào cần xử lý: chưa dự án nào chạm ngưỡng dừng hay đạt ứng viên thắng.</p>
      ) : (
        <div className="tbl">
          <table className="ktable act-t">
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Cờ</th>
                <th>Vì sao</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => (
                <Fragment key={it.r.reg_id}>
                  <tr className={open === it.r.reg_id ? 'open' : ''}>
                    <td>
                      <button className="linkbtn" onClick={() => setOpen(open === it.r.reg_id ? null : it.r.reg_id)}>
                        <b>{it.r.name}</b>
                      </button>
                      <small className="sub">
                        {it.r.model ? MODEL3_NAME[it.r.model] : 'Chưa rõ loại'}
                        {it.r.first_test && ` · test từ ${fmtDM(it.r.first_test)}`}
                      </small>
                    </td>
                    <td>
                      <Flags it={it} />
                    </td>
                    <td>{why(it)}</td>
                  </tr>
                  {open === it.r.reg_id && (
                    <tr className="detail">
                      <td colSpan={3}>
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

/** Một dòng lý do ngắn cho cờ. */
function why(it: Item): string {
  const { r, stop, win } = it
  const base = `${usd(r.cost)} · ${fmtNum(r.clicks)} click`
  if (win.ready) return `${win.conv30} đơn/30 ngày · ROAS thực nhận ${x2(win.roas_real)}`
  if (win.candidate) return `${win.orders} đơn · ROAS dự kiến ${x2(win.roas_expected)} · bấm tên xem checklist scale`
  if (stop.level === 'trial') return `${base} · 0 đơn · còn ${stop.trial_left} ngày dùng thử`
  if (stop.level === 'stop') return `${base} · 0 đơn · chạm trần ${usd(stop.cap)}`
  if (stop.level === 'consider') return `${base} · 0 đơn · đủ ${stop.cps} click/sale`
  return base
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
