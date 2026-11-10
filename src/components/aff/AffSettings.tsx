import { useEffect, useState } from 'react'
import { configEditable, PHYS_FIELDS, physOf, SAAS_FIELDS, saasOf, type AffConfig } from '../../lib/affiliate'
import { today } from '../../lib/dates'
import { Sec } from '../ui'
import { useAff } from './useAff'

/** Cài đặt mô hình Affiliate: mục tiêu năm, quy tắc ngân sách, hệ số mặc định. Chỉ sửa ở đầu kỳ. */
export default function AffSettings() {
  const aff = useAff()
  const [c, setC] = useState<AffConfig | null>(null)
  useEffect(() => {
    if (aff.cfg) setC(aff.cfg)
  }, [aff.cfg])
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
