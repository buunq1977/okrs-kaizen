# Plan v2: viết lại mô hình thu nhập Affiliate Global và nối Research + Ads-Hub vào OKR/Kaizen

- Ngày: 2026-11-18 · Người duyệt: Luca · Trạng thái: **chờ duyệt**
- Thay cho: "Plan - Viết lại mô hình thu nhập Affiliate Global trong app OKRs Kaizen" (bản sáng 18/11)
- Căn cứ: trang wiki "Phản biện mô hình thu nhập Affiliate Global trong app OKRs Kaizen" (10/11, mã A1–A6, B1–B8, C1–C7); code thật của 3 repo `okrs-kaizen`, `workspace` (Research), `ads-hub`; kiểm tra Supabase thật ngày 18/11.
- Quy trình: theo `CLAUDE.md`, `SPEC.md` và skill `app-okrs-kaizen`. Mỗi giai đoạn xong thì dừng, báo Luca duyệt.

---

## 1. Hiện trạng đã kiểm (18/11/2026)

| Mục | Kết quả |
|---|---|
| Migration OKR 008–012 trên Supabase thật | **Đã chạy hết** (kiểm qua REST: bảng/cột có thật thì báo "không có quyền", chưa có thì báo "không tồn tại") |
| Tháng đã chốt | Chưa chốt tháng nào → chưa có bản chụp cũ phải giữ |
| Ba app, ba Supabase riêng | OKR (`dwnkudgr…`), Research/Workspace (`rgfjyny…`), Ads-Hub (`eklewyx…`); mỗi app một Gmail đăng nhập |
| Research | Đã có: dự án (loại, cookie, dùng thử, % hoa hồng, quốc gia…), đăng ký (trạng thái Pending / Đã duyệt link / Từ chối), lần test (tài khoản Ads, camp, chi phí, click do Ads-Hub đổ về), **Cài đặt tính toán**: maxtest, tỷ giá, ROA 1,5/3/4,5, bảng Loại dự án & Click/Sale theo bậc CPC |
| Ads-Hub | Đã có: chi phí + click theo giờ từng camp, hoa hồng từng đơn có trạng thái **pending / approved / paid / denied**, ghép đơn ↔ camp ↔ link affiliate (`ref_key`, cùng quy tắc với Research). Hàm `qa_campaigns(từ, đến)` trả mỗi camp: chi phí, click, đơn, hoa hồng, hoa hồng đã duyệt, số từ đầu camp |
| Ngưỡng dùng chung | Research là nơi duy nhất sửa maxtest/tỷ giá/ROA/Click-Sale, tự gửi sang Ads-Hub. OKR đang có số riêng ($12 tiền test, ROAS 1,5, không có tỷ giá) |
| Chỗ Research còn thiếu cho OKR | Không có **ngày** đăng ký / ngày duyệt link / ngày bị từ chối (chỉ có trạng thái hiện tại) → không đếm được "đăng ký hôm nay" |
| Code OKR (điểm a–g của plan cũ) | (a) Cờ dừng/thắng SaaS chỉ dùng chi phí + đơn, không xét dùng thử; **lỗi: cờ thắng SaaS so với ngưỡng ROAS của Vật lý**. (b) ROAS hiển thị = Doanh số ÷ Chi phí; công thức ads scale dùng hệ số 1,5 không rõ gốc. (c) % duyệt tính trên mọi đợt từ trước tới nay, kể cả đơn chưa tới hạn. (d) Bản chụp là jsonb `coeffs {phys, saas}`; chỉ tiêu tính lại từ bản chụp. (g) Viết cứng: chuẩn chẩn đoán 60/30/50%, cỡ mẫu 5/10/5, bảng tỷ trọng, thang lợi nhuận |

---

## 2. Nguyên tắc

1. **Mỗi con số có một nguồn duy nhất.** OKR không nhập lại số đã có ở Research hoặc Ads-Hub.
2. **OKR chỉ đọc** Research và Ads-Hub. Không ghi sang hai app đó.
3. **Sửa cái đã có, không dựng mô hình thứ hai.** Không tạo màn hình/menu mới; không feature flag hai mô hình song song. File mới chỉ khi bắt buộc (migration, phần kết nối nếu `affData.ts` quá dài) và phải nêu trong báo cáo.
4. **Không xoá dữ liệu** đã nhập ở Sổ dự án OKR. Sổ cũ giữ để xem và để nhập tay khi không có số từ Ads-Hub (ví dụ số T10 trước khi có Ads-Hub).
5. **Không đổi giá trị Luca đã chọn** (O năm $16.000, 7 ngày làm/tuần, công suất 15 test/tuần). Chỉ thêm cảnh báo bên cạnh.
6. **Không tự điền số không có nguồn** (hệ số mùa vụ, lợi nhuận/thắng, tỷ lệ khách rời). Để trống hoặc nhãn "giả định", hỏi Luca.
7. **Bản chụp khi chốt tháng**: lưu hệ số, ngưỡng (maxtest, tỷ giá, ROA, Click/Sale) **và số thực tế** đọc từ Research/Ads-Hub. Tháng đã chốt không bị tính lại khi đổi ngưỡng hay khi dữ liệu nguồn thay đổi.
8. Push là deploy: commit từng giai đoạn, **chỉ push khi Luca đã chạy xong file SQL** của giai đoạn đó.

---

## 3. Nguồn sự thật cho từng số

| Số | Nguồn | Cách OKR lấy |
|---|---|---|
| Tỷ giá USD/VND | Research → Cài đặt tính toán `usd_vnd` | Đọc `settings` |
| maxtest ($ test tối đa 1 dự án) | Research → Cài đặt tính toán `max_test_usd` | Đọc `settings`; chụp vào tháng khi chốt |
| Ngưỡng ROAS Lỗ/Hòa/Lãi/Lãi tốt | Research `roa_hoa / roa_lai / roa_lai_tot` | Đọc `settings` |
| Ngưỡng click dừng theo bậc CPC | Research → bảng Loại dự án & Click/Sale | Đọc `project_types` |
| Số đơn tối thiểu để là Winner | Ads-Hub `winner_orders` (mặc định 3) | Đọc `qa_meta()`; bỏ ô `win_min_orders` riêng của OKR (giữ cột, không dùng) |
| Search (lượt xem dự án chưa nhập) | OKR bộ đếm search | Giữ nguyên, thêm nhãn lý do loại (GĐ6) |
| Dự án đã chọn / research đủ | Research `projects.created_at` | Đếm theo ngày |
| Đăng ký, duyệt link, bị từ chối | Research `registrations` + **ngày mới** (SQL Research 09) | Đếm theo ngày |
| Lên camp test | Research `test_runs.started_on` (lần test đầu của mỗi đăng ký) | Đếm theo ngày |
| Chi phí, click | Ads-Hub `qa_campaigns` | Theo khoảng ngày |
| Hoa hồng chờ / đã duyệt / bị huỷ | Ads-Hub `orders.status` | `qa_campaigns` (chờ + đã duyệt); phần bị huỷ cần hàm mới (SQL Ads-Hub 12) |
| Loại mô hình Vật lý / SaaS | Research `type_code`: `vat_ly` → Vật lý; `saas`, `tools_ai` → SaaS | Ghép qua `ref_key` |
| Mục tiêu, phân bổ, hệ số mô hình, phí, quỹ, cổng | OKR `aff_config`, `aff_months` | Như cũ + cột mới (migration 013) |

---

## 4. Giữ điểm đúng, sửa điểm chưa đúng

### 4.1 Giữ (đã đúng, có nguồn)
- Khoá hệ số đầu kỳ + bản chụp khi chốt (chống sửa số cho đẹp).
- Ngày/Tuần chỉ đặt chỉ tiêu việc tự kiểm soát (4DX, chỉ số dẫn); hai mức tối thiểu / mục tiêu.
- Tiêu chí thắng dùng **thực nhận dự kiến**, không dùng doanh số màn hình.
- Lỗ đơn vị chặn chốt tháng; cảnh báo vượt sức người.
- Số dự án là số nguyên; thắng chỉ đặt từ cấp Tháng.
- Mở rộng test ×2 phải ghi lý do.

### 4.2 Sửa

| Mã | Vấn đề | Cách sửa | GĐ |
|---|---|---|---|
| A1 | $200 ≈ 17 test/tháng không đo được tỷ lệ thắng, lợi nhuận/thắng | Đổi tên "giai đoạn đo hệ số" → **"giai đoạn tìm winner"**; bảng "mỗi hệ số cần bao nhiêu mẫu" + tiến độ thật từ Research/Ads-Hub | 4 |
| A2 | Nhịp thấp hơn mốc 60 dự án, đúng mùa Q4 | Chỉ tiêu test ở Cổng 0 = nhịp khối lượng (`kickoff_tests_month`, mặc định 60) theo D2; so sánh hai phương án $200 / $720 | 4 |
| A3 | Vật lý + SaaS song song khi chưa có winner | SaaS khoá tới cổng `saas_unlock_gate` (D3); bật tay được kèm cảnh báo số test SaaS thực tế | 4 |
| A4 | $200 + 50% lợi nhuận không tự nuôi nổi mức kế hoạch | Thêm **vốn ngoài** theo tháng; hàm "tự nuôi được tới đâu"; cảnh báo vốn khả dụng < vốn cần | 2 |
| A5 | Bước nhảy −$288 → $16.000, thang quý là đề xuất của wiki | **Cổng bằng chứng** 0→1→2→3 tính từ dữ liệu thật; thang $2k/5k/10k/16k giữ nhãn "đề xuất", tuỳ chọn gõ tay (D4) | 4 |
| A6 | "Cần team/AI" ngược thứ tự | Đổi lời: giảm khối lượng/lùi mốc → SOP + thử 1vs1 → team → AI chỉ từ Cổng 3 | 4 |
| B1 | "100 test/thắng" là mức sàn | Nhãn "nguồn (mức sàn)"; dải kịch bản 100/200/300; "độ tin cậy thấp" tới khi có ≥ 3 thắng | 2 |
| B2 | Mùa vụ = 1 | Không điền số. Chuẩn hoá số đo theo hệ số mùa vụ trước khi gợi ý "Dùng số đo"; cảnh báo khi T11–T1 vẫn = 1 | 2, 5 |
| B3 | Dừng theo tiền, nguồn dừng theo click | **Dùng đúng luật của Research**: số click tối đa = min(Click/Sale theo bậc CPC, maxtest ÷ CPC). SaaS không báo "nên dừng" trong cửa sổ dùng thử (`trial_days` của dự án ở Research, trống = 14) | 3 |
| B4 | Thắng quá dễ so với điều kiện scale | Hai cờ: **Ứng viên thắng** (≥ `winner_orders` đơn, ROAS thực nhận dự kiến ≥ `roa_hoa`, cảnh báo "dự án mồi") và **Đủ điều kiện scale** (checklist). Ngân sách scale chỉ mở cho dự án đủ điều kiện, hoặc phải ghi lý do vượt | 3 |
| B5 | Thiếu quỹ cầu nối, dự phòng | Vốn cần = test + ads × payout/30 + quỹ cầu nối % + dự phòng %, hiện từng dòng | 2 |
| B6 | Lợi nhuận "ròng" thiếu phí | Lợi nhuận tháng sau phí = thực nhận − ads − phí % × ads − chi phí cố định. Quy tắc ngân sách dùng số sau phí | 2 |
| B7 | ROAS doanh số hay thực nhận | Mọi quyết định (cờ thắng, ads scale, chẩn đoán) dùng **ROAS thực nhận**. Hiện thêm "ROAS hoa hồng (màn hình)" có nhãn rõ | 2 |
| B8 | % duyệt 15% chưa tách trạng thái | % duyệt = đã duyệt ÷ (đã duyệt + bị huỷ), **chỉ đơn đã quá hạn payout** (Vật lý 30 ngày, SaaS 45). Đơn chờ duyệt hiện riêng. Chưa đủ đơn quá hạn → "chưa đủ dữ liệu". Cảnh báo khi < `approval_warn_pct` (70%) | 3 |
| C1 | Search không ghi lý do loại | Một chạm "loại vì…" với 5–6 nhãn Luca sửa được | 6 |
| C2 | Thiếu trường lọc | **Đã có ở Research** (hoa hồng, %, cookie, dùng thử, quốc gia, traffic, keyword). OKR không thêm ô; chẩn đoán ROI theo trường lọc khi đủ dữ liệu | 6 |
| C3 | Phễu 5:2:1 là minh hoạ | Nhãn "minh hoạ"; Search/Đăng ký ở Ngày/Tuần là "tham khảo", chỉ "Lên camp test" là chỉ tiêu bắt buộc; gợi ý tỷ lệ đo sau ≥ 30 dự án | 6 |
| C4 | 7 ngày làm/tuần | **Không đổi** (lựa chọn của Luca); chỉ gợi ý trong báo cáo | — |
| C5 | SaaS ghi theo LTV ngay | Ghi theo dòng tiền từng tháng; tách "lợi nhuận SaaS (chưa chắc)" ở dải O năm | 2 |
| C6 | Ràng buộc tài khoản Ads | Chưa làm đợt này. Ads-Hub đã theo dõi tài khoản; để đợt sau | — |
| C7 | Chưa chạy trên Supabase thật | Đã xác nhận 008–012 chạy; mỗi GĐ báo rõ phần đã/chưa thử trên app thật | mọi GĐ |
| Lỗi | Cờ thắng SaaS dùng ngưỡng ROAS Vật lý | Sửa cùng B7 | 2 |

---

## 5. Quyết định Luca đã chốt (18/11/2026)

| # | Chốt |
|---|---|
| D0 | O năm có **3 mức: $16.000 / $50.000 / $120.000** (ý nghĩa từng mức: hỏi lại ở GĐ4; schema lưu dạng danh sách mức) |
| D1 | Vốn ngoài 0 cho tới khi anh nhập |
| D2 | 60 test/tháng từ 12/2026 |
| D3 | **SaaS và Tools AI** tắt cho tới Cổng 2 |
| D4 | Mục tiêu theo cổng bằng chứng |
| D5 | Tỷ giá: `usd_vnd` của Research |
| D6 | Phí 5% chi tiêu ads, **thuế 8%** (cơ sở tính: hỏi lại ở GĐ2), chi phí cố định 0 |
| D7 | Maxtest: một nguồn ở Research, OKR chụp theo tháng |
| D8 | Trần dừng ×2 maxtest khi đã ghi lý do |
| D9 | Cổng 2: đạt trong 1 tháng là đủ |
| D10 | Được sửa repo `workspace` và `ads-hub`: mỗi repo 1 file SQL nhỏ, không đổi giao diện |
| D11 | **3 mô hình riêng: Vật lý, Tools AI, SaaS** (OKR thêm mô hình `tools_ai` ở Sổ, bộ đếm, KR, hệ số, phân bổ) |
| — | Một email đăng nhập chung cho cả 3 app |
| — | **Mở khoá một lần** cho mô hình v2 (duyệt 18/11): chỉ tháng chốt theo v2 mới tính là "đã chốt"; tháng đã chốt theo mô hình cũ giữ bản chụp và cách tính cũ |

Bảng dưới là đề xuất ban đầu, giữ để tra cứu.

## 5b. Đề xuất ban đầu (đã được thay bằng bảng trên)

| # | Câu hỏi | Mặc định đề xuất |
|---|---|---|
| D0 | O năm: giữ $16.000/tháng vào 12/2027, hay đặt O theo vốn có? (A4, A5) | **Giữ $16.000**, nhưng dải O năm hiện thêm "kịch bản dự kiến" và cổng hiện tại. Đổi O là việc của anh |
| D1 | Vốn ngoài mỗi tháng (ngoài $200 + 50% lợi nhuận) | 0, nhập theo từng tháng khi có |
| D2 | Nhịp test giai đoạn tìm winner: 60 test/tháng (~$600 với maxtest $10) hay giữ $200 (~20 test) | **60 test/tháng từ 12/2026**; T11 giữ nhịp còn lại |
| D3 | SaaS (gồm Tools AI) tắt tới cổng nào | **Tắt tới Cổng 2** (lãi đã nhận ≥ $1.000/tháng); bật tay được kèm cảnh báo |
| D4 | Thang mục tiêu: theo cổng hay theo lịch quý | **Theo cổng**; thang quý giữ làm tuỳ chọn gõ tay |
| D5 | Tỷ giá | ✅ Đã chốt: dùng `usd_vnd` của Research |
| D6 | Phí tài khoản Invoice, chi phí cố định/tháng | Phí 5% chi tiêu ads; chi phí cố định $0 tới khi anh nhập |
| D7 | Maxtest | ✅ Đã chốt: một nguồn ở Research; OKR chụp theo tháng khi chốt; tiền test TB dùng số đo (chưa đủ 5 test thì = maxtest) |
| D8 | Trần dừng: ×1 maxtest (như Ads-Hub) hay ×2 khi có lý do mở rộng (như OKR) | **×2 khi có lý do**, hiện rõ "Ads-Hub đã báo vượt maxtest" |
| D9 | Cổng 2: đạt $1.000 trong 1 tháng hay 2 tháng liên tiếp | **1 tháng** |
| D10 | Cho em sửa repo `workspace` (thêm ngày đăng ký/duyệt) và `ads-hub` (hàm đọc hoa hồng bị huỷ)? | **Có**, mỗi repo 1 file SQL nhỏ, không đổi giao diện hai app |
| D11 | `tools_ai` tính là SaaS? | **Có** |

---

## 6. Thay đổi dữ liệu

### 6.1 OKR: `supabase/migrations/013_aff_model_rework.sql` (file duy nhất)
Chỉ `ADD COLUMN IF NOT EXISTS`, có default hoặc cho phép null. Không tạo bảng, không xoá cột.

| Bảng | Cột | Ý nghĩa |
|---|---|---|
| `aff_config` | `fee_pct numeric default 5` | phí tài khoản Invoice, % chi tiêu ads |
| | `fixed_cost_month numeric default 0` | chi phí cố định/tháng |
| | `bridge_pct numeric default 15`, `reserve_pct numeric default 10` | quỹ cầu nối chờ payout, quỹ dự phòng |
| | `kickoff_tests_month int default 60` | nhịp test/tháng khi chưa có winner |
| | `gate1_profit numeric default 1000`, `gate2_profit numeric default 2000`, `saas_unlock_gate int default 2` | cổng bằng chứng |
| | `approval_warn_pct numeric default 70` | ngưỡng cảnh báo % duyệt |
| `aff_months` | `extra_capital numeric default 0` | vốn ngoài của tháng |
| | `actuals jsonb` | bản chụp số thực tế khi chốt (đếm Research + số Ads-Hub) |
| `aff_projects` | `ws_reg_id bigint` | nối với đăng ký ở Research (chỉ tạo dòng khi cần lưu checklist scale/lý do) |
| | `scale_check jsonb default '{}'`, `scale_override_reason text default ''` | checklist đủ điều kiện scale, lý do vượt |
| `aff_entries` | `clicks int` | click cho số nhập tay (dữ liệu cũ) |
| `aff_tallies` | `reject_reasons jsonb default '{}'` | đếm lý do loại |

Trong jsonb `aff_months.coeffs` thêm: `model_version` (2), `max_test_usd`, `usd_vnd`, `roa`, `click_rules`, `fee_pct`, `bridge_pct`, `reserve_pct`. Bản chụp thiếu trường thì dùng default, không báo lỗi.

Kèm theo: `types.ts`, `db.ts`, `exportAll`, `backup-template/backup.mjs`, README (bước 13), gợi ý `SetupError` trong `App.tsx`. Chạy thử cả chuỗi 001–013 trên Postgres cục bộ.

### 6.2 Research: `workspace/supabase/09_reg_dates.sql` (cần D10)
- `registrations` thêm `registered_on`, `approved_on`, `rejected_on` (date). Trigger tự ghi ngày (giờ VN) khi trạng thái đổi sang "Pending approval" / "Đã duyệt link" / "Từ chối đăng ký".
- Điền ngược cho dữ liệu cũ bằng `updated_at` (gần đúng, ghi rõ trong báo cáo).
- Không đổi giao diện Research.

### 6.3 Ads-Hub: `ads-hub/supabase/12_okr_read.sql` (cần D10)
- Hàm chỉ đọc `okr_orders_summary(từ, đến)`: theo camp và theo ngày, tổng hoa hồng **pending / approved / paid / denied**, số đơn từng trạng thái, kèm ngày đơn (để lọc "đã quá hạn payout"). Cùng cổng quyền `_qa_guard` như các hàm đang có.
- Không tạo bảng, không sửa dữ liệu.

### 6.4 Đăng nhập
- Trong OKR → Cài đặt → Mô hình Affiliate: thêm khối **"Kết nối nguồn số"** với 2 ô đăng nhập (Research, Ads-Hub), giống cách Research đang nối Ads-Hub. Phiên lưu trong trình duyệt; không lưu mật khẩu.
- URL + anon key của hai app đưa vào GitHub Secrets của OKR (`VITE_WS_URL`, `VITE_WS_KEY`, `VITE_ADSHUB_URL`, `VITE_ADSHUB_KEY`). Anon key là khoá công khai; bảo vệ thật nằm ở danh sách email (`ws_users`, `dash_users`).
- **Việc anh làm:** thêm email đăng nhập (hoặc dùng đúng email đang dùng ở Research/Ads-Hub); thêm 4 secret vào GitHub (em hướng dẫn từng bước).

---

## 7. Các giai đoạn

Sau mỗi GĐ: `npx tsc -b`, `npm test`, `npm run build`, `npx eslint src`; ảnh preview 1280 + 400 cho phần giao diện; báo cáo theo mẫu §9; **dừng chờ duyệt**.

### GĐ1. Kết nối Research + Ads-Hub (chỉ đọc)
1. SQL Research 09 và Ads-Hub 12 (§6.2, §6.3). Chạy thử trên Postgres cục bộ.
2. Mở rộng `affData.ts` / `useAff.ts`: hai client Supabase phụ, đăng nhập, tải `settings`, `project_types`, `projects`, `registrations`, `test_runs` (Research) và `qa_meta`, `qa_campaigns`, `okr_orders_summary` (Ads-Hub). Mất kết nối thì OKR vẫn chạy bằng số nhập tay, hiện dòng "chưa kết nối".
3. Hàm thuần (có test): ghép Research ↔ Ads-Hub theo `ref_key`; đếm theo ngày (chọn, đăng ký, duyệt, từ chối, test); tổng chi phí/click/hoa hồng theo trạng thái theo kỳ và theo mô hình.
4. Khối "Kết nối nguồn số" ở Cài đặt: trạng thái, lần đọc cuối, các ngưỡng đang dùng (maxtest, tỷ giá, ROA, Click/Sale, winner_orders).

Test chấp nhận: ghép đúng `ref_key` dạng `sca|…` và `domain|mã`; đăng ký không có ngày vẫn không lỗi; mất kết nối trả về số tay.

### GĐ2. Lõi công thức (`affiliate.ts`)
1. ROAS thực nhận ở mọi nơi ra quyết định; ads scale = lợi nhuận ÷ (ROAS thực nhận − 1). Sửa lỗi cờ thắng SaaS.
2. Lợi nhuận sau phí cấp tháng/kế hoạch; chỉ số từng dự án giữ "Thực nhận − Chi phí".
3. Ngân sách tháng sau = tối thiểu + 50% × max(0, lợi nhuận đã nhận sau phí) + vốn ngoài. Hàm "tự nuôi được tới đâu".
4. Vốn cần có quỹ cầu nối + dự phòng; cảnh báo thiếu vốn.
5. Dải kịch bản 100/200/300 test/thắng; nhãn "mức sàn", "độ tin cậy thấp".
6. SaaS ghi lợi nhuận theo dòng tiền tháng.
7. Chuẩn hoá mùa vụ cho số đo; cảnh báo hệ số mùa vụ mùa cao điểm = 1.
8. Tiền test: maxtest từ Research làm trần; tiền test TB = số đo (≥ 5 test), chưa đủ thì = maxtest. Bỏ ô $12 riêng ở Cài đặt (giữ trong jsonb cũ, không dùng).
9. Chốt tháng ghi `model_version = 2` + ngưỡng + `actuals`.

Test chấp nhận: $200 ÷ $10 = 20 test; kỳ vọng thắng 0,2 với 100 test/thắng · 15% duyệt, ROAS hoa hồng 1,5 → ROAS thực nhận 0,225 · lợi nhuận −$288 → ngân sách $200 · lợi nhuận $9.600 → $5.000 · ads $32.000, phí 5% → $1.600 · tháng chốt version 1 (nếu có) giữ kết quả cũ.

### GĐ3. Sổ dự án = Research + Ads-Hub
1. Màn Sổ dự án hiển thị danh sách từ Research (đăng ký đang test/đã test) với số Ads-Hub. Dự án nhập tay cũ vẫn hiện, gắn nhãn "nhập tay". Các nút chuyển bước trong OKR chỉ còn cho dự án nhập tay (dự án Research chuyển bước ở Research).
2. Cờ **Nên dừng** theo luật click của Research (§4.2 B3): đạt mức click thấp mà 0 đơn = "cân nhắc dừng"; đạt số click tối đa hoặc maxtest (×2 khi có lý do) = "nên dừng". SaaS trong cửa sổ dùng thử = "đang chờ dùng thử còn N ngày". Không có click (số tay cũ) thì dùng quy tắc tiền, ghi chú.
3. Hai cờ thắng + checklist scale (tự tính: ≥ 30 chuyển đổi/30 ngày, ROAS thực nhận ≥ `roa_hoa`, có đơn đều trong 7–14 ngày từ ngày đơn của Ads-Hub; tick tay: QS ≥ 7, IS ≤ 40%, Lost IS ngân sách ≥ 30%, cap offer ≥ 3 lần). Dưới 20 chuyển đổi/30 ngày: "đừng scale dù đang lãi". Quy tắc tăng tối đa 30%/ngày cạnh nút scale.
4. % duyệt đúng (B8) và cảnh báo lọc dự án (Payout Rate ≥ 70%, Trustpilot, 10 câu chính sách).

Test chấp nhận: Vật lý CPC 4.000đ, 0 đơn: 49 click chưa cờ, 50 → "cân nhắc dừng", chạm maxtest → "nên dừng" · SaaS $40, 0 đơn, còn hạn dùng thử → "đang chờ" · 3 đơn, ROAS thực nhận dự kiến 1,6 → "ứng viên thắng", chưa "đủ điều kiện scale" · đơn chưa quá hạn payout không vào % duyệt · số tay cũ không click vẫn chạy.

### GĐ4. Cổng bằng chứng, nhịp khối lượng, SaaS có điều kiện (trang Mô hình thu nhập → Affiliate Global + Cài đặt)
1. Cổng 0 (chưa có dự án đủ điều kiện scale) → 1 (có ≥ 1) → 2 (lợi nhuận đã nhận sau phí ≥ $1.000 trong 1 tháng, mở SaaS, mục tiêu $2.000) → 3 (≥ $2.000, mở gợi ý team/AI). Thẻ "Anh đang ở Cổng N, mốc tiếp theo…, còn thiếu…".
2. Nhịp Cổng 0 = 60 test/tháng; tháng trước đạt thì gợi ý gấp đôi (anh quyết). So sánh "ngân sách tối thiểu chỉ đủ ~N test" theo maxtest hiện tại.
3. Đổi tên giai đoạn T11–T12 → "tìm winner"; bảng cỡ mẫu cần cho từng hệ số + tiến độ thật.
4. "Tạo kế hoạch": `profit_target` mặc định 0 (theo cổng); dải O năm: O $16.000 + kịch bản 100/200/300 + nhãn độ tin cậy. Thang quý gõ tay nếu muốn.
5. SaaS khoá tới Cổng 2: bảng phân bổ mặc định 12/2026 → Q4/2027 Vật lý 100%; bật tay có cảnh báo số test SaaS (ví dụ 40% × $200 ÷ $40 = 2 test).
6. Cảnh báo vượt sức người: lời mới theo A6.
7. Cảnh báo vốn và phí từ GĐ2.

Test chấp nhận: không có dự án đủ điều kiện → Cổng 0, ngân sách scale khoá · kế hoạch mới: lợi nhuận mục tiêu 0, SaaS 0% trước Cổng 2 · bật SaaS tay → cảnh báo.

### GĐ5. Nối OKR và Kaizen
1. **KR/KA (đầu vào) đếm từ Research**: chọn dự án, đăng ký, duyệt link, lên camp test; search từ bộ đếm OKR. Giữ khoá `aff_metric` cũ, nguồn đếm đổi sang Research khi đã kết nối (chưa kết nối thì đếm Sổ cũ). Thêm khoá mới: "dự án đủ điều kiện scale" (Tháng/Quý) và "% duyệt" (khi bật).
2. Chỉ tiêu Ngày/Tuần/Tháng ở Cổng 0 lấy từ nhịp khối lượng; từ Cổng 1 lấy từ mô hình.
3. **Kaizen (kết quả) đọc từ Ads-Hub**: Ngày/Tuần: chi phí, click, đơn, hoa hồng chờ/đã duyệt, camp chạm ngưỡng dừng, ứng viên thắng. Tháng/Quý/Năm: thêm chẩn đoán phễu (tiền test vượt maxtest, % duyệt dưới 70%, chờ duyệt/huỷ, số test chưa đủ đo tỷ lệ thắng, số đo mùa cao điểm chưa chuẩn hoá, vốn khả dụng < vốn cần).
4. Chốt tháng: lưu `actuals` → Kaizen tháng đã chốt đọc bản chụp, không đọc lại nguồn.
5. "Dùng số đo" ở buổi rà đầu kỳ: chỉ gợi ý khi đủ mẫu, có chuẩn hoá mùa vụ.

Test chấp nhận: KR tự đếm cũ trả đúng số trên dữ liệu cũ khi chưa kết nối · đếm từ Research đúng theo ngày VN · tháng đã chốt không đổi khi dữ liệu Ads-Hub đổi.

### GĐ6. Cải thiện nhẹ
1. Bộ đếm search: một chạm "loại vì…" (5–6 nhãn sửa được).
2. Phễu 5:2:1 nhãn "minh hoạ"; Search/Đăng ký Ngày/Tuần là "tham khảo"; gợi ý tỷ lệ đo sau ≥ 30 dự án.
3. Chẩn đoán ROI theo trường lọc của Research (hoa hồng/đơn, quốc gia, loại hoa hồng…) khi đủ dữ liệu.

### GĐ7. Tài liệu và hoàn tất
1. Cập nhật `mo-hinh-affiliate-global-okrs-kaizen.md` thành phiên bản mô hình 2 (điểm đã chốt, cách tính, giả định, hướng dẫn, hạn chế).
2. README + `SetupError` chỉ đúng file 013; hướng dẫn chạy SQL Research 09, Ads-Hub 12.
3. `docs/SPEC-aff-proposal.md`: đề xuất sửa SPEC §9 (mô hình thu nhập) cho khớp mô hình Affiliate; không ghi đè `SPEC.md`.
4. Chạy lại toàn bộ kiểm tra + ảnh preview toàn luồng. Bảng truy vết A/B/C cuối.

---

## 8. Thứ tự chạy SQL (khi tới giai đoạn tương ứng)

| Thứ tự | File | Chạy ở | GĐ |
|---|---|---|---|
| 1 | `workspace/supabase/09_reg_dates.sql` | Supabase Research | GĐ1 |
| 2 | `ads-hub/supabase/12_okr_read.sql` | Supabase Ads-Hub | GĐ1 |
| 3 | `okrs-kaizen/supabase/migrations/013_aff_model_rework.sql` | Supabase OKR | GĐ1 (gộp sớm để các GĐ sau không cần SQL mới) |

---

## 9. Mẫu báo cáo sau mỗi giai đoạn
1. Đã làm gì (theo hành vi trên app).
2. Đã kiểm gì / chưa kiểm gì (đặc biệt: đã thử trên Supabase thật chưa).
3. Hạn chế, rủi ro còn lại.
4. File SQL cần chạy (tên + thứ tự + app nào) hoặc "Không có SQL mới".
5. File tạo / sửa / xoá, theo từng repo.

---

## 10. Không làm đợt này
- Ràng buộc công suất theo số tài khoản Ads (C6).
- OKR ghi ngược sang Research/Ads-Hub.
- % duyệt theo từng network riêng (có thể làm nhanh sau GĐ3 vì Ads-Hub đã có `source`).
- Ngày nghỉ/ngày bận trong chỉ tiêu ngày.
- Đổi O năm, ngày làm/tuần, công suất: do Luca quyết.

## 11. Rủi ro
- **Ba lần đăng nhập** (OKR, Research, Ads-Hub): phiên hết hạn thì Kaizen thiếu số → app hiện rõ "chưa kết nối", không im lặng dùng 0.
- **Ngày đăng ký/duyệt cũ là gần đúng** (điền từ `updated_at`).
- **Múi giờ**: Research dùng giờ VN, Ads-Hub dùng múi giờ tài khoản Ads → số theo ngày có thể lệch ±1 ngày ở ranh giới; tổng tháng không ảnh hưởng đáng kể.
- **Dự án chưa có link affiliate trong camp** (không ghép được `ref_key`) → không có số Ads-Hub; liệt kê riêng để anh khai báo link rút gọn ở Ads-Hub.
- Sửa repo `workspace` và `ads-hub` cũng là deploy app thật của hai app đó → chỉ thêm SQL, không đổi giao diện, push sau khi anh chạy SQL.
