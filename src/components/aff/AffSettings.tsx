import { useCallback, useEffect, useState } from 'react'
import { adCharges, coeffsOf, GOAL_LEVEL_NAMES, configEditable, deseason, PHYS_FIELDS, SAAS_FIELDS, TOOLS_FIELDS, v2Of, type AffConfig } from '../../lib/affiliate'
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

/** Cài đặt mô hình Affiliate v2: mục tiêu, ngân sách & vốn, cổng, nhịp, hệ số 3 mô hình. Chỉ sửa ở đầu kỳ.
 *  Tiền test (= maxtest) và Winner ≥ N đơn không nhập ở đây: đọc từ Research / Ads-Hub (một nguồn duy nhất). */
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
  const v2 = v2Of(c)
  const th = aff.th
  const set = <K extends keyof AffConfig>(k: K, v: AffConfig[K]) => setC({ ...c, [k]: v })
  const val = (k: keyof AffConfig) => (c[k] ?? (v2 as Record<string, unknown>)[k as string]) as number
  const num = (k: keyof AffConfig, min: number, max?: number) => (
    <input type="number" min={min} max={max} step="any" disabled={!ed} value={val(k)} onChange={(e) => set(k, Number(e.target.value) as never)} />
  )
  const fld = (label: string, k: keyof AffConfig, min: number, max?: number) => (
    <label className="fld">
      <span>{label}</span>
      {num(k, min, max)}
    </label>
  )
  const levels = v2.goal_levels
  const setLevel = (i: number, x: number) => {
    const next = [...levels]
    next[i] = x
    setC({ ...c, goal_levels: next, year_goal: i === 0 ? x : c.year_goal })
  }
  const live = { max_test_usd: th?.max_test_usd ?? null }
  const co = coeffsOf({ coeffs: null }, c, live)
  const t0 = today()
  const since = addMonths(t0, -3)
  // Số đo từ Sổ dự án: bỏ tiền test (đã lấy theo maxtest); lợi nhuận 1 thắng quy về mùa thường theo mùa vụ các tháng đo
  const seasons = aff.months.filter((m) => m.month >= since.slice(0, 8) + '01' && m.month <= t0).map((m) => Number(m.season))
  const sugg = data
    ? suggestCoeffs(measure(data.projects, data.entries, data.tallies, 'phys', since, t0), measure(data.projects, data.entries, data.tallies, 'saas', since, t0), {
        phys: co.phys,
        saas: co.saas,
        reg_per_test: c.reg_per_test,
        research_per_test: c.research_per_test,
      })
        .filter((x) => !x.key.endsWith('.test_cost'))
        .map((x) => (x.key === 'phys.win_profit' ? { ...x, value: Math.round(deseason(x.value, seasons)) } : x))
    : []
  const LABEL: Record<string, string> = {
    'phys.tests_per_win': 'Vật lý · số test ra 1 thắng',
    'phys.win_profit': 'Vật lý · lợi nhuận 1 thắng / tháng ($, đã quy về mùa thường)',
    'saas.tests_per_win': 'SaaS · số test ra 1 thắng',
    reg_per_test: 'Đăng ký / 1 test',
    research_per_test: 'Search / 1 test',
  }
  const apply = (key: string, v: number) => {
    const [a, b] = key.split('.')
    if (b) setC({ ...c, [a]: { ...(c[a as 'phys' | 'saas'] as object), [b]: v } } as AffConfig)
    else setC({ ...c, [a]: v } as AffConfig)
  }
  const usdN = (n: number | null | undefined) => (n == null ? '—' : '$' + fmtNum(n))

  return (
    <Sec title="Mô hình Affiliate (Vật lý · Tools AI · SaaS)" hint="Chỉ sửa ở đầu kỳ">
      {!ed && <p className="flag">🔒 Đang khoá. Mở lại vào {c.edit_days} ngày đầu tháng tới. Kế hoạch các tháng đã chốt giữ nguyên bản chụp hệ số.</p>}
      {ed && !aff.anyLocked && (
        <p className="note">
          Chưa chốt tháng nào: sửa tự do cho tới khi chốt tháng đầu tiên ở Mô hình thu nhập → Affiliate. Từ đó cài đặt chỉ sửa trong {c.edit_days} ngày đầu tháng.
        </p>
      )}

      <b>Mục tiêu</b>
      <div className="grid3">
        {GOAL_LEVEL_NAMES.map((l, i) => (
          <label className="fld" key={l}>
            <span>O năm · {l} · lợi nhuận ròng ($/tháng){i === 0 ? ' · cam kết, dùng để tính kế hoạch' : ''}</span>
            <input type="number" min={0} disabled={!ed} value={levels[i] ?? 0} onChange={(e) => setLevel(i, Number(e.target.value))} />
          </label>
        ))}
        <label className="fld">
          <span>Đạt vào tháng</span>
          <input type="month" disabled={!ed} value={c.goal_month.slice(0, 7)} onChange={(e) => e.target.value && set('goal_month', e.target.value + '-01')} />
        </label>
      </div>

      <b>Ngân sách, phí và vốn</b>
      <div className="grid3">
        {fld('Ngân sách test tối thiểu ($/tháng)', 'base_budget', 0)}
        {fld('% lợi nhuận đã nhận (sau phí) cộng vào ngân sách tháng sau', 'reinvest_pct', 0, 100)}
        {fld('Trần mở rộng test 1 dự án (× maxtest, phải ghi lý do)', 'test_cap_mult', 1, 10)}
        {fld('Phí tài khoản Invoice (% chi phí nạp Ads)', 'fee_pct', 0, 100)}
        {fld('Thuế (% trên chi phí nạp + phí)', 'tax_pct', 0, 100)}
        {fld('Chi phí cố định ($/tháng: công cụ, người…)', 'fixed_cost_month', 0)}
        {fld('Quỹ cầu nối chờ payout (% vốn vận hành)', 'bridge_pct', 0, 100)}
        {fld('Quỹ dự phòng (% vốn vận hành)', 'reserve_pct', 0, 100)}
      </div>
      <p className="note">
        Ví dụ chi tiêu 500.000đ: phí {fmtNum(v2.fee_pct)}% = {fmtNum(Math.round((500000 * v2.fee_pct) / 100))}đ, thuế {fmtNum(v2.tax_pct)}% × (chi tiêu + phí) ={' '}
        {fmtNum(Math.round(adCharges(500000, v2.fee_pct, v2.tax_pct).tax))}đ → tổng phải nạp {fmtNum(Math.round(adCharges(500000, v2.fee_pct, v2.tax_pct).total))}đ (×
        {fmtNum(Math.round(adCharges(1, v2.fee_pct, v2.tax_pct).mult * 1000) / 1000)}). Áp cho mọi tiền nạp Ads: tiền test, ads scale, ads mua khách SaaS/Tools AI.
      </p>

      <b>Cổng bằng chứng và nhịp</b>
      <div className="grid3">
        {fld('Nhịp test / tháng khi chưa có winner', 'kickoff_tests_month', 0)}
        {fld('Cổng 1 → 2: lợi nhuận đã nhận sau phí ($/tháng)', 'gate1_profit', 0)}
        {fld('Cổng 2 → 3: lợi nhuận đã nhận sau phí ($/tháng)', 'gate2_profit', 0)}
        {fld('Mở SaaS + Tools AI từ cổng', 'saas_unlock_gate', 0, 3)}
        {fld('% duyệt hoa hồng dưới mức này thì cảnh báo', 'approval_warn_pct', 0, 100)}
        {fld('Số ngày đầu tháng được sửa kế hoạch', 'edit_days', 1, 10)}
        {fld('Công suất test / tuần (một người)', 'cap_tests_week', 1)}
        {fld('Ngày làm / tuần', 'working_days_week', 1, 7)}
        {fld('Đăng ký / 1 test (phễu minh hoạ)', 'reg_per_test', 0.1)}
        {fld('Search / 1 test (phễu minh hoạ)', 'research_per_test', 0.1)}
        <label className="fld">
          <span>Nhãn "loại vì…" ở bộ đếm search (mỗi dòng 1 nhãn, tối đa 12)</span>
          <textarea rows={4} disabled={!ed} value={(c.reject_labels ?? v2.reject_labels).join('\n')} onChange={(e) => set('reject_labels', e.target.value.split('\n').slice(0, 12))} />
        </label>
      </div>

      <b>Lấy từ app khác (sửa ở app đó)</b>
      <div className="tbl">
        <table className="ktable">
          <tbody>
            <tr>
              <td>Tiền test 1 dự án (cả 3 mô hình) = maxtest</td>
              <td className="n">{th?.max_test_usd != null ? usdN(th.max_test_usd) : `${usdN(co.phys.test_cost)} (đang lưu ở OKR)`}</td>
              <td>{th?.max_test_usd != null ? 'Research · Cài đặt tính toán' : <span className="flag">Chưa đọc được Research: đăng nhập ở tab Kết nối nguồn số</span>}</td>
            </tr>
            <tr>
              <td>Ứng viên thắng khi ≥ N đơn</td>
              <td className="n">{th?.winner_orders ?? `${c.win_min_orders ?? 3} (đang lưu ở OKR)`}</td>
              <td>{th?.winner_orders != null ? 'Ads-Hub · Cài đặt' : <span className="flag">Chưa đọc được Ads-Hub</span>}</td>
            </tr>
            <tr>
              <td>Ngưỡng ROAS thực nhận để là ứng viên thắng (ROA Hòa)</td>
              <td className="n">{th?.roa ? fmtNum(th.roa[0]) : `${fmtNum(co.phys.roas)} (ROAS scale Vật lý)`}</td>
              <td>{th?.roa ? 'Research · Cài đặt tính toán' : <span className="flag">Chưa đọc được Research</span>}</td>
            </tr>
          </tbody>
        </table>
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
                    <td>{LABEL[x.key] ?? x.key}</td>
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

      <div className="stack">
        {(
          [
            ['Hệ số Vật lý', 'phys', PHYS_FIELDS, co.phys],
            ['Hệ số Tools AI', 'tools', TOOLS_FIELDS, co.tools],
            ['Hệ số SaaS', 'saas', SAAS_FIELDS, co.saas],
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
                      {f.derived ? (
                        <span className="n">{fmtNum((vals as unknown as Record<string, number>)[f.k])}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          disabled={!ed}
                          aria-label={`${name} · ${f.label}`}
                          value={(vals as unknown as Record<string, number>)[f.k]}
                          onChange={(e) => set(key, { ...((c[key] ?? {}) as object), [f.k]: Number(e.target.value) } as never)}
                        />
                      )}
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
      <p className="note">
        Nhãn: nguồn = có trong tài liệu khoá học; nguồn (mức sàn) = nguồn nói "hơn …", app chạy thêm kịch bản xấu hơn; tính = suy ra từ số của nguồn; giả định = nguồn không có, thay bằng số thật khi đo được; Research = đọc từ app Research.
      </p>
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
