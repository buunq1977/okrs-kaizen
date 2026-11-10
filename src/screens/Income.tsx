import { useState } from 'react'
import AffiliatePlan from '../components/aff/AffiliatePlan'
import { Sec, Txt, toNum } from '../components/ui'
import { useRows } from '../lib/ctx'
import { listAll } from '../lib/db'
import { funnelPace, multiplier } from '../lib/numeric'
import { fmtNum } from '../lib/pace'
import type { IncomeModel } from '../lib/types'

const uid = () => Math.random().toString(36).slice(2, 10)
const r1 = (n: number) => fmtNum(Math.round(n * 10) / 10)

/** Mô hình thu nhập (§9): phễu tự cấu hình, app tự tính nhịp độ chia ngược. */
export default function Income() {
  const [tab, setTab] = useState<'aff' | 'funnel'>('aff')
  return (
    <div className="stack">
      <h1>Mô hình thu nhập</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'aff'} onClick={() => setTab('aff')}>
          Affiliate Global
        </button>
        <button role="tab" aria-selected={tab === 'funnel'} onClick={() => setTab('funnel')}>
          Phễu tự cấu hình
        </button>
      </div>
      {tab === 'aff' ? <AffiliatePlan /> : <Funnels />}
    </div>
  )
}

function Funnels() {
  const models = useRows<IncomeModel>('income_models', 'all', () => listAll<IncomeModel>('income_models'))
  return (
    <div className="stack narrow">
      <p className="note">
        Mỗi nguồn thu nhập một mô hình. Nhập hệ số bạn biết; hệ số chưa chắc thì tick "chưa đo": nhịp độ sẽ hiện "ước lượng" và nên có KR "đo hệ số" trong 2 tháng đầu. Số trong ví dụ chỉ minh hoạ.
      </p>
      {models.rows.map((m) => (
        <Model key={m.id} m={m} patch={(p) => models.patch(m.id, p)} del={() => models.del(m.id)} />
      ))}
      <div className="addrow">
        <button
          className="add"
          onClick={() =>
            models.add({
              name: 'Hệ thống tuyển dụng',
              unit_name: 'người hoạt động',
              stages: [
                { id: uid(), name: 'Cuộc gọi', conversion: null },
                { id: uid(), name: 'Hẹn', conversion: null },
                { id: uid(), name: 'Vào hệ thống', conversion: null },
              ],
            })
          }
        >
          + Mô hình (mẫu: gọi → hẹn → vào hệ thống)
        </button>
        <button
          className="add"
          onClick={() =>
            models.add({
              name: 'Affiliate quảng cáo',
              unit_name: 'đơn',
              stages: [
                { id: uid(), name: 'Click', conversion: null },
                { id: uid(), name: 'Đơn', conversion: null },
              ],
            })
          }
        >
          + Mô hình (mẫu: click → đơn)
        </button>
      </div>
    </div>
  )
}

function Model({ m, patch, del }: { m: IncomeModel; patch: (p: Partial<IncomeModel>) => void; del: () => void }) {
  const pace = funnelPace(m)
  const unk = m.unknown ?? {}
  const flag = (k: string) => (
    <label className="li unk">
      <input type="checkbox" checked={!!unk[k]} onChange={() => patch({ unknown: { ...unk, [k]: !unk[k] } })} /> chưa đo
    </label>
  )
  const num = (k: keyof IncomeModel, ph: string) => <Txt type="number" value={m[k] === null || m[k] === undefined ? '' : String(m[k])} onSave={(v) => patch({ [k]: toNum(v) } as Partial<IncomeModel>)} placeholder={ph} />
  const yearTarget = m.target_income_month ? m.target_income_month * 12 : null
  const mult = multiplier(yearTarget, m.prev_year_income)

  return (
    <Sec title={<Txt className="strong" value={m.name} onSave={(v) => patch({ name: v })} placeholder="Tên nguồn thu" label="Tên mô hình" />}>
      <div className="grid3">
        <label className="fld">
          <span>Thu nhập mục tiêu / tháng ({m.currency})</span>
          {num('target_income_month', '16700')}
          {yearTarget && <small className="note">≈ {fmtNum(yearTarget)} {m.currency}/năm</small>}
        </label>
        <label className="fld">
          <span>Thu nhập mỗi {m.unit_name} / tháng</span>
          {num('value_per_unit', '500')}
          {flag('value_per_unit')}
        </label>
        <label className="fld">
          <span>Đơn vị kết quả</span>
          <Txt value={m.unit_name} onSave={(v) => patch({ unit_name: v })} />
        </label>
        <label className="fld">
          <span>Tỷ lệ giữ chân / quý (0–1, trống = 1)</span>
          {num('retention', '0.6')}
          {flag('retention')}
        </label>
        <label className="fld">
          <span>Ngày làm việc / tuần</span>
          {num('working_days_week', '5')}
        </label>
        <label className="fld">
          <span>Công suất tối đa / ngày (bước đầu)</span>
          {num('capacity_per_day', '60')}
        </label>
        <label className="fld">
          <span>Tiền tệ</span>
          <Txt value={m.currency} onSave={(v) => patch({ currency: v })} />
        </label>
        <label className="fld">
          <span>Tỷ giá → VND (nhập tay)</span>
          {num('fx_rate', '25400')}
        </label>
        <label className="fld">
          <span>Ngày cập nhật tỷ giá</span>
          <input type="date" value={m.fx_updated_at ?? ''} onChange={(e) => patch({ fx_updated_at: e.target.value || null })} />
        </label>
        <label className="fld">
          <span>Thu nhập năm trước (để tính hệ số nhân bản)</span>
          {num('prev_year_income', '')}
        </label>
      </div>

      <div className="fld-l">Các bước phễu (từ trên xuống) · tỷ lệ = phần chuyển sang bước sau (0–1)</div>
      {m.stages.map((st, i) => (
        <div key={st.id} className="lead-r">
          <span className="n">{i + 1}</span>
          <Txt value={st.name} onSave={(v) => patch({ stages: m.stages.map((x) => (x.id === st.id ? { ...x, name: v } : x)) })} placeholder="Tên bước" label="Tên bước" />
          {i < m.stages.length - 1 ? (
            <>
              <Txt className="num" type="number" value={st.conversion === null ? '' : String(st.conversion)} onSave={(v) => patch({ stages: m.stages.map((x) => (x.id === st.id ? { ...x, conversion: toNum(v) } : x)) })} placeholder="0.2" label="Tỷ lệ sang bước sau" />
              {flag('conv_' + st.id)}
            </>
          ) : (
            <span className="note">= {m.unit_name} cần có</span>
          )}
          <button className="x" aria-label="Xoá bước" onClick={() => patch({ stages: m.stages.filter((x) => x.id !== st.id) })}>
            ×
          </button>
        </div>
      ))}
      <button className="add" onClick={() => patch({ stages: [...m.stages, { id: uid(), name: '', conversion: null }] })}>
        + Bước
      </button>

      <div className={'pace-box ' + (pace.overCapacity ? 'red' : '')}>
        {!pace.ok ? (
          <p className="note">Còn thiếu: {pace.missing.join(', ')}</p>
        ) : (
          <>
            <b>Nhịp độ chia ngược{pace.estimated ? ' (ước lượng: có hệ số chưa đo)' : ''}</b>
            <div className="tbl">
              <table className="ktable">
                <thead>
                  <tr>
                    <th>Bước</th>
                    <th>/ tháng</th>
                    <th>/ tuần</th>
                    <th>/ ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {pace.stages.map((x) => (
                    <tr key={x.name}>
                      <td>{x.name}</td>
                      <td className="n">{r1(x.perMonth)}</td>
                      <td className="n">{r1(x.perWeek)}</td>
                      <td className="n">{r1(x.perDay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              Cần {r1(pace.unitsNeeded)} {m.unit_name}; tính cả tỷ lệ giữ chân phải có thêm tới {r1(pace.unitsToAcquire)}.
            </p>
            {pace.overCapacity && (
              <p className="flag">
                {r1(pace.topPerDay)} {pace.stages[0].name}/ngày &gt; công suất {m.capacity_per_day}/ngày. Tăng nỗ lực cá nhân không đủ: cần KR đội ngũ tự vận hành hoặc đòn bẩy (bắt buộc để chốt kế hoạch).
              </p>
            )}
            {mult && <p className="note">Hệ số nhân bản cần có so với năm trước: ×{mult}</p>}
          </>
        )}
      </div>
      <button className="btn danger" onClick={del}>
        Xoá mô hình
      </button>
    </Sec>
  )
}
