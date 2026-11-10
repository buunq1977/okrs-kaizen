import { Fragment, useMemo } from 'react'
import {
  analyze, ceilCount, coeffsOf, dayLabel, winsLabel, monthEditable, monthOf, monthsOfLevel, nextBudget, PHYS_FIELDS, planRows, quarterNo, SAAS_FIELDS, targetsFor,
  type AffConfig, type AffMonth, type Targets,
} from '../../lib/affiliate'
import { receivedProfit, type AffEntry } from '../../lib/affProjects'
import { useApp, useRows } from '../../lib/ctx'
import { listAll } from '../../lib/db'
import { addDays, addMonths, monthEnd, mondayOf, today } from '../../lib/dates'
import { fmtNum } from '../../lib/pace'
import { Sec, Txt, toNum } from '../ui'
import { useAff } from './useAff'

const usd = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : (n < 0 ? '−$' : '$') + fmtNum(Math.round(Math.abs(n))))
const cnt = (n: number) => fmtNum(ceilCount(n))
const mLabel = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`

/** Mô hình thu nhập Affiliate Global: Vật lý + SaaS, phân bổ theo tháng, chỉ tiêu Năm → Ngày. */
export default function AffiliatePlan() {
  const { go } = useApp()
  const aff = useAff()
  const ents = useRows<AffEntry>('aff_entries', 'all', () => listAll<AffEntry>('aff_entries', 'date'))
  const t0 = today()
  const cur = monthOf(t0)
  const { cfg, months, anyLocked } = aff
  const a = useMemo(() => (cfg ? analyze(months, cfg, t0) : null), [cfg, months, t0])

  if (aff.err) return <p className="flag">{aff.err}</p>
  if (!cfg || !a) return <p className="note">Đang tải…</p>

  const curRow = months.find((m) => m.month === cur)
  const recv = receivedProfit(ents.rows, cur, monthEnd(cur))
  const missing = planRows(cfg, t0).filter((r) => !months.some((m) => m.month === r.month))
  const goalOk = a.goalNet !== null && a.goalNet >= cfg.year_goal
  const mult = Math.max(1, a.xNeed ?? 1)
  const goalYear = cfg.goal_month.slice(0, 4)

  const weekT = targetsFor([cur], a, months, cfg, 'week')
  const cols: { label: string; t: Targets; day?: boolean }[] = [
    { label: `Năm ${goalYear}`, t: targetsFor(monthsOfLevel('year', cfg.goal_month), a, months, cfg, 'year') },
    { label: `Quý ${quarterNo(cur)}/${cur.slice(0, 4)}`, t: targetsFor(monthsOfLevel('quarter', cur), a, months, cfg, 'quarter') },
    { label: `Tháng ${mLabel(cur)}`, t: targetsFor([cur], a, months, cfg, 'month') },
    { label: `Tuần ${mondayOf(t0).slice(8, 10)}/${mondayOf(t0).slice(5, 7)}–${addDays(mondayOf(t0), 6).slice(8, 10)}/${addDays(mondayOf(t0), 6).slice(5, 7)}`, t: targetsFor([cur], a, months, cfg, 'week') },
    { label: `Ngày (${cfg.working_days_week} ngày/tuần)`, t: targetsFor([cur], a, months, cfg, 'day'), day: true },
  ]
  const pair = ([lo, hi]: [number, number], f: (n: number) => string = cnt) => (f(lo) === f(hi) ? f(lo) : `${f(lo)} / ${f(hi)}`)
  /** Số dự án: số nguyên làm tròn lên; cột Ngày chia từ chỉ tiêu tuần. */
  const count = (c: { t: Targets; day?: boolean }, k: 'research' | 'reg' | 'tests') => (c.day ? pair(weekT[k], (n) => dayLabel(n, cfg.working_days_week)) : pair(c.t[k]))

  return (
    <div className="stack">
      <div className={'band ' + (goalOk ? 'green' : 'red')}>
        <div className="band-t">
          <small>O năm · lợi nhuận ròng sau ads</small>
          <b>
            {usd(cfg.year_goal)}/tháng vào tháng {mLabel(cfg.goal_month)}
          </b>
        </div>
        <div className="band-p">
          <small>Dự kiến theo kế hoạch</small>
          <b>{usd(a.goalNet)}</b>
          <span>{goalOk ? 'Đủ mục tiêu' : 'Chưa đủ: xem gợi ý ngân sách bên dưới'}</span>
        </div>
      </div>

      <Sec title="Nguồn lực & cảnh báo" hint="Tính lại mỗi khi sửa bảng phân bổ">
        <ul className="alerts">
          {(a.physLoss || a.saasLoss) && (
            <li className="red">
              🔴 Mô hình lỗ: {a.physLoss && 'Vật lý (tiền tìm 1 thắng ≥ lợi nhuận trọn đời của thắng)'} {a.saasLoss && 'SaaS (LTV ≤ CAC hoặc tiền tìm thắng ≥ lợi nhuận thắng mang lại)'}. Không chốt kế hoạch tháng cho tới khi sửa hệ số hoặc chiến lược.
            </li>
          )}
          {a.scaleFrom > cur && (
            <li>
              Giai đoạn đo đến hết {mLabel(addMonths(a.scaleFrom, -1))} (LN mục tiêu = 0): giữ ngân sách test tối thiểu {usd(curRow?.budget_test ?? cfg.base_budget)}/tháng, mục tiêu là đo hệ số thật.
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
              🟡 Từ tháng {mLabel(a.overCapacity[0].month)} cần ~{cnt(a.overCapacity[0].perWeek)} test/tuần, vượt công suất {cfg.cap_tests_week}/tuần: cần KR đội ngũ hoặc workflow AI.
            </li>
          )}
          {a.maxCapital && (
            <li>
              Vốn cần cao nhất: <b>{usd(a.maxCapital.capital)}</b> (tháng {mLabel(a.maxCapital.month)}): tiền test + tiền ads chờ hoa hồng về (Vật lý {cfgDays(cfg, 'phys')} ngày, SaaS {cfgDays(cfg, 'saas')} ngày + thời gian hoàn vốn mỗi khách).
            </li>
          )}
          <li>
            Ngân sách test tháng sau đề xuất: <b>{usd(nextBudget(cfg.base_budget, cfg.reinvest_pct, recv))}</b> = {usd(cfg.base_budget)} + {cfg.reinvest_pct}% lợi nhuận đã nhận tháng này ({usd(recv)}, Thực nhận − Chi phí ở Sổ dự án). Ngân sách scale cho dự án đạt ROAS ≥ {fmtNum(coeffsOf(curRow ?? { coeffs: null }, cfg).phys.roas)} không giới hạn theo kỳ. Mở rộng test 1 dự án tối đa ×{cfg.test_cap_mult} tiền test mặc định, phải ghi lý do (ở Sổ dự án).
          </li>
        </ul>
      </Sec>

      <Sec title="Chỉ tiêu Năm → Ngày" hint="tối thiểu (theo ngân sách) / mục tiêu (đủ đạt lợi nhuận)">
        <div className="tbl">
          <table className="ktable aff-t">
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
                <td>Search dự án</td>
                {cols.map((c) => (
                  <td key={c.label} className="n">{count(c, 'research')}</td>
                ))}
              </tr>
              <tr>
                <td>Đăng ký</td>
                {cols.map((c) => (
                  <td key={c.label} className="n">{count(c, 'reg')}</td>
                ))}
              </tr>
              <tr>
                <td>Test (chạy camp)</td>
                {cols.map((c) => (
                  <td key={c.label} className="n">
                    {count(c, 'tests')}
                    {!c.day && <small className="sub">VL {cnt(c.t.testsP)} · SaaS {cnt(c.t.testsS)}</small>}
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
          Số "mục tiêu" = số tối thiểu × {fmtNum(Math.round(mult * 10) / 10)} từ tháng {mLabel(a.scaleFrom)} (ngân sách đủ đạt mọi mục tiêu tháng còn kịp); giai đoạn đo giữ nguyên. Thắng chỉ đặt từ cấp Tháng trở lên. Search = {cfg.research_per_test} × test, đăng ký = {cfg.reg_per_test} × test (phễu minh hoạ của nguồn). Số dự án làm tròn lên; cột Ngày chia từ chỉ tiêu tuần (VD "1 · 4 ngày/tuần" = 4 ngày trong tuần, mỗi ngày 1).
        </p>
      </Sec>

      <Sec title="Bảng phân bổ theo tháng" hint={`Sửa được: tháng tới, hoặc ${cfg.edit_days} ngày đầu của tháng đang chạy`}>
        {!months.length ? (
          <div className="addrow">
            <button className="btn primary" onClick={() => aff.addMonths(planRows(cfg, t0))}>
              Tạo kế hoạch từ tháng {mLabel(cur)} đến {mLabel(cfg.goal_month)}
            </button>
            <p className="note">Mặc định: T11–T12/2026 chỉ Vật lý, đo hệ số; 2027 tỷ trọng VL Q1 60% · Q2 30% · Q3 50% · Q4 80%; thang lợi nhuận theo đề xuất wiki. Sửa được sau khi tạo.</p>
          </div>
        ) : (
          <>
            <div className="tbl">
              <table className="ktable aff-m">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>% Vật lý</th>
                    <th>% SaaS</th>
                    <th>Ngân sách test</th>
                    <th>Mùa vụ VL</th>
                    <th>LN mục tiêu</th>
                    <th>Test VL / SaaS</th>
                    <th>Thắng mới</th>
                    <th>LN dự kiến</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => {
                    const sm = a.sim.find((x) => x.month === m.month)
                    const ed = monthEditable(m.month, t0, cfg.edit_days, anyLocked)
                    const q = quarterNo(m.month)
                    const newQ = i === 0 || quarterNo(months[i - 1].month) !== q || months[i - 1].month.slice(0, 4) !== m.month.slice(0, 4)
                    return (
                      <Fragment key={m.id}>
                        {newQ && (
                          <tr className="qsep">
                            <td colSpan={10}>
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
              {curRow && !curRow.locked_at && (
                <button className="btn primary" disabled={a.physLoss || a.saasLoss} onClick={() => aff.lockMonth(curRow)}>
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
              Tỷ trọng = phần ngân sách test và công sức dồn cho Vật lý; app tự tính mỗi mô hình đóng góp lợi nhuận vào tháng nào (SaaS ra tiền sau {coeffsOf(curRow ?? { coeffs: null }, cfg).saas.lag_months} tháng). Chốt tháng thì lưu bản chụp hệ số; quá {cfg.edit_days} ngày đầu tháng mà chưa chốt, app tự chốt.
            </p>
          </>
        )}
      </Sec>

      <Sec title={`Hệ số đang dùng tháng ${mLabel(cur)}`} hint={curRow?.locked_at ? 'Bản chụp lúc chốt' : 'Mặc định hiện tại'}>
        <Coeffs m={curRow} cfg={cfg} />
        <button className="btn" onClick={() => go('settings')}>
          Sửa hệ số mặc định trong Cài đặt
        </button>
      </Sec>
    </div>
  )

}

function Coeffs({ m, cfg }: { m: AffMonth | undefined; cfg: AffConfig }) {
  const c = coeffsOf(m ?? { coeffs: null }, cfg)
  return (
    <div className="grid2">
      {(
        [
          ['Vật lý', PHYS_FIELDS, c.phys],
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

function MonthRow({ m, cur, ed, sm, patch }: { m: AffMonth; cur: string; ed: boolean; sm: { testsP: number; testsS: number; winsP: number; winsS: number; net: number } | undefined; patch: (p: Partial<AffMonth>) => void }) {
  const n = (k: 'share_phys' | 'budget_test' | 'season' | 'profit_target', min: number, max?: number) => (
    <Txt
      className="num"
      type="number"
      value={String(m[k])}
      disabled={!ed}
      label={k}
      onSave={(v) => {
        const x = toNum(v)
        if (x === null || x < min || (max !== undefined && x > max)) return
        patch({ [k]: x } as Partial<AffMonth>)
      }}
    />
  )
  const short = sm && m.profit_target > 0 && sm.net < m.profit_target
  return (
    <tr className={m.month === cur ? 'cur' : ''}>
      <td>
        <b>{mLabel(m.month)}</b>
      </td>
      <td>{n('share_phys', 0, 100)}</td>
      <td className="n">{100 - m.share_phys}%</td>
      <td>{n('budget_test', 0)}</td>
      <td>{n('season', 0.1, 5)}</td>
      <td>{n('profit_target', 0)}</td>
      <td className="n">{sm ? `${cnt(sm.testsP)} / ${cnt(sm.testsS)}` : '–'}</td>
      <td className="n">{sm ? winsLabel(sm.winsP + sm.winsS) : '–'}</td>
      <td className={'n ' + (short ? 'neg' : '')}>{sm ? usd(sm.net) : '–'}</td>
      <td className="st">{m.locked_at ? '🔒 Đã chốt' : ed ? 'Đang mở' : 'Khoá'}</td>
    </tr>
  )
}
