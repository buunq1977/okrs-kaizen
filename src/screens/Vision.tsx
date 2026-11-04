import { useState } from 'react'
import { Sec, Txt } from '../components/ui'
import { useApp, useRows } from '../lib/ctx'
import { errMsg, listAll, saveSettings } from '../lib/db'
import { fmtDMY } from '../lib/dates'
import type { VisionItem } from '../lib/types'

/** Tầm nhìn 3–10 năm (§8.2): mục tiêu theo năm + điều kiện kiểm tra bắt buộc. Rà 1 lần/năm. */
export default function Vision() {
  const { settings, setSettings, toast, go } = useApp()
  const items = useRows<VisionItem>('vision_items', 'all', () => listAll<VisionItem>('vision_items', 'year_no'))
  const [start, setStart] = useState(settings.vision_start ?? '2027-01-01')
  const next = (items.rows.reduce((m, x) => Math.max(m, x.year_no), 0) || 0) + 1

  return (
    <div className="stack narrow">
      <h1>Tầm nhìn</h1>
      <p className="note">
        Đi từ đây xuống Năm → Quý → Tháng → Tuần → Ngày. App không tự đặt con số. Mỗi năm phải có <b>điều kiện kiểm tra</b> (kiểm chứng được), thiếu thì "chưa hợp lệ".
      </p>
      <Sec title="Ngày bắt đầu Năm 1" hint="Trước ngày này là Kỳ khởi động (dùng cấu trúc Quý).">
        <div className="addrow">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Ngày bắt đầu Năm 1" />
          <button
            className="btn"
            disabled={start === settings.vision_start}
            onClick={async () => {
              try {
                setSettings(await saveSettings({ ...settings, vision_start: start }))
                toast('Đã lưu ngày bắt đầu Năm 1')
              } catch (e) {
                toast(errMsg(e))
              }
            }}
          >
            Lưu
          </button>
          <button className="btn ghost" onClick={() => go('kickoff')}>
            Mở Kỳ khởi động
          </button>
        </div>
        {settings.vision_start && <p className="note">Năm 1 bắt đầu {fmtDMY(settings.vision_start)}.</p>}
      </Sec>

      <Sec title="Mục tiêu theo năm">
        <div className="tbl">
          <table className="ktable vision-t">
            <thead>
              <tr>
                <th>Năm</th>
                <th>Mục tiêu</th>
                <th>Điều kiện kiểm tra (bắt buộc)</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.rows.map((v) => {
                const ok = v.goal.trim() && v.verification.trim()
                return (
                  <tr key={v.id}>
                    <td className="n">{v.year_no}</td>
                    <td>
                      <Txt multiline rows={2} value={v.goal} onSave={(x) => items.patch(v.id, { goal: x })} placeholder="VD: Thu nhập thụ động 200.000 USD/năm" label="Mục tiêu" />
                    </td>
                    <td>
                      <Txt multiline rows={2} value={v.verification} onSave={(x) => items.patch(v.id, { verification: x })} placeholder="VD: Nghỉ 90 ngày, thu nhập giữ ≥ [Z]%" label="Điều kiện kiểm tra" />
                    </td>
                    <td>{ok ? <span className="pill green">Hợp lệ</span> : <span className="pill red">Chưa hợp lệ</span>}</td>
                    <td>
                      <button className="x" aria-label="Xoá" onClick={() => items.del(v.id)}>
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {next <= 10 && (
          <button className="add" onClick={() => items.add({ year_no: next })}>
            + Năm {next}
          </button>
        )}
      </Sec>
    </div>
  )
}
