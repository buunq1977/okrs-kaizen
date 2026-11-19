import { Fragment, useMemo } from 'react'
import {
  analyze, ceilCount, coeffsOf, dayLabel, winsLabel, monthOf, monthsOfLevel, nextBudget, PHYS_FIELDS, planRows, quarterNo, SAAS_FIELDS, TOOLS_FIELDS, targetsFor,
  defaultProfit, gateOf, paceTargets, GOAL_LEVEL_NAMES, goalLevelReached, rebalanceShares, type ShareKey, kickoffBudget, profitAfterFees, rowEditable, sampleNeeds, selfFundProfit, suggestDouble, v2Of,
  type AffConfig, type AffMonth, type Live, type SimMonth, type Targets,
} from '../../lib/affiliate'
import { totals, type AffEntry, type AffProject } from '../../lib/affProjects'
import { MODEL3, monthlyMoney, wsCounts } from '../../lib/affSource'
import { useApp, useRows } from '../../lib/ctx'
import { listAll } from '../../lib/db'
import { addDays, addMonths, monthEnd, mondayOf, today } from '../../lib/dates'
import { fmtNum } from '../../lib/pace'
import { Sec, Txt, toNum } from '../ui'
import { useAff, useLedger } from './useAff'

const usd = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : (n < 0 ? '−$' : '$') + fmtNum(Math.round(Math.abs(n))))
const cnt = (n: number) => fmtNum(ceilCount(n))
const mLabel = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`

/** Mô hình thu nhập Affiliate Global: Vật lý + SaaS, phân bổ theo tháng, chỉ tiêu Năm → Ngày. */
export default function AffiliatePlan() {
  const { go } = useApp()
  const aff = useAff()
  const ents = useRows<AffEntry>('aff_entries', 'all', () => listAll<AffEntry>('aff_entries', 'date'))
  const ps = useRows<AffProject>('aff_projects', 'all', () => listAll<AffProject>('aff_projects'))
  const led = useLedger(ps)
  const t0 = today()
  const cur = monthOf(t0)
  const { cfg, months, anyLocked, live } = aff
  const maxTest = live.max_test_usd
  const a = useMemo(() => (cfg ? analyze(months, cfg, t0, { max_test_usd: maxTest }) : null), [cfg, months, t0, maxTest])

  if (aff.err) return <p className="flag">{aff.err}</p>
  if (!cfg || !a) return <p className="note">Đang tải…</p>

  const v2 = v2Of(cfg)
  const curRow = months.find((m) => m.month === cur)
  const nextRow = months.find((m) => m.month === addMonths(cur, 1))
  // Lợi nhuận đã nhận tháng này: Ads-Hub nếu đọc được, không thì Sổ nhập tay cũ
  const ahD = led.ah?.data ?? null
  const wsD = led.ws?.data ?? null
  const money = ahD ? monthlyMoney(ahD) : []
  const tm = ahD ? (money.find((x) => x.month === cur) ?? { month: cur, cost: 0, received: 0 }) : totals(ents.rows, cur, monthEnd(cur))
  const recvGross = tm.received - tm.cost
  const recv = profitAfterFees(tm, cfg)
  const extraNext = nextRow?.extra_capital ?? 0
  const missing = planRows(cfg, t0).filter((r) => !months.some((m) => m.month === r.month))
  const reached = goalLevelReached(a.goalNet, v2.goal_levels)
  const goalOk = reached >= 0 // kế hoạch tính theo mức tối thiểu (cam kết)
  const mult = Math.max(1, a.xNeed ?? 1)
  const goalYear = cfg.goal_month.slice(0, 4)
  const g = a.goal
  const mc = a.maxCapital
  // GĐ4: cổng bằng chứng, nhịp khối lượng, khoá SaaS / Tools AI
  const ready = led.items.filter((x) => x.win.ready).length
  const gate = gateOf(ready, money, cfg)
  const testCost = maxTest ?? coeffsOf({ coeffs: null }, cfg).phys.test_cost
  const kick = kickoffBudget(v2.kickoff_tests_month, testCost, cfg)
  const baseTests = Math.floor(cfg.base_budget / testCost)
  const prevM = addMonths(cur, -1)
  const prevTests = wsD ? wsCounts(wsD, prevM, monthEnd(prevM)).test : null
  const totalTests = led.items.filter((x) => x.r.first_test).length
  const resolved = led.appr ? MODEL3.reduce((s, m) => s + led.appr![m].resolved, 0) : 0
  const openRows = months.filter((m) => !m.locked_at && rowEditable(m, t0, cfg.edit_days, anyLocked))
  const subRows = openRows.filter((m) => m.share_phys < 100)
  const lowBudget = openRows.filter((m) => m.budget_test < kick.spend - 0.5)

  // Cổng 0 (có số Research): chỉ tiêu test theo nhịp khối lượng, giống KR / KA ở các trang OKR
  const usePace = !!wsD && gate.gate === 0
  const P = (t: Targets, level: 'year' | 'quarter' | 'month' | 'week' | 'day', n: number) => (usePace ? paceTargets(t, level, n, v2.kickoff_tests_month, testCost, cfg) : t)
  const weekT = P(targetsFor([cur], a, months, cfg, 'week'), 'week', 1)
  const cols: { label: string; t: Targets; day?: boolean }[] = [
    { label: `Năm ${goalYear}`, t: P(targetsFor(monthsOfLevel('year', cfg.goal_month), a, months, cfg, 'year'), 'year', 12) },
    { label: `Quý ${quarterNo(cur)}/${cur.slice(0, 4)}`, t: P(targetsFor(monthsOfLevel('quarter', cur), a, months, cfg, 'quarter'), 'quarter', 3) },
    { label: `Tháng ${mLabel(cur)}`, t: P(targetsFor([cur], a, months, cfg, 'month'), 'month', 1) },
    { label: `Tuần ${mondayOf(t0).slice(8, 10)}/${mondayOf(t0).slice(5, 7)}–${addDays(mondayOf(t0), 6).slice(8, 10)}/${addDays(mondayOf(t0), 6).slice(5, 7)}`, t: weekT },
    { label: `Ngày (${cfg.working_days_week} ngày/tuần)`, t: P(targetsFor([cur], a, months, cfg, 'day'), 'day', 1), day: true },
  ]
  const pair = ([lo, hi]: [number, number], f: (n: number) => string = cnt) => (f(lo) === f(hi) ? f(lo) : `${f(lo)} / ${f(hi)}`)
  /** Số dự án: số nguyên làm tròn lên; cột Ngày chia từ chỉ tiêu tuần. */
  const count = (c: { t: Targets; day?: boolean }, k: 'research' | 'reg' | 'tests') => (c.day ? pair(weekT[k], (n) => dayLabel(n, cfg.working_days_week)) : pair(c.t[k]))

  return (
    <div className="stack">
      <div className={'band ' + (goalOk ? 'green' : 'red')}>
        <div className="band-t">
          <small>O năm · lợi nhuận ròng sau ads, phí, thuế · vào tháng {mLabel(cfg.goal_month)}</small>
          <b>
            {GOAL_LEVEL_NAMES.map((n, i) => `${n} ${usd(v2.goal_levels[i])}`).join(' · ')}
          </b>
        </div>
        <div className="band-p">
          <small>Dự kiến theo kế hoạch</small>
          <b>{usd(a.goalNet)}</b>
          <span>{reached < 0 ? 'Chưa đạt mức tối thiểu: xem gợi ý ngân sách bên dưới' : `Đạt mức ${GOAL_LEVEL_NAMES[reached].toLowerCase()}`}</span>
        </div>
      </div>
      <p className="note">
        Kịch bản theo số test ra 1 thắng (nguồn nói "&gt;100" là mức sàn):{' '}
        {a.scenarios.map((s, i) => (
          <span key={s.tpw}>
            {i > 0 && ' · '}
            {s.tpw} test → <b>{usd(s.goalNet)}</b>
          </span>
        ))}
        . <span className="flag">Độ tin cậy thấp</span> cho tới khi đo được ≥ 3 thắng thật.
        {g && (
          <>
            {' '}
            Tháng {mLabel(cfg.goal_month)}: lợi nhuận trước phí {usd(g.gross)} − phí Invoice {usd(g.fee)} − thuế {usd(g.tax)} (trên tiền nạp Ads) − chi phí cố định {usd(g.fixed)} = {usd(g.net)}. Trong đó SaaS + Tools AI {usd(g.profitS + g.profitT)} (chưa chắc).
          </>
        )}
      </p>

      <Sec title={`Anh đang ở Cổng ${gate.gate}`} hint="Cổng tính từ số thật (Research + Ads-Hub), không nhập tay">
        <ul className="alerts">
          <li className={gate.gate === 0 ? 'yellow' : 'green'}>
            {
              [
                'Cổng 0 · Tìm winner đầu tiên: mục tiêu là khối lượng test, chưa phải lợi nhuận. Ngân sách scale khoá.',
                'Cổng 1 · Đã có dự án đủ điều kiện scale: mở ngân sách scale cho dự án đó.',
                `Cổng 2 · Đã có tháng lợi nhuận đã nhận sau phí ≥ ${usd(v2.gate1_profit)}: ${gate.saasOpen ? 'mở SaaS + Tools AI' : 'SaaS + Tools AI mở từ cổng ' + v2.saas_unlock_gate}.`,
                `Cổng 3 · Đã có tháng ≥ ${usd(v2.gate2_profit)}: đủ điều kiện cân nhắc team hoặc AI (viết SOP và thử 1 kèm 1 trước khi giao).`,
              ][gate.gate]
            }
          </li>
          {gate.next && (
            <li>
              Mốc tiếp theo: <b>{gate.next.label}</b> · {gate.next.missing}.
              {gate.best && ` Tháng tốt nhất đến nay: ${mLabel(gate.best.month)} lãi ${usd(gate.best.net)} sau phí, thuế.`}
            </li>
          )}
          {(!wsD || !ahD) && <li className="yellow">🟡 Chưa đọc đủ Research và Ads-Hub: cổng đang tính thiếu dữ liệu. Đăng nhập ở Cài đặt → Kết nối nguồn số.</li>}
          {gate.gate === 0 && (
            <>
              <li>
                Nhịp tìm winner: <b>{v2.kickoff_tests_month} test/tháng</b> ≈ {usd(kick.spend)} chi tiêu (phải nạp {usd(kick.topup)} gồm phí, thuế) với tiền test {usd(testCost)}. Ngân sách tối thiểu {usd(cfg.base_budget)} chỉ đủ ~{baseTests} test.
                {lowBudget.length > 0 && (
                  <>
                    {' '}
                    <button className="btn mini" onClick={() => lowBudget.forEach((m) => aff.patchMonth(m.id, { budget_test: Math.round(kick.spend) }))}>
                      Đặt ngân sách {usd(kick.spend)} cho {lowBudget.length} tháng đang mở
                    </button>
                  </>
                )}
              </li>
              {prevTests !== null && (
                <li className={suggestDouble(prevTests, v2.kickoff_tests_month) ? 'green' : ''}>
                  Tháng {mLabel(prevM)} lên camp {prevTests} test.
                  {suggestDouble(prevTests, v2.kickoff_tests_month)
                    ? ` Đạt nhịp: có thể tăng gấp đôi lên ${v2.kickoff_tests_month * 2} test/tháng (anh quyết, sửa ở Cài đặt).`
                    : ` Chưa đạt nhịp ${v2.kickoff_tests_month}: giữ nhịp, chưa tăng.`}
                </li>
              )}
            </>
          )}
        </ul>
        {gate.gate === 0 && (
          <div className="tbl">
            <table className="ktable">
              <thead>
                <tr>
                  <th>Muốn đo được</th>
                  <th>Cần tối thiểu</th>
                  <th style={{ textAlign: 'right' }}>Đang có</th>
                </tr>
              </thead>
              <tbody>
                {sampleNeeds(coeffsOf({ coeffs: null }, cfg).phys.tests_per_win, testCost).map((s) => {
                  const have = s.key === 'test_cost' ? totalTests : s.key === 'approval' ? resolved : ready
                  return (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      <td>{s.note}</td>
                      <td className={'n ' + (have >= s.need ? '' : 'neg')}>
                        {have} / {s.need} {s.unit}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Sec>

      <Sec title="Nguồn lực & cảnh báo" hint="Tính lại mỗi khi sửa bảng phân bổ">
        <ul className="alerts">
          {maxTest == null && <li className="yellow">🟡 Chưa đọc được maxtest ở Research: tiền test đang dùng số lưu ở OKR. Đăng nhập Research ở Cài đặt → Kết nối nguồn số.</li>}
          {(a.physLoss || a.saasLoss || a.toolsLoss) && (
            <li className="red">
              🔴 Mô hình lỗ: {a.physLoss && 'Vật lý (tiền tìm 1 thắng ≥ lợi nhuận trọn đời của thắng)'} {a.toolsLoss && 'Tools AI'} {a.saasLoss && 'SaaS (LTV ≤ CAC hoặc tiền tìm thắng ≥ lợi nhuận thắng mang lại)'}. Không chốt kế hoạch tháng cho tới khi sửa hệ số hoặc chiến lược.
            </li>
          )}
          {a.seasonWarn && (
            <li className="yellow">🟡 Tháng 11, 12, 1 phía trước vẫn để hệ số mùa vụ = 1. Số đo trong mùa cao điểm có thể cao hơn thực tế tháng 2–3: anh nên đặt hệ số mùa vụ ở bảng phân bổ.</li>
          )}
          {a.scaleFrom > cur && (
            <li>
              Giai đoạn tìm winner đến hết {mLabel(addMonths(a.scaleFrom, -1))} (lợi nhuận mục tiêu = 0): mục tiêu là khối lượng test để có winner đầu tiên. Ngân sách nhỏ chưa đủ mẫu để đo tỷ lệ thắng (xem bảng cỡ mẫu ở thẻ Cổng).
            </li>
          )}
          {a.xNeed !== null && a.xNeed > 1.01 ? (
            <li className="yellow">
              🟡 Từ tháng {mLabel(a.scaleFrom)} cần ngân sách test tối thiểu <b>{usd(a.suggestBudget)}/tháng</b> (×{fmtNum(Math.round(a.xNeed * 10) / 10)} so với bảng phân bổ) để đạt các mục tiêu tháng còn kịp. Giữ ngân sách hiện tại vẫn chốt được, nhưng KR test lấy theo số ngân sách cho phép và mục tiêu các tháng {a.short.map(mLabel).join(', ')} có rủi ro.
            </li>
          ) : (
            a.xNeed !== null && <li className="green">🟢 Ngân sách test đủ cho các mục tiêu tháng còn kịp.</li>
          )}
          {a.late.length > 0 && (
            <li className="yellow">🟡 Không kịp vì độ trễ (thắng tìm được phải sang tháng sau mới ra tiền, SaaS sau vài tháng), nên đặt lại LN mục tiêu hoặc tăng ngân sách tháng trước đó: {a.late.map(mLabel).join(', ')}.</li>
          )}
          {a.overCapacity.length > 0 && (
            <li className="yellow">
              🟡 Từ tháng {mLabel(a.overCapacity[0].month)} cần ~{cnt(a.overCapacity[0].perWeek)} test/tuần, vượt công suất {cfg.cap_tests_week}/tuần. Thứ tự xử lý: (1) giảm khối lượng hoặc lùi mốc; (2) viết SOP từng bước và thử kèm 1 người trước khi giao; (3) mới tính tới team; (4) AI chỉ khi đã qua Cổng 3 (lãi ≥ {usd(v2.gate2_profit)}/tháng){gate.gate >= 3 ? ', anh đã qua Cổng 3' : ''}.
            </li>
          )}
          {mc && (
            <li>
              Vốn cần cao nhất: <b>{usd(mc.capital)}</b> (tháng {mLabel(mc.month)}) = vận hành {usd(mc.capitalOps)} (tiền test + ads chờ hoa hồng về: Vật lý {cfgDays(cfg, 'phys')} ngày, SaaS {cfgDays(cfg, 'saas')} ngày) + quỹ cầu nối {usd(mc.bridge)} ({v2.bridge_pct}%) + dự phòng {usd(mc.reserve)} ({v2.reserve_pct}%).
            </li>
          )}
          {a.capitalShort.length > 0 && (
            <li className="yellow">
              🟡 Vốn khả dụng (ngân sách tối thiểu {usd(cfg.base_budget)} + vốn ngoài) thấp hơn vốn cần ở {a.capitalShort.length} tháng, sớm nhất {mLabel(a.capitalShort[0].month)}: thiếu{' '}
              {usd(a.capitalShort[0].need - a.capitalShort[0].avail)}. Nhập vốn ngoài theo tháng ở bảng phân bổ, hoặc giảm khối lượng / lùi mốc.
            </li>
          )}
          <li>
            Ngân sách test tháng sau đề xuất: <b>{usd(nextBudget(cfg.base_budget, cfg.reinvest_pct, recv.net, extraNext))}</b> = {usd(cfg.base_budget)} + {cfg.reinvest_pct}% lợi nhuận đã nhận tháng này sau phí ({usd(recv.net)} = {usd(recvGross)} − phí {usd(recv.fee)} − cố định {usd(recv.fixed)} − thuế {usd(recv.tax)})
            {extraNext > 0 && ` + vốn ngoài ${usd(extraNext)}`}. Số lấy từ {ahD ? "Ads-Hub (hoa hồng đã duyệt + đã trả)" : "Sổ dự án nhập tay"}.
            {a.suggestBudget !== null && a.suggestBudget > cfg.base_budget && (
              <>
                {' '}
                Muốn ngân sách test tự nuôi tới {usd(a.suggestBudget)}/tháng mà không cần vốn ngoài, cần lợi nhuận đã nhận sau phí {usd(selfFundProfit(a.suggestBudget, cfg.base_budget, cfg.reinvest_pct))}/tháng.
              </>
            )}
          </li>
          {!gate.scaleOpen && <li>Ngân sách scale: <b>khoá</b> (Cổng 0, chưa có dự án đủ điều kiện scale ở Sổ dự án).</li>}
          <li>
            Ngân sách scale chỉ cho dự án đạt ROAS <b>thực nhận</b> ≥ {fmtNum(aff.th?.roa?.[0] ?? coeffsOf(curRow ?? { coeffs: null }, cfg).phys.roas)} (thực nhận ÷ chi phí, không phải doanh số màn hình). Mở rộng test 1 dự án tối đa ×{cfg.test_cap_mult} maxtest, phải ghi lý do (ở Sổ dự án).
          </li>
        </ul>
      </Sec>

      <Sec title="Chỉ tiêu Năm → Ngày" hint="tối thiểu (theo ngân sách) / mục tiêu (đủ đạt lợi nhuận)">
        <div className="tbl">
          <table className="ktable aff-t aff-tt">
            <thead>
              <tr>
                <th />
                {cols.map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Search dự án <small className="sub">tham khảo · phễu minh hoạ ×{cfg.research_per_test}</small>
                </td>
                {cols.map((c) => (
                  <td key={c.label} className="n">{count(c, 'research')}</td>
                ))}
              </tr>
              <tr>
                <td>
                  Đăng ký <small className="sub">tham khảo · phễu minh hoạ ×{cfg.reg_per_test}</small>
                </td>
                {cols.map((c) => (
                  <td key={c.label} className="n">{count(c, 'reg')}</td>
                ))}
              </tr>
              <tr>
                <td>Test (chạy camp)</td>
                {cols.map((c) => (
                  <td key={c.label} className="n">
                    {count(c, 'tests')}
                    {!c.day && (
                      <small className="sub">
                        VL {cnt(c.t.testsP)} · Tools {cnt(c.t.testsT)} · SaaS {cnt(c.t.testsS)}
                      </small>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Thắng</td>
                {cols.map((c) => (
                  <td key={c.label} className="n">{c.t.wins ? pair(c.t.wins, winsLabel) : <span className="note">không đặt</span>}</td>
                ))}
              </tr>
              <tr>
                <td>Ngân sách test</td>
                {cols.map((c) => (
                  <td key={c.label} className="n">{pair(c.t.budget, usd)}</td>
                ))}
              </tr>
              <tr>
                <td>LN mục tiêu tháng cuối kỳ</td>
                {cols.map((c) => (
                  <td key={c.label} className="n">{c.t.profit === null ? '' : usd(c.t.profit)}</td>
                ))}
              </tr>
              <tr>
                <td>LN dự kiến tháng cuối kỳ</td>
                {cols.map((c) => (
                  <td key={c.label} className={'n ' + (c.t.net !== null && c.t.profit !== null && c.t.net < c.t.profit ? 'neg' : '')}>
                    {c.t.net === null ? '' : usd(c.t.net)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">
          {usePace && (
            <b>
              Cổng 0: chỉ tiêu test theo nhịp {v2.kickoff_tests_month} test/tháng (giống KR ở các trang OKR), ngân sách = test × {usd(testCost)}; năm tính nếu giữ nhịp cả 12 tháng.{' '}
            </b>
          )}
          Số "mục tiêu" = số tối thiểu × {fmtNum(Math.round(mult * 10) / 10)} từ tháng {mLabel(a.scaleFrom)} (ngân sách đủ đạt mọi mục tiêu tháng còn kịp); giai đoạn đo giữ nguyên. Thắng chỉ đặt từ cấp Tháng trở lên. Search = {cfg.research_per_test} × test, đăng ký = {cfg.reg_per_test} × test (phễu minh hoạ của nguồn). Số dự án làm tròn lên; cột Ngày chia từ chỉ tiêu tuần (VD "1 · 4 ngày/tuần" = 4 ngày trong tuần, mỗi ngày 1).
        </p>
      </Sec>

      <Sec title="Bảng phân bổ theo tháng" hint={`Sửa được: tháng tới, hoặc ${cfg.edit_days} ngày đầu của tháng đang chạy`}>
        {months.length > 0 && (
          <div className={'pace-box ' + (!gate.saasOpen && subRows.length ? 'red' : '')}>
            <b>
              Tỷ trọng theo cổng: Cổng {gate.gate} · SaaS + Tools AI {gate.saasOpen ? 'đã mở' : `khoá tới Cổng ${v2.saas_unlock_gate}`}
            </b>
            {!gate.saasOpen && subRows.length > 0 ? (
              <>
                <span>
                  {subRows.length} tháng đang mở vẫn chia ngân sách cho SaaS / Tools AI. Ví dụ {mLabel(subRows[0].month)}: {100 - subRows[0].share_phys}% × {usd(subRows[0].budget_test)} ≈{' '}
                  {Math.floor((((100 - subRows[0].share_phys) / 100) * subRows[0].budget_test) / testCost)} test/tháng: quá ít để đo, lại kéo chậm Vật lý.
                </span>
                <div className="addrow">
                  <button className="btn primary" onClick={() => subRows.forEach((m) => aff.patchMonth(m.id, { share_phys: 100, share_tools: 0 }))}>
                    Đưa {subRows.length} tháng về 100% Vật lý
                  </button>
                </div>
              </>
            ) : !gate.saasOpen ? (
              <span>Các tháng đang mở đều 100% Vật lý, đúng theo cổng. App không tự đổi tỷ trọng; khi qua Cổng {v2.saas_unlock_gate} sẽ gợi ý ở đây.</span>
            ) : (
              <span>
                Đã qua Cổng {v2.saas_unlock_gate}: có thể chia ngân sách test cho SaaS / Tools AI ở cột % bên dưới. Nên bắt đầu đủ lớn để có số đo (ví dụ 30–40% ngân sách, tức ≈{' '}
                {Math.floor((0.3 * (openRows[0]?.budget_test ?? cfg.base_budget)) / testCost)}–{Math.floor((0.4 * (openRows[0]?.budget_test ?? cfg.base_budget)) / testCost)} test/tháng), giữ Vật lý làm chính. Anh quyết tỷ lệ.
              </span>
            )}
          </div>
        )}
        {!months.length ? (
          <div className="addrow">
            <button className="btn primary" onClick={() => aff.addMonths(planRows(cfg, t0))}>
              Tạo kế hoạch từ tháng {mLabel(cur)} đến {mLabel(cfg.goal_month)}
            </button>
            <p className="note">Mặc định: 100% Vật lý (SaaS, Tools AI mở theo cổng), lợi nhuận mục tiêu 0 = theo cổng bằng chứng. Muốn thang theo lịch quý thì bấm "Điền thang lợi nhuận" sau khi tạo, hoặc gõ tay. Sửa được sau khi tạo.</p>
          </div>
        ) : (
          <>
            <div className="tbl">
              <table className="ktable aff-m">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>% Vật lý</th>
                    <th>% Tools AI</th>
                    <th>% SaaS</th>
                    <th>Ngân sách test</th>
                    <th>Vốn ngoài</th>
                    <th>Mùa vụ VL</th>
                    <th>LN mục tiêu</th>
                    <th>Test VL / Tools / SaaS</th>
                    <th>Thắng mới</th>
                    <th>LN dự kiến (sau phí, thuế)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => {
                    const sm = a.sim.find((x) => x.month === m.month)
                    const ed = rowEditable(m, t0, cfg.edit_days, anyLocked)
                    const q = quarterNo(m.month)
                    const newQ = i === 0 || quarterNo(months[i - 1].month) !== q || months[i - 1].month.slice(0, 4) !== m.month.slice(0, 4)
                    return (
                      <Fragment key={m.id}>
                        {newQ && (
                          <tr className="qsep">
                            <td colSpan={13}>
                              Quý {q}/{m.month.slice(0, 4)}
                            </td>
                          </tr>
                        )}
                        <MonthRow m={m} cur={cur} ed={ed} sm={sm} patch={(p) => aff.patchMonth(m.id, p)} />
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="addrow">
              <button className="add" onClick={() => openRows.forEach((m) => aff.patchMonth(m.id, { profit_target: defaultProfit(m.month, cfg.year_goal, cfg.goal_month) }))}>
                Điền thang lợi nhuận theo lịch quý (đề xuất wiki, tuỳ chọn)
              </button>
              {curRow && !curRow.locked_at && (
                <button className="btn primary" disabled={a.physLoss || a.saasLoss || a.toolsLoss} onClick={() => aff.lockMonth(curRow)}>
                  Chốt kế hoạch tháng {mLabel(cur)}
                </button>
              )}
              {missing.length > 0 && (
                <button className="add" onClick={() => aff.addMonths(missing)}>
                  + Bổ sung {missing.length} tháng còn thiếu đến {mLabel(cfg.goal_month)}
                </button>
              )}
              {months.length > 0 && months[months.length - 1].month >= cfg.goal_month && (
                <button className="add" onClick={() => aff.addMonths(planRows({ ...cfg, goal_month: addMonths(months[months.length - 1].month, 3) }, addMonths(months[months.length - 1].month, 1)))}>
                  + Thêm 3 tháng
                </button>
              )}
            </div>
            <p className="note">
              Tỷ trọng = phần ngân sách test và công sức dồn cho từng mô hình; % SaaS = 100 − Vật lý − Tools AI. App tự tính mỗi mô hình đóng góp lợi nhuận vào tháng nào: SaaS và Tools AI trả CAC khi có khách, hoa hồng về sau{' '}
              {coeffsOf(curRow ?? { coeffs: null }, cfg).saas.lag_months} tháng. Chốt tháng thì lưu bản chụp hệ số, phí, thuế và ngưỡng của Research; quá {cfg.edit_days} ngày đầu tháng mà chưa chốt, app tự chốt.
            </p>
          </>
        )}
      </Sec>

      <Sec title={`Hệ số đang dùng tháng ${mLabel(cur)}`} hint={curRow?.locked_at ? 'Bản chụp lúc chốt' : 'Mặc định hiện tại'}>
        <Coeffs m={curRow} cfg={cfg} live={live} />
        <button className="btn" onClick={() => go('settings')}>
          Sửa hệ số mặc định trong Cài đặt
        </button>
      </Sec>
    </div>
  )

}

function Coeffs({ m, cfg, live }: { m: AffMonth | undefined; cfg: AffConfig; live: Live }) {
  const c = coeffsOf(m ?? { coeffs: null }, cfg, live)
  return (
    <div className="grid3 coef3">
      {(
        [
          ['Vật lý', PHYS_FIELDS, c.phys],
          ['Tools AI', TOOLS_FIELDS, c.tools],
          ['SaaS', SAAS_FIELDS, c.saas],
        ] as const
      ).map(([name, fields, vals]) => (
        <div key={name}>
          <b>{name}</b>
          <table className="ktable">
            <tbody>
              {fields.map((f) => (
                <tr key={f.k}>
                  <td>{f.label}</td>
                  <td className="n">
                    {fmtNum((vals as unknown as Record<string, number>)[f.k])} {f.unit}
                  </td>
                  <td>
                    <span className={'src ' + (f.src === 'giả định' ? 'as' : '')}>{f.src}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

const cfgDays = (cfg: { phys: { payout_days?: number }; saas: { payout_days?: number } }, k: 'phys' | 'saas') => cfg[k].payout_days ?? (k === 'phys' ? 30 : 45)

function MonthRow({ m, cur, ed, sm, patch }: { m: AffMonth; cur: string; ed: boolean; sm: SimMonth | undefined; patch: (p: Partial<AffMonth>) => void }) {
  const tools = m.share_tools ?? 0
  const saas = Math.max(0, Math.round((100 - m.share_phys - tools) * 10) / 10)
  const n = (k: 'budget_test' | 'extra_capital' | 'season' | 'profit_target', min: number, max?: number) => (
    <Txt
      className="num"
      type="number"
      value={String(m[k] ?? 0)}
      disabled={!ed}
      label={k}
      onSave={(v) => {
        const x = toNum(v)
        if (x === null || x < min || (max !== undefined && x > max)) return
        patch({ [k]: x } as Partial<AffMonth>)
      }}
    />
  )
  // 3 cột % luôn cộng = 100: sửa 1 cột thì cột cao nhất trong 2 cột còn lại tự điều chỉnh
  const sh = (key: ShareKey, value: number, label: string) => (
    <Txt
      className="num"
      type="number"
      value={String(value)}
      disabled={!ed}
      label={label}
      onSave={(v) => {
        const x = toNum(v)
        if (x === null || x < 0 || x > 100) return
        patch(rebalanceShares({ phys: m.share_phys, tools }, key, x))
      }}
    />
  )
  const short = sm && m.profit_target > 0 && sm.net < m.profit_target
  return (
    <tr className={m.month === cur ? 'cur' : ''}>
      <td>
        <b>{mLabel(m.month)}</b>
      </td>
      <td>{sh('phys', m.share_phys, '% Vật lý')}</td>
      <td>{sh('tools', tools, '% Tools AI')}</td>
      <td>{sh('saas', saas, '% SaaS')}</td>
      <td>{n('budget_test', 0)}</td>
      <td>{n('extra_capital', 0)}</td>
      <td>{n('season', 0.1, 5)}</td>
      <td>{n('profit_target', 0)}</td>
      <td className="n">{sm ? `${cnt(sm.testsP)} / ${cnt(sm.testsT)} / ${cnt(sm.testsS)}` : '–'}</td>
      <td className="n">{sm ? winsLabel(sm.winsP + sm.winsT + sm.winsS) : '–'}</td>
      <td className={'n ' + (short ? 'neg' : '')}>{sm ? usd(sm.net) : '–'}</td>
      <td className="st">{m.locked_at ? '🔒 Đã chốt' : ed ? 'Đang mở' : 'Khoá'}</td>
    </tr>
  )
}
