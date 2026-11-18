import { useCallback, useEffect, useState } from 'react'
import { configEditable, PHYS_FIELDS, physOf, SAAS_FIELDS, saasOf, type AffConfig } from '../../lib/affiliate'
import { loadAffData, loadAh, loadWs, SRC, srcEmail, srcSignIn, srcSignOut, type SrcKey, type SrcResult } from '../../lib/affData'
import { ahTotals, MODEL3, MODEL3_NAME, sharedThresholds, wsCounts, type AhData, type AhTotals, type Model3, type WsData } from '../../lib/affSource'
import { supabase } from '../../lib/supabase'
import { suggestCoeffs } from '../../lib/affDiag'
import type { AffData } from '../../lib/affLink'
import { measure } from '../../lib/affProjects'
import { addMonths, today } from '../../lib/dates'
import { fmtNum } from '../../lib/pace'
import { Sec } from '../ui'
import { useAff } from './useAff'

/** Cài đặt mô hình Affiliate: mục tiêu năm, quy tắc ngân sách, hệ số mặc định. Chỉ sửa ở đầu kỳ. */
export default function AffSettings() {
  const aff = useAff()
  const [c, setC] = useState<AffConfig | null>(null)
  const [data, setData] = useState<AffData | null>(null)
  useEffect(() => {
    if (aff.cfg) setC(aff.cfg)
  }, [aff.cfg])
  useEffect(() => {
    loadAffData().then(setData)
  }, [])
  if (aff.err) return <Sec title="Mô hình Affiliate"><p className="flag">{aff.err}</p></Sec>
  if (!c || !aff.cfg) return null
  const ed = configEditable(today(), c.edit_days, aff.anyLocked)
  const dirty = JSON.stringify(c) !== JSON.stringify(aff.cfg)
  const set = <K extends keyof AffConfig>(k: K, v: AffConfig[K]) => setC({ ...c, [k]: v })
  const num = (k: keyof AffConfig, min: number, max?: number) => (
    <input type="number" min={min} max={max} disabled={!ed} value={c[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} />
  )
  const phys = physOf(c.phys)
  const saas = saasOf(c.saas)
  const t0 = today()
  const since = addMonths(t0, -3)
  const sugg = data
    ? suggestCoeffs(measure(data.projects, data.entries, data.tallies, 'phys', since, t0), measure(data.projects, data.entries, data.tallies, 'saas', since, t0), { phys, saas, reg_per_test: c.reg_per_test, research_per_test: c.research_per_test })
    : []
  const LABEL: Record<string, string> = {
    'phys.test_cost': 'Vật lý · tiền test 1 dự án ($)',
    'phys.tests_per_win': 'Vật lý · số test ra 1 thắng',
    'phys.win_profit': 'Vật lý · lợi nhuận 1 thắng / tháng ($)',
    'saas.test_cost': 'SaaS · tiền test 1 dự án ($)',
    'saas.tests_per_win': 'SaaS · số test ra 1 thắng',
    reg_per_test: 'Đăng ký / 1 test',
    research_per_test: 'Search / 1 test',
  }
  const apply = (key: string, v: number) => {
    const [a, b] = key.split('.')
    if (b) setC({ ...c, [a]: { ...(c[a as 'phys' | 'saas'] as object), [b]: v } } as AffConfig)
    else setC({ ...c, [a]: v } as AffConfig)
  }

  return (
    <Sec title="Mô hình Affiliate (Vật lý + SaaS)" hint="Chỉ sửa ở đầu kỳ">
      {!ed && <p className="flag">🔒 Đang khoá. Mở lại vào {c.edit_days} ngày đầu tháng tới. Kế hoạch các tháng đã chốt giữ nguyên bản chụp hệ số.</p>}
      {ed && !aff.anyLocked && <p className="note">Lần thiết lập đầu: sửa tự do cho tới khi chốt tháng đầu tiên ở Mô hình thu nhập → Affiliate.</p>}
      <div className="grid3">
        <label className="fld">
          <span>O năm: lợi nhuận ròng sau ads ($/tháng)</span>
          {num('year_goal', 0)}
        </label>
        <label className="fld">
          <span>Đạt vào tháng</span>
          <input type="month" disabled={!ed} value={c.goal_month.slice(0, 7)} onChange={(e) => e.target.value && set('goal_month', e.target.value + '-01')} />
        </label>
        <label className="fld">
          <span>Ngân sách test tối thiểu ($/tháng)</span>
          {num('base_budget', 0)}
        </label>
        <label className="fld">
          <span>% lợi nhuận đã nhận cộng vào ngân sách tháng sau</span>
          {num('reinvest_pct', 0, 100)}
        </label>
        <label className="fld">
          <span>Trần mở rộng test 1 dự án (× tiền test)</span>
          {num('test_cap_mult', 1, 10)}
        </label>
        <label className="fld">
          <span>Số ngày đầu tháng được sửa kế hoạch</span>
          {num('edit_days', 1, 10)}
        </label>
        <label className="fld">
          <span>Công suất test / tuần (một người)</span>
          {num('cap_tests_week', 1)}
        </label>
        <label className="fld">
          <span>Ngày làm / tuần</span>
          {num('working_days_week', 1, 7)}
        </label>
        <label className="fld">
          <span>Đăng ký / 1 test</span>
          {num('reg_per_test', 0.1)}
        </label>
        <label className="fld">
          <span>Search / 1 test</span>
          {num('research_per_test', 0.1)}
        </label>
        <label className="fld">
          <span>Gợi ý thắng khi ≥ N đơn và ROAS theo thực nhận dự kiến ≥ ngưỡng scale; N =</span>
          {num('win_min_orders', 1)}
        </label>
      </div>

      {sugg.length > 0 && (
        <div className="aff-q">
          <b>Số đo được từ Sổ dự án (3 tháng gần nhất)</b>
          <div className="tbl">
            <table className="ktable">
              <thead>
                <tr>
                  <th>Hệ số</th>
                  <th>Đang đặt</th>
                  <th>Đo được</th>
                  <th>Mẫu</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sugg.map((x) => (
                  <tr key={x.key}>
                    <td>{LABEL[x.key]}</td>
                    <td className="n">{fmtNum(x.current)}</td>
                    <td className={'n ' + (Math.abs(x.diffPct) >= 30 ? 'neg' : '')}>
                      {fmtNum(x.value)} <small>({x.diffPct > 0 ? '+' : ''}{x.diffPct}%)</small>
                    </td>
                    <td className="n">{x.enough ? `${x.n} · đủ` : `${x.n} · ít`}</td>
                    <td>
                      <button className="btn mini" disabled={!ed || x.value === x.current} onClick={() => apply(x.key, x.value)}>
                        Dùng số đo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            {ed ? 'Đang trong buổi rà đầu kỳ: bấm "Dùng số đo" rồi Lưu. Mẫu "ít" thì cân nhắc, số còn dao động.' : 'Chỉ áp dụng được ở buổi rà đầu kỳ. Các tháng đã chốt giữ bản chụp hệ số cũ.'}
          </p>
        </div>
      )}

      <div className="grid2">
        {(
          [
            ['Hệ số Vật lý', 'phys', PHYS_FIELDS, phys],
            ['Hệ số SaaS', 'saas', SAAS_FIELDS, saas],
          ] as const
        ).map(([name, key, fields, vals]) => (
          <div key={key}>
            <b>{name}</b>
            <table className="ktable coef">
              <tbody>
                {fields.map((f) => (
                  <tr key={f.k}>
                    <td>
                      {f.label}
                      <small className="sub">{f.note}</small>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={!ed}
                        aria-label={f.label}
                        value={(vals as unknown as Record<string, number>)[f.k]}
                        onChange={(e) => set(key, { ...(c[key] as object), [f.k]: Number(e.target.value) } as never)}
                      />
                    </td>
                    <td>
                      {f.unit} <span className={'src ' + (f.src === 'giả định' ? 'as' : '')}>{f.src}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="note">Nhãn: nguồn = có trong tài liệu khoá học; tính = suy ra từ số của nguồn; giả định = nguồn không có, thay bằng số thật của anh khi đo được (Sổ dự án, bước 2).</p>
      <div className="savebar">
        <button className="btn primary" disabled={!dirty || !ed} onClick={() => aff.saveCfg(c)}>
          Lưu mô hình Affiliate
        </button>
        {dirty && <span className="flag">Có thay đổi chưa lưu</span>}
      </div>
    </Sec>
  )
}

/* ---------- Kết nối nguồn số: Research + Ads-Hub (chỉ đọc) ---------- */
const R = { textAlign: 'right' as const }
const usd2 = (n: number) => '$' + n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Đăng nhập Research / Ads-Hub, xem ngưỡng dùng chung và số tháng này đọc được. OKR không ghi gì sang hai app. */
export function AffSources() {
  const t0 = today()
  const from = t0.slice(0, 8) + '01'
  const [email, setEmail] = useState<Record<SrcKey, string | null>>({ ws: null, ah: null })
  const [form, setForm] = useState<{ k: SrcKey; email: string; pw: string } | null>(null)
  const [ws, setWs] = useState<SrcResult<WsData> | null>(null)
  const [ah, setAh] = useState<SrcResult<AhData> | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [readAt, setReadAt] = useState('')

  const read = useCallback(async () => {
    setBusy(true)
    const [ew, ea] = await Promise.all([srcEmail('ws'), srcEmail('ah')])
    setEmail({ ws: ew, ah: ea })
    const [w, a] = await Promise.all([loadWs(), loadAh(from, t0)])
    setWs(w)
    setAh(a)
    setReadAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
    setBusy(false)
  }, [from, t0])
  useEffect(() => {
    read()
  }, [read])

  const openForm = async (k: SrcKey) => {
    const okr = (await supabase?.auth.getSession())?.data.session?.user.email ?? ''
    setMsg('')
    setForm({ k, email: okr, pw: '' })
  }
  const signIn = async () => {
    if (!form) return
    setBusy(true)
    try {
      await srcSignIn(form.k, form.email, form.pw)
      setForm(null)
      await read()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  const signOut = async (k: SrcKey) => {
    await srcSignOut(k)
    await read()
  }

  const th = sharedThresholds(ws?.data ?? null, ah?.data ?? null)
  const statusOf = (k: SrcKey, r: SrcResult<unknown> | null) => {
    if (!SRC[k].client) return <span className="flag">Chưa cấu hình (thiếu biến môi trường của {SRC[k].name})</span>
    if (!email[k]) return <span className="flag">Chưa đăng nhập</span>
    if (r?.error) return <span className="flag">{r.error}</span>
    if (r?.needSql)
      return (
        <span className="flag">
          Đã kết nối {email[k]} · {SRC[k].name} chưa chạy <code>{SRC[k].sql}</code>
        </span>
      )
    return <span>✅ Đã kết nối · {email[k]}</span>
  }
  const COUNT_ROWS = [
    ['Dự án mới vào Research', 'chon'],
    ['Đăng ký', 'dang_ky'],
    ['Được duyệt link', 'duyet'],
    ['Bị từ chối', 'tu_choi'],
    ['Lên camp test', 'test'],
  ] as const
  const MONEY_ROWS: [string, (t: AhTotals) => string][] = [
    ['Chi phí ads', (t) => usd2(t.cost)],
    ['Click', (t) => fmtNum(t.clicks)],
    ['Hoa hồng chờ duyệt', (t) => `${usd2(t.comm.pending)} · ${t.orders.pending} đơn`],
    ['Hoa hồng đã duyệt + đã trả', (t) => `${usd2(t.comm.approved + t.comm.paid)} · ${t.orders.approved + t.orders.paid} đơn`],
    ['Hoa hồng bị huỷ', (t) => `${usd2(t.comm.denied)} · ${t.orders.denied} đơn`],
  ]
  const cols: (Model3 | undefined)[] = [...MODEL3, undefined]

  return (
    <Sec title="Kết nối nguồn số: Research + Ads-Hub" hint="Chỉ đọc">
      <p className="note">
        Research cho số đầu vào (dự án, đăng ký, duyệt link, lên camp test) và ngưỡng dùng chung (tỷ giá, maxtest, ROA, Click/Sale). Ads-Hub cho kết quả (chi phí, click, hoa hồng theo trạng thái). OKR chỉ đọc, không ghi sang hai app. Mỗi app đăng nhập một lần, trình duyệt nhớ phiên.
      </p>
      <div className="tbl">
        <table className="ktable">
          <tbody>
            {(['ws', 'ah'] as SrcKey[]).map((k) => (
              <tr key={k}>
                <td>
                  <b>{SRC[k].name}</b>
                </td>
                <td>{statusOf(k, k === 'ws' ? ws : ah)}</td>
                <td className="n">
                  {SRC[k].client &&
                    (email[k] ? (
                      <button className="btn mini" disabled={busy} onClick={() => signOut(k)}>
                        Đăng xuất
                      </button>
                    ) : (
                      <button className="btn mini" disabled={busy} onClick={() => openForm(k)}>
                        Đăng nhập
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <div className="aff-q">
          <b>Đăng nhập {SRC[form.k].name}</b>
          <div className="grid2">
            <label className="fld">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="fld">
              <span>Mật khẩu {SRC[form.k].name}</span>
              <input type="password" value={form.pw} onChange={(e) => setForm({ ...form, pw: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && signIn()} />
            </label>
          </div>
          <div className="savebar">
            <button className="btn primary" disabled={busy || !form.email || !form.pw} onClick={signIn}>
              Đăng nhập
            </button>
            <button className="btn" onClick={() => setForm(null)}>
              Huỷ
            </button>
            {msg && <span className="flag">{msg}</span>}
          </div>
        </div>
      )}

      <b>Ngưỡng dùng chung đang có hiệu lực</b>
      <div className="tbl">
        <table className="ktable">
          <tbody>
            <tr>
              <td>Tỷ giá USD/VND</td>
              <td className="n">{th.usd_vnd != null ? fmtNum(th.usd_vnd) : '—'}</td>
              <td>Research · Cài đặt tính toán</td>
            </tr>
            <tr>
              <td>maxtest ($ test tối đa 1 dự án)</td>
              <td className="n">{th.max_test_usd != null ? usd2(th.max_test_usd) : '—'}</td>
              <td>Research · Cài đặt tính toán</td>
            </tr>
            <tr>
              <td>ROA Hòa / Lãi / Lãi tốt</td>
              <td className="n">{th.roa ? th.roa.map(fmtNum).join(' / ') : '—'}</td>
              <td>Research · Cài đặt tính toán</td>
            </tr>
            <tr>
              <td>Winner khi ≥ N đơn</td>
              <td className="n">{th.winner_orders ?? '—'}</td>
              <td>Ads-Hub · Cài đặt</td>
            </tr>
          </tbody>
        </table>
      </div>
      {th.click_rules.length > 0 && (
        <div className="tbl">
          <table className="ktable">
            <thead>
              <tr>
                <th>Loại dự án</th>
                <th style={R}>Bậc CPC (đ)</th>
                <th style={R}>Click / Sale: CPC thấp · giữa · cao</th>
              </tr>
            </thead>
            <tbody>
              {th.click_rules.map((r) => (
                <tr key={r.code}>
                  <td>{r.name}</td>
                  <td className="n">
                    {fmtNum(r.tier_low_vnd)} / {fmtNum(r.tier_high_vnd)}
                  </td>
                  <td className="n">
                    {r.clicks_low} · {r.clicks_mid} · {r.clicks_high}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(ws?.data || ah?.data) && (
        <>
          <b>
            Đọc thử tháng {from.slice(5, 7)}/{from.slice(0, 4)} (từ ngày 1 đến hôm nay)
          </b>
          <div className="tbl">
            <table className="ktable">
              <thead>
                <tr>
                  <th />
                  {MODEL3.map((m) => (
                    <th key={m} style={R}>
                      {MODEL3_NAME[m]}
                    </th>
                  ))}
                  <th style={R}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {ws?.data &&
                  COUNT_ROWS.map(([label, key]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      {cols.map((m) => {
                        const v = wsCounts(ws.data!, from, t0, m)[key]
                        return (
                          <td key={m ?? 'all'} className="n">
                            {v === null ? '—' : v}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                {ah?.data &&
                  MONEY_ROWS.map(([label, f]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      {cols.map((m) => (
                        <td key={m ?? 'all'} className="n">
                          {f(ahTotals(ah.data!, ws?.data ?? null, from, t0, m))}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {ws?.data && !ws.data.hasDates && (
            <p className="flag">
              Research chưa có ngày đăng ký / duyệt link / từ chối: chạy <code>{SRC.ws.sql}</code> trong Supabase của Research.
            </p>
          )}
          {ah?.data && <AhWarn t={ahTotals(ah.data, ws?.data ?? null, from, t0)} hasWs={!!ws?.data} />}
        </>
      )}
      <div className="savebar">
        <button className="btn" disabled={busy} onClick={read}>
          {busy ? 'Đang đọc…' : 'Đọc lại'}
        </button>
        {readAt && <span className="note">Đọc lúc {readAt}</span>}
      </div>
    </Sec>
  )
}

function AhWarn({ t, hasWs }: { t: AhTotals; hasWs: boolean }) {
  const out: string[] = []
  if (t.unmatchedOrders > 0) out.push(`${t.unmatchedOrders} đơn (${usd2(t.unmatchedComm)}) chưa ghép được camp ở Ads-Hub: chỉ tính vào Tổng, không vào mô hình nào.`)
  if (hasWs && t.unknownCampCost > 0) out.push(`${usd2(t.unknownCampCost)} chi phí của camp chưa ghép được dự án ở Research (link affiliate chưa khớp đăng ký nào): chỉ tính vào Tổng.`)
  if (!hasWs) out.push('Chưa đọc được Research nên chưa tách được theo mô hình: chỉ cột Tổng có số.')
  if (t.noRateCost > 0) out.push(`${t.noRateCost} dòng chi phí chưa quy ra USD (Ads-Hub thiếu tỷ giá của tài khoản).`)
  if (!out.length) return null
  return (
    <>
      {out.map((s) => (
        <p key={s} className="flag">
          {s}
        </p>
      ))}
    </>
  )
}
