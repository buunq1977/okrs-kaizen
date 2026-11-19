# Mô hình thu nhập Affiliate Global (mô hình 2)

Tài liệu của mô hình đang chạy trong app OKRs Kaizen: nguồn số, quyết định đã chốt, cách tính, cổng bằng chứng, Sổ dự án, cách nối OKR/Kaizen, giả định và hạn chế.

- App: https://buunq1977.github.io/okrs-kaizen/ · Repo: `buunq1977/okrs-kaizen`
- Cập nhật: 19/11/2026. Thay tài liệu ngày 10/11/2026 (mô hình 1 đã bỏ hẳn, migration 014).
- Quy tắc chung của app: `SPEC.md`. Tài liệu này là phần chi tiết của SPEC §9.
- Cách dùng từng màn hình: `docs/HUONG-DAN.md` (cũng là trang **Thêm → Hướng dẫn** trong app).

---

## 1. Mục đích

Nối hoạt động chính (Affiliate Global: chạy Google Ads Search cho dự án Vật lý, Tools AI, SaaS) vào OKR + Kaizen:

1. Từ O năm ra việc mỗi ngày: search bao nhiêu, đăng ký bao nhiêu, lên bao nhiêu camp test.
2. Không nhập lại số đã có: đầu vào lấy từ **Research**, kết quả lấy từ **Ads-Hub**.
3. Mục tiêu đi theo **bằng chứng thật** (cổng 0 → 3), không theo thang lịch đoán trước.
4. Đo hệ số thật để thay dần giả định; app gợi ý, anh quyết.

---

## 2. Nguồn số: mỗi con số một nguồn

| Số | Nguồn | Ghi chú |
|---|---|---|
| Tỷ giá USD/VND | Research → Cài đặt tính toán (`usd_vnd`) | Một tỷ giá cho cả 3 app |
| maxtest ($ test tối đa 1 dự án) | Research → Cài đặt tính toán (`max_test_usd`) | Là tiền test 1 dự án của cả 3 mô hình; OKR chụp vào tháng khi chốt |
| Ngưỡng ROAS Hoà / Lãi / Lãi tốt | Research (`roa_hoa`, `roa_lai`, `roa_lai_tot`) | Mặc định 1,5 / 3 / 4,5 |
| Click/Sale theo bậc CPC | Research → bảng Loại dự án | Dùng cho luật dừng |
| Số đơn tối thiểu để là Winner | Ads-Hub (`winner_orders`, mặc định 3) | |
| Dự án đã chọn, đăng ký, duyệt link, từ chối, lên camp test | Research (dự án, đăng ký có ngày, lần test) | Đếm theo ngày giờ VN |
| Chi phí, click, đơn, hoa hồng chờ / đã duyệt / đã trả / bị huỷ | Ads-Hub (`qa_campaigns`, `okr_daily`) | Ghép dự án ↔ camp theo `ref_key` |
| Loại mô hình | Research `type_code`: `vat_ly` → Vật lý, `tools_ai` → Tools AI, `saas` → SaaS | |
| Search (lượt xem dự án chưa nhập) + lý do loại | OKR, bộ đếm ở Sổ dự án | Research không lưu số này |
| O năm, phân bổ tháng, hệ số, phí, quỹ, cổng | OKR (`aff_config`, `aff_months`) | Sửa ở **Mô hình thu nhập → Cấu hình mô hình** |

OKR **chỉ đọc** Research và Ads-Hub, không ghi sang. Mất kết nối thì app ghi rõ "chưa đọc được", không âm thầm dùng số 0.

---

## 3. Quyết định đã chốt

| # | Chốt | Ngày |
|---|---|---|
| D0 | O năm 2027 có 3 mức: **tối thiểu $16.000 / mục tiêu $50.000 / vươn tới $120.000** lợi nhuận/tháng vào 12/2027. Mức tối thiểu là cam kết, dùng tính kế hoạch; dải O năm báo đang đạt mức nào | 19/11 |
| D1 | Vốn ngoài = 0 cho tới khi anh nhập theo từng tháng | 18/11 |
| D2 | Nhịp tìm winner: **60 test/tháng** từ 12/2026 | 18/11 |
| D3 | **Tools AI và SaaS khoá tới Cổng 2** | 18/11 |
| D4 | Mục tiêu theo cổng bằng chứng (thang quý chỉ là tuỳ chọn gõ tay) | 18/11 |
| D5 | Tỷ giá = `usd_vnd` của Research | 18/11 |
| D6 | **Phí Invoice 5% trên tiền chi tiêu Ads; thuế 8% trên (chi tiêu + phí)**; chi phí cố định 0. VD chi 500.000đ → phí 25.000đ, thuế 42.000đ, phải nạp 567.000đ (×1,134). Áp cho mọi tiền nạp: test, ads scale, ads mua khách | 18/11 |
| D7 | maxtest một nguồn ở Research, OKR chụp theo tháng khi chốt | 18/11 |
| D8 | Trần dừng ×2 maxtest khi đã ghi lý do mở rộng | 18/11 |
| D9 | Cổng 2: đạt trong 1 tháng là đủ | 18/11 |
| D10 | Được sửa repo `workspace` và `ads-hub`, mỗi repo 1 file SQL, không đổi giao diện | 18/11 |
| D11 | **3 mô hình riêng: Vật lý, Tools AI, SaaS** | 18/11 |
| — | Một email đăng nhập chung cho OKR, Research, Ads-Hub | 18/11 |
| — | Mô hình 1 bỏ hẳn; tháng đã chốt theo mô hình 1 được mở lại một lần và tính lại (migration 014) | 18/11 |
| — | **% Vật lý + % Tools AI + % SaaS = 100%**. Sửa 1 cột thì cột cao nhất trong 2 cột còn lại tự bù | 19/11 |
| — | Bỏ phễu tự cấu hình khỏi app (giữ bảng `income_models` trong database) | 19/11 |
| — | Giữ các lựa chọn của anh: 7 ngày làm/tuần, công suất 15 test/tuần | 10/11 |

---

## 4. Cách mô hình tính (mỗi tháng)

### 4.1 Test và thắng
- Test mỗi mô hình = Ngân sách test × % mô hình ÷ tiền test (= maxtest).
- Thắng mới = số test ÷ số test ra 1 thắng.

### 4.2 Lợi nhuận
- **Vật lý**: thắng tìm tháng m ra tiền từ m+1, sống L tháng. Lợi nhuận = số thắng đang chạy × lợi nhuận 1 thắng/tháng × hệ số mùa vụ.
- **Tools AI, SaaS** (ghi theo **dòng tiền**, không ghi LTV ngay): thắng mua khách từ tháng sau, trả CAC ngay; mỗi khách trả hoa hồng hằng tháng trong số tháng còn trả; tiền hoa hồng đầu tiên về sau **độ trễ** (mặc định 3 tháng). Lợi nhuận tháng = hoa hồng về − tiền mua khách.
- **Lợi nhuận ròng tháng** = LN Vật lý + LN Tools AI + LN SaaS − tiền test − phí − thuế − chi phí cố định.
- Phí, thuế tính trên **tổng tiền nạp Ads** = tiền test + ads scale Vật lý + ads mua khách (D6).

### 4.3 Tiền ads và vốn
- Ads scale Vật lý = LN Vật lý ÷ (ROAS thực nhận − 1). ROAS thực nhận = thực nhận ÷ chi phí, **không phải** doanh số màn hình.
- Vốn vận hành = (tiền test + ads chờ hoa hồng về theo số ngày payout) × 1,134 (phí + thuế).
- **Vốn cần** = vốn vận hành + quỹ cầu nối 15% + quỹ dự phòng 10%. Cảnh báo khi vốn khả dụng (ngân sách tối thiểu + vốn ngoài) < vốn cần.

### 4.4 Ngân sách
- Ngân sách test tháng sau = **$200 + 50% lợi nhuận đã nhận sau phí, thuế** tháng này + vốn ngoài. Lợi nhuận âm tính là 0.
- "Tự nuôi được tới đâu": lợi nhuận đã nhận cần có để ngân sách tự đạt mức X.
- **Ngân sách tối thiểu đề xuất**: hệ số nhân nhỏ nhất áp từ tháng đầu có lợi nhuận mục tiêu > 0 để mọi tháng còn kịp đều đạt. Tháng không kịp vì độ trễ thì liệt kê riêng.

### 4.5 Kịch bản và cảnh báo
- Dải kịch bản **100 / 200 / 300 test ra 1 thắng** (100 là mức sàn của nguồn). Nhãn "độ tin cậy thấp" tới khi có ≥ 3 thắng.
- **Lỗ đơn vị**: Vật lý khi tiền test × số test/thắng ≥ LN 1 thắng × số tháng sống; Tools AI/SaaS khi LTV ≤ CAC hoặc tiền tìm 1 thắng ≥ lợi nhuận trọn đời của thắng. Lỗ đơn vị thì không cho chốt tháng.
- **Vượt sức người**: test/tuần cần > công suất (15). Thứ tự xử lý: giảm khối lượng hoặc lùi mốc → viết SOP, thử 1 kèm 1 → team → AI (chỉ từ Cổng 3).
- **Mùa vụ**: tháng 11, 12, 1 phía trước mà hệ số mùa vụ vẫn = 1 thì nhắc. Số đo trong mùa cao điểm được quy về mùa thường trước khi gợi ý thay hệ số.

---

## 5. Cổng bằng chứng (tính từ số thật, không nhập tay)

| Cổng | Điều kiện | Mục tiêu của cổng | Mở thêm |
|---|---|---|---|
| 0 · Tìm winner | Chưa có dự án đủ điều kiện scale | Khối lượng: **60 test/tháng** (tháng trước đạt thì app gợi ý gấp đôi, anh quyết) | — |
| 1 | Có ≥ 1 dự án **đủ điều kiện scale** | Lợi nhuận đã nhận sau phí ≥ $1.000 trong 1 tháng | Ngân sách scale |
| 2 | Có 1 tháng lợi nhuận đã nhận sau phí ≥ $1.000 | ≥ $2.000/tháng | **Tools AI + SaaS** |
| 3 | Có 1 tháng ≥ $2.000 | Theo kế hoạch O năm | Gợi ý team / AI |

Ngưỡng $1.000, $2.000, cổng mở SaaS, nhịp 60 test sửa ở **Cấu hình mô hình**.

Ở Cổng 0, chỉ tiêu test của bảng chỉ tiêu, Sổ dự án và KR/KA cùng lấy từ nhịp khối lượng nên báo **cùng một con số**. Từ Cổng 1 chỉ tiêu lấy từ mô hình.

---

## 6. Sổ dự án: cờ và chỉ số

Mỗi đăng ký ở Research đã lên camp (hoặc có chi phí ở Ads-Hub) là 1 dòng; số tiền lấy từ Ads-Hub.

### 6.1 Luật dừng (giống Research)
- Click cho 1 sale theo **bậc CPC** (bảng Loại dự án của Research); số click tối đa = maxtest ÷ CPC.
- 0 đơn mà đủ click/sale → **cân nhắc dừng**. Chi phí chạm trần (maxtest; ×2 khi đã ghi lý do mở rộng) → **nên dừng**.
- Tools AI / SaaS còn trong cửa sổ dùng thử (theo `trial_days` của dự án, trống = 14 ngày, tính từ ngày có click gần nhất) → **chờ dùng thử còn N ngày**, không báo dừng.
- Chưa có click (số tay cũ) thì chỉ xét theo tiền.

### 6.2 Hai cờ thắng
- **Ứng viên thắng**: ≥ `winner_orders` đơn (không tính đơn huỷ) và ROAS thực nhận dự kiến ≥ `roa_hoa`. Thực nhận dự kiến = đã duyệt + chờ duyệt × % duyệt.
- **Đủ điều kiện scale**: tự kiểm ≥ 30 chuyển đổi/30 ngày, ROAS thực nhận ≥ `roa_hoa`, có đơn ≥ 7 ngày trong 14 ngày gần nhất; tick tay: Quality Score ≥ 7, Impression Share ≤ 40%, Lost IS do ngân sách ≥ 30%, cap offer ≥ 3 lần mức scale. Dưới 20 chuyển đổi/30 ngày: "đừng scale dù đang lãi". Tăng tối đa 30%/ngày.

### 6.3 % duyệt hoa hồng
- % duyệt = đã duyệt ÷ (đã duyệt + bị huỷ), **chỉ đơn đã quá hạn payout** (Vật lý 30 ngày, Tools AI/SaaS 45 ngày). Đơn chờ duyệt hiện riêng.
- Dưới 5 đơn đã có kết quả → "chưa đủ dữ liệu". Cảnh báo khi < 70%.

### 6.4 Search và lý do loại
Bộ đếm search theo ngày và mô hình; một chạm "loại vì…" với 6 nhãn sửa được (Hoa hồng thấp, CPC cao không hoà vốn, Cấm chạy Ads/brand, Payout rate thấp, Trustpilot xấu, Ít người tìm).

---

## 7. Từ mô hình ra chỉ tiêu

- Phễu **minh hoạ** của nguồn: Search = 5 × test, Đăng ký = 2 × test. Ở Ngày/Tuần, Search và Đăng ký là "tham khảo"; **Lên camp test** là chỉ tiêu chính. Đủ ≥ 30 dự án test thì app gợi ý thay bằng tỷ lệ đo.
- Năm / Quý / Tháng = cộng các tháng trong kỳ. Tuần = tháng × 12 ÷ 52. Ngày = chia chỉ tiêu tuần cho số ngày làm, cộng lại đủ tổng.
- Số dự án luôn là số nguyên (làm tròn lên). Thắng hiện 0, "< 1" hoặc số nguyên. **Chỉ tiêu thắng chỉ đặt từ Tháng trở lên.**
- Mỗi chỉ tiêu có 2 mức: tối thiểu (theo ngân sách) / mục tiêu (đủ đạt lợi nhuận).

---

## 8. Khoá đầu kỳ và bản chụp

- Hệ số và cấu hình chỉ sửa trong **3 ngày đầu tháng** (số ngày đổi được), trừ lần thiết lập đầu tiên.
- Bảng phân bổ: tháng tới luôn sửa được; tháng đang chạy chỉ trong 3 ngày đầu; tháng đã qua khoá.
- **Chốt tháng** lưu bản chụp: hệ số, phí/thuế/quỹ, maxtest, tỷ giá, ROA, Click/Sale, winner_orders và **số thực tế** đọc từ Research/Ads-Hub. Tháng đã chốt không tính lại khi ngưỡng hay dữ liệu nguồn đổi. Quá 3 ngày đầu tháng chưa chốt thì app tự chốt.
- Số đo thật **không tự ghi đè** hệ số; app chỉ gợi ý "Dùng số đo" khi đủ mẫu (tiền test ≥ 5 test, % duyệt ≥ 5 đơn, tỷ lệ thắng ≥ 3 thắng).

---

## 9. Nối OKR và Kaizen

- **OKR Tháng / Quý / Năm / Kỳ khởi động**: khối "Mô hình Affiliate gợi ý" → **Tạo N KR tự đếm**: Lên camp test, Search, Đăng ký, Camp thắng (khi ≥ 1), Dự án đủ điều kiện scale, Lợi nhuận đã nhận (sau phí, thuế).
- **OKR Tuần / Ngày**: khối "Affiliate tuần này / hôm nay" → **Lấy chỉ tiêu từ mô hình Affiliate**: 1 KR "Nhịp phễu Affiliate" với KA Search, Đăng ký, Lên camp test. KA tự tick khi đếm đạt số.
- KR/KA đếm từ Research (đầu vào) khi đã kết nối; chưa kết nối thì đếm Sổ nhập tay cũ.
- **Kaizen Ngày / Tuần**: đo lường đầu vào so với chỉ tiêu; chi phí, click, đơn, hoa hồng chờ/đã duyệt; camp chạm ngưỡng dừng; ứng viên thắng.
- **Kaizen Tháng / Quý / Năm**: thêm ngân sách tháng sau đề xuất, **Chẩn đoán phễu Affiliate** (khâu nghẽn, tiền test vượt maxtest, % duyệt thấp, chưa đủ mẫu đo, mùa vụ, thiếu vốn), **ROI theo trường lọc** của Research khi đủ dữ liệu, nút **Ghi thành bài học có số**. Tháng đã chốt đọc bản chụp, không đọc lại nguồn.

---

## 10. Giả định đang dùng (chưa có số thật)

Nhãn trong app: **Research** = đọc từ Research · **nguồn** = có trong tài liệu khoá học · **nguồn (mức sàn)** · **tính** = suy ra từ nguồn · **giả định** = cần thay bằng số thật · **của anh**.

| Mô hình | Hệ số | Mặc định | Nhãn |
|---|---|---|---|
| Cả 3 | Tiền test 1 dự án | maxtest Research (dự phòng $12 Vật lý, $40 SaaS) | Research |
| Cả 3 | Số test ra 1 thắng | 100 (kịch bản 200, 300) | nguồn (mức sàn) |
| Vật lý | Lợi nhuận 1 thắng/tháng | $2.000 | giả định |
| Vật lý | Thắng sống | 3 tháng | giả định |
| Vật lý | ROAS thực nhận khi scale | 1,5 | nguồn |
| Vật lý | Tiền về sau | 30 ngày | nguồn |
| Vật lý | Mùa vụ | 1 mọi tháng | giả định, anh đặt theo tháng |
| SaaS | Hoa hồng/khách/tháng | $15 | giả định |
| SaaS | Khách còn trả | 6 tháng | giả định |
| SaaS | CAC | $40 | giả định |
| SaaS | Khách mới/thắng/tháng | 35 | giả định |
| SaaS | Thắng sống | 12 tháng | giả định |
| SaaS | Độ trễ ra tiền | 3 tháng | tính |
| SaaS | Tiền về sau | 45 ngày | nguồn |
| Tools AI | Như SaaS | — | giả định (chưa có số riêng) |

| Cấu hình | Mặc định |
|---|---|
| Ngân sách test tối thiểu / tái đầu tư | $200 / 50% |
| Trần mở rộng test | ×2 |
| Ngày được sửa đầu tháng | 3 |
| Công suất / ngày làm | 15 test/tuần / 7 ngày |
| Search, Đăng ký / 1 test | 5, 2 (minh hoạ) |
| Phí / thuế / chi phí cố định | 5% / 8% / $0 |
| Quỹ cầu nối / dự phòng | 15% / 10% |
| Cảnh báo % duyệt | < 70% |

Chuẩn so sánh trong chẩn đoán: duyệt link 60%, dự án test có đơn 30% (phễu minh hoạ của nguồn); % duyệt hoa hồng 50% (giả định).

---

## 11. Hạn chế

- Trước khi có ~3 thắng, mọi số về tỷ lệ thắng và lợi nhuận mỗi thắng chỉ để tham khảo; kết quả rất nhạy với 2 hệ số này.
- Ngày đăng ký/duyệt cũ ở Research được điền ngược từ `updated_at`, là gần đúng.
- Research dùng giờ VN, Ads-Hub dùng múi giờ tài khoản Ads: số theo ngày có thể lệch ±1 ngày ở ranh giới.
- Camp chưa khai link affiliate thì không ghép được `ref_key`, không có số Ads-Hub.
- Chưa làm: công suất theo số tài khoản Ads, % duyệt theo từng network, ngày nghỉ trong chỉ tiêu ngày.

---

## 12. Phụ lục kỹ thuật

| Bảng (OKR, đều bật RLS) | Nội dung |
|---|---|
| `aff_config` | O năm (3 mức), ngân sách, phí/thuế/quỹ, cổng, hệ số 3 mô hình, nhãn loại (1 dòng/người dùng) |
| `aff_months` | Phân bổ theo tháng (% Vật lý, % Tools AI, ngân sách, mùa vụ, LN mục tiêu, vốn ngoài), bản chụp khi chốt |
| `aff_projects`, `aff_entries` | Sổ nhập tay cũ + checklist scale, lý do mở rộng của dự án Research |
| `aff_tallies` | Bộ đếm search + lý do loại |
| `key_results.aff_metric`, `key_actions.aff_metric / aff_target` | KR/KA tự đếm |

| File | Vai trò |
|---|---|
| `src/lib/affiliate.ts` | Mô hình: mô phỏng, phí/thuế, vốn, ngân sách, cổng, kịch bản, chỉ tiêu, tỷ trọng 100% |
| `src/lib/affSource.ts` | Đọc Research + Ads-Hub: Sổ dự án, luật dừng, cờ thắng, % duyệt, ROI theo trường lọc |
| `src/lib/affLink.ts` | Nối OKR: chỉ tiêu theo cấp, KR/KA tự đếm, bản chụp số thực tế |
| `src/lib/affDiag.ts` | Chẩn đoán phễu, gợi ý dùng số đo |
| `src/lib/affProjects.ts` | Sổ nhập tay cũ, bộ đếm search |
| `src/components/aff/*`, `src/screens/Income.tsx`, `src/screens/Projects.tsx` | Giao diện |
| `supabase/migrations/008–015` | Schema OKR · Research: `workspace/supabase/09_reg_dates.sql` · Ads-Hub: `ads-hub/supabase/12_okr_read.sql` |
