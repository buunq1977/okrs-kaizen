# OKRs Kaizen

App OKR + Kaizen theo ngày, tuần, tháng, năm. Quy tắc và thiết kế: `SPEC.md` (§17 là quyết định đã chốt).

Kiểm tra logic: `npm test`.

App: https://buunq1977.github.io/okrs-kaizen/

## Nhịp dùng (SPEC v3 §13)

| Khi nào | Màn hình | Làm gì |
|---|---|---|
| 1 lần/năm | Thêm → Tầm nhìn | Mục tiêu từng năm + điều kiện kiểm tra, ngày bắt đầu Năm 1 |
| Lần đầu (11–12/2026) | Thêm → Kỳ khởi động | 3 O theo 3 mảng, KR số, 1–2 dự án trọng tâm |
| 1–5/1 | Năm | 3 O, KR số chia 4 mốc quý, gắn mô hình thu nhập |
| Cuối/đầu quý | Quý | KR từ mốc quý, dự án trọng tâm, điều chỉnh kế hoạch năm (có luật) |
| Cuối/đầu tháng | Tháng | Kaizen số liệu 5 bước, lập 3 O + KR số, kế hoạch cộng dồn, dẫn trước |
| CN hoặc T2 | Tuần | Kaizen tuần (tổng hợp từ các ngày) + OKR tuần, đóng góp KR tháng |
| Tối, trước 22:00 | Hôm nay → tab Kaizen dd/mm | Kaizen hôm nay, bấm Xác nhận; rồi Ngày mai → OKR ngày mai |
| Sáng, trước 08:00 | Hôm nay → tab OKR dd/mm | Rà lại và Chốt OKR (tự khoá lúc 08:00) |
| Trong ngày | Hôm nay | Tick KA, Check lịch |
| Bất cứ lúc nào | Tổng quan · Cây liên kết · Lịch sử Kaizen | Cảnh báo, tình trạng từng KR, tìm từ khoá đỏ |

Mô hình thu nhập (Thêm → Mô hình thu nhập): tab Affiliate Global (Vật lý + SaaS, bảng phân bổ theo tháng, chỉ tiêu Năm → Ngày, gợi ý ngân sách tối thiểu; hệ số sửa ở Cài đặt, chỉ đầu kỳ) và tab Phễu tự cấu hình. Thêm → Sổ dự án: search chỉ đếm số; dự án đủ điều kiện mới ghi vào Sổ (đã chọn → đã đăng ký → đã duyệt link → lên camp test → thắng / dừng), nhập số theo đợt, cờ nên dừng / đạt tiêu chí thắng, tự đếm nhịp tuần/tháng, đo hệ số thật, nhập từ Excel. OKR Ngày/Tuần/Tháng/Quý/Năm có nút lấy chỉ tiêu từ mô hình Affiliate; KR/KA tự đếm từ Sổ dự án; Kaizen các cấp có khối đo lường Sổ dự án.

## Cài đặt Supabase

Chạy lần lượt trong **SQL Editor** (mỗi file chạy một lần):

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_goal_current.sql`
3. `supabase/migrations/003_grants.sql`
4. `supabase/migrations/004_okr_kaizen_v2.sql`
5. `supabase/migrations/005_v3_day.sql`
6. `supabase/migrations/006_week.sql`
7. `supabase/migrations/007_long_periods.sql`
8. `supabase/migrations/008_affiliate_plan.sql`
9. `supabase/migrations/009_aff_projects.sql`
10. `supabase/migrations/010_aff_search_tally.sql`
11. `supabase/migrations/011_aff_okr_link.sql`
12. `supabase/migrations/012_okr_lock_morning.sql`

GitHub Secrets cần có: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Sao lưu tự động: xem `backup-template/README.md`.

## Chạy ở máy

```bash
npm install
cp .env.example .env.local   # điền Supabase URL + anon key
npm run dev
```
