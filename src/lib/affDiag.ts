/* Chẩn đoán phễu Affiliate cho Kaizen tháng/quý/năm và gợi ý cập nhật hệ số. Logic thuần.
   Chuẩn so sánh lấy từ phễu minh hoạ của nguồn (20 apply → 12 duyệt → 10 test → 3 có sale → 1 thắng);
   ngưỡng % duyệt hoa hồng 50% là giả định, đổi khi có số thật. */
import type { PhysCoeffs, SaasCoeffs } from './affiliate'
import type { Counts, Measured } from './affProjects'

export const BENCH = {
  reg_approved: 60, // % đăng ký được duyệt link (nguồn minh hoạ 12/20)
  order_rate: 30, // % dự án test có đơn (nguồn minh hoạ 3/10)
  commission_approval: 50, // % hoa hồng được duyệt (giả định)
  min_tests: 5, // mẫu tối thiểu để đo tiền test, tỷ lệ
  min_tests_orders: 10,
  min_regs: 5,
}

export interface Finding {
  key: string
  level: 'red' | 'yellow' | 'green' | 'info'
  stage: string // khâu trong quy trình
  text: string // số đo + so sánh
  number: string // con số chính (cho "bài học có số")
  action: string // việc nên làm
}
interface Targets {
  search: number
  dang_ky: number
  test: number
}
const r = (n: number) => Math.round(n)
const usd = (n: number) => '$' + (Math.round(n * 10) / 10).toString().replace('.', ',')

/** waitingLink: số dự án đang ở "Đã duyệt link" (có link, chưa lên camp). */
export function diagnose(c: Counts, t: Targets | null, m: Measured, set: { phys: PhysCoeffs }, waitingLink: number): Finding[] {
  const out: Finding[] = []
  // 1) Khối lượng: thiếu test thì truy ngược khâu nghẽn
  if (t && t.test > 0 && c.test < t.test) {
    out.push({ key: 'vol', level: 'red', stage: 'Lên camp test', text: `Test ${c.test}/${t.test} camp`, number: `${c.test}/${t.test}`, action: 'Thiếu khối lượng test: tìm khâu nghẽn ở dưới.' })
    if (t.search > 0 && c.search < t.search)
      out.push({ key: 'vol-search', level: 'red', stage: 'Search', text: `Search ${c.search}/${t.search} dự án`, number: `${c.search}/${t.search}`, action: 'Nghẽn từ đầu phễu: giữ khung giờ search cố định, đếm search mỗi ngày.' })
    else if (t.dang_ky > 0 && c.dang_ky < t.dang_ky)
      out.push({ key: 'vol-reg', level: 'red', stage: 'Chọn & đăng ký', text: `Đăng ký ${c.dang_ky}/${t.dang_ky} (search đủ ${c.search})`, number: `${c.dang_ky}/${t.dang_ky}`, action: 'Search đủ nhưng chọn/đăng ký ít: xem lại tiêu chí lọc (quá chặt?) hoặc đăng ký ngay sau khi chọn.' })
    else if (c.dang_ky > 0 && (c.duyet / c.dang_ky) * 100 < BENCH.reg_approved)
      out.push({ key: 'vol-approve', level: 'red', stage: 'Duyệt link', text: `Duyệt ${c.duyet}/${c.dang_ky} đăng ký`, number: `${r((c.duyet / c.dang_ky) * 100)}%`, action: 'Đăng ký đủ nhưng ít được duyệt: chọn network/dự án dễ duyệt, hoàn thiện hồ sơ publisher.' })
    else if (waitingLink > 0)
      out.push({ key: 'vol-launch', level: 'red', stage: 'Lên camp', text: `${waitingLink} dự án đã có link nhưng chưa lên camp`, number: String(waitingLink), action: 'Nghẽn ở khâu lên camp: dành khung giờ cố định để dựng camp cho các dự án đã duyệt.' })
  } else if (t && t.test > 0) {
    out.push({ key: 'vol-ok', level: 'green', stage: 'Lên camp test', text: `Test ${c.test}/${t.test} camp: đủ khối lượng`, number: `${c.test}/${t.test}`, action: 'Giữ nhịp.' })
  }
  // 2) Duyệt link (mẫu ≥ 5 đăng ký)
  if (m.reg_approved !== null && c.dang_ky >= BENCH.min_regs && m.reg_approved < BENCH.reg_approved)
    out.push({ key: 'approve', level: 'yellow', stage: 'Duyệt link', text: `${r(m.reg_approved)}% đăng ký được duyệt (chuẩn minh hoạ ${BENCH.reg_approved}%)`, number: `${r(m.reg_approved)}%`, action: 'Ưu tiên network duyệt dễ; ghi lý do bị từ chối để rút kinh nghiệm.' })
  // 3) Tiền test
  if (m.test_cost !== null && m.n_tests >= BENCH.min_tests) {
    if (m.test_cost > set.phys.test_cost * 1.3)
      out.push({ key: 'cost-hi', level: 'yellow', stage: 'Chi phí test', text: `Tiền test TB ${usd(m.test_cost)} > đặt ${usd(set.phys.test_cost)}`, number: usd(m.test_cost), action: 'Cắt camp đúng cờ "Nên dừng"; chọn từ khoá CPC thấp; chỉ mở rộng test khi có lý do.' })
    else if (m.test_cost < set.phys.test_cost * 0.7)
      out.push({ key: 'cost-lo', level: 'info', stage: 'Chi phí test', text: `Tiền test TB ${usd(m.test_cost)} < đặt ${usd(set.phys.test_cost)}`, number: usd(m.test_cost), action: 'Có thể hạ hệ số tiền test ở buổi rà đầu kỳ: cùng ngân sách test được nhiều dự án hơn.' })
  }
  // 4) Ra đơn
  if (m.order_rate !== null && m.n_tests >= BENCH.min_tests_orders && m.order_rate < BENCH.order_rate)
    out.push({ key: 'orders', level: 'yellow', stage: 'Ra đơn', text: `${r(m.order_rate)}% dự án test có đơn (chuẩn minh hoạ ${BENCH.order_rate}%)`, number: `${r(m.order_rate)}%`, action: 'Ít dự án ra đơn: siết tiêu chí chọn dự án (hoa hồng, giá, nhu cầu tìm kiếm), kiểm tra từ khoá và trang đích.' })
  // 5) % duyệt hoa hồng
  if (m.approval !== null && m.approval < BENCH.commission_approval)
    out.push({ key: 'scrub', level: 'yellow', stage: 'Hoa hồng', text: `Network chỉ duyệt ${r(m.approval)}% doanh số`, number: `${r(m.approval)}%`, action: 'Huỷ đơn nhiều: so % duyệt theo từng network, bỏ network huỷ nặng; kiểm tra chất lượng traffic.' })
  // 6) Thắng
  const k = set.phys.tests_per_win
  if (m.n_wins === 0)
    out.push({ key: 'win-sample', level: 'info', stage: 'Thắng', text: `Chưa có thắng sau ${m.n_tests} test (giả định ${k} test ra 1 thắng)`, number: `${m.n_tests}/${k}`, action: m.n_tests < k ? 'Chưa đủ mẫu để kết luận tỷ lệ thắng: giữ khối lượng test.' : 'Đã đủ mẫu mà chưa thắng: rà lại cách chọn dự án và tối ưu camp ra đơn.' })
  else if (m.tests_per_win !== null && m.tests_per_win > k * 1.5)
    out.push({ key: 'win-slow', level: 'yellow', stage: 'Thắng', text: `${r(m.tests_per_win)} test ra 1 thắng (giả định ${k})`, number: String(r(m.tests_per_win)), action: 'Tỷ lệ thắng thấp hơn giả định: cập nhật hệ số để kế hoạch thật hơn, tập trung tối ưu camp đã ra đơn.' })
  else if (m.tests_per_win !== null && m.tests_per_win < k * 0.67)
    out.push({ key: 'win-fast', level: 'green', stage: 'Thắng', text: `${r(m.tests_per_win)} test ra 1 thắng (giả định ${k})`, number: String(r(m.tests_per_win)), action: 'Tốt hơn giả định: cập nhật hệ số ở buổi rà để ngân sách đề xuất sát hơn.' })
  // 7) Lợi nhuận mỗi thắng
  if (m.win_profit !== null && m.win_profit < set.phys.win_profit * 0.7)
    out.push({ key: 'win-profit', level: 'yellow', stage: 'Scale', text: `Lợi nhuận/thắng/tháng ${usd(m.win_profit)} < giả định ${usd(set.phys.win_profit)}`, number: usd(m.win_profit), action: 'Thắng kiếm ít hơn giả định: scale ngân sách cho thắng đạt ROAS, hoặc hạ hệ số để kế hoạch thật hơn.' })
  return out
}

/* ---------- Gợi ý cập nhật hệ số ở buổi rà đầu kỳ ---------- */
export interface Suggest {
  key: string // 'phys.test_cost' | 'saas.tests_per_win' | 'reg_per_test' ...
  value: number
  n: number // cỡ mẫu
  enough: boolean // mẫu đủ tin cậy
  current: number
  diffPct: number
}
const sug = (key: string, value: number | null, n: number, need: number, current: number): Suggest | null =>
  value === null || n === 0 ? null : { key, value, n, enough: n >= need, current, diffPct: current ? Math.round(((value - current) / current) * 100) : 0 }
export function suggestCoeffs(mp: Measured, ms: Measured, set: { phys: PhysCoeffs; saas: SaasCoeffs; reg_per_test: number; research_per_test: number }): Suggest[] {
  const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)
  return [
    sug('phys.test_cost', round1(mp.test_cost), mp.n_tests, BENCH.min_tests, set.phys.test_cost),
    sug('phys.tests_per_win', mp.tests_per_win === null ? null : Math.round(mp.tests_per_win), mp.n_wins, 3, set.phys.tests_per_win),
    sug('phys.win_profit', mp.win_profit === null ? null : Math.round(mp.win_profit), mp.n_wins, 3, set.phys.win_profit),
    sug('saas.test_cost', round1(ms.test_cost), ms.n_tests, BENCH.min_tests, set.saas.test_cost),
    sug('saas.tests_per_win', ms.tests_per_win === null ? null : Math.round(ms.tests_per_win), ms.n_wins, 3, set.saas.tests_per_win),
    sug('reg_per_test', round1(mp.reg_per_test), mp.n_tests, BENCH.min_tests, set.reg_per_test),
    sug('research_per_test', round1(mp.research_per_test), mp.n_tests, BENCH.min_tests, set.research_per_test),
  ].filter((x): x is Suggest => x !== null && x.value > 0)
}
