# OKRs Kaizen

App OKR + Kaizen cá nhân: Tầm nhìn → Năm → Quý → Tháng → Tuần → Ngày, có mô hình thu nhập Affiliate Global đọc số từ Research và Ads-Hub.

- App: https://buunq1977.github.io/okrs-kaizen/
- Quy tắc (nguồn sự thật): [`SPEC.md`](SPEC.md) · bản **v0**, 19/11/2026, mọi thay đổi ghi ở §20
- Hướng dẫn dùng: [`docs/HUONG-DAN.md`](docs/HUONG-DAN.md) (trong app: **Thêm → Hướng dẫn**)
- Mô hình Affiliate: [`docs/MO-HINH-AFFILIATE.md`](docs/MO-HINH-AFFILIATE.md)

## Màn hình

| Thanh trên | Menu Thêm |
|---|---|
| Tổng quan · Hôm nay · Ngày mai · Tuần · Tháng · Quý · Năm | Tầm nhìn · Kỳ khởi động · Sổ dự án · Mô hình thu nhập · Cây liên kết · Lịch sử Kaizen · Hướng dẫn · Cài đặt |

Mỗi cấp có 2 tab OKR | Kaizen. Mô hình thu nhập có 3 tab: Kế hoạch Affiliate · Cấu hình mô hình · Kết nối nguồn số. Cài đặt chỉ chứa cấu hình trang và hệ thống.

## Cài đặt Supabase (OKR)

Chạy lần lượt trong **SQL Editor**, mỗi file một lần:

| # | File | Nội dung |
|---|---|---|
| 1 | `001_init.sql` | Bảng gốc |
| 2 | `002_goal_current.sql` | |
| 3 | `003_grants.sql` | Quyền `authenticated` |
| 4 | `004_okr_kaizen_v2.sql` | Kỳ, O, KR, KA, Kaizen |
| 5 | `005_v3_day.sql` | Trang Ngày v3, lịch lặp lại |
| 6 | `006_week.sql` | Tuần |
| 7 | `007_long_periods.sql` | Tháng, Quý, Năm, Tầm nhìn, điều chỉnh kế hoạch |
| 8 | `008_affiliate_plan.sql` | Mô hình Affiliate |
| 9 | `009_aff_projects.sql` | Sổ dự án |
| 10 | `010_aff_search_tally.sql` | Bộ đếm search |
| 11 | `011_aff_okr_link.sql` | KR/KA tự đếm |
| 12 | `012_okr_lock_morning.sql` | OKR ngày khoá 08:00 |
| 13 | `013_aff_model_rework.sql` | Mô hình Affiliate 2 |
| 14 | `014_aff_reopen_v1.sql` | Mở lại tháng chốt theo mô hình 1 |
| 15 | `015_aff_reject_labels.sql` | Nhãn "loại vì…" |

Các file nằm trong `supabase/migrations/`. Thiếu file nào thì app hiện màn báo lỗi kèm danh sách.

GitHub Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Nguồn số Affiliate: Research + Ads-Hub (chỉ đọc)

OKR đọc đầu vào từ app Research (repo `workspace`) và kết quả từ app Ads-Hub (repo `ads-hub`), không ghi sang hai app đó.

1. Supabase Research chạy `workspace/supabase/09_reg_dates.sql`; Supabase Ads-Hub chạy `ads-hub/supabase/12_okr_read.sql`.
2. GitHub Secrets của repo này: `VITE_WS_URL`, `VITE_WS_KEY` (Research), `VITE_ADSHUB_URL`, `VITE_ADSHUB_KEY` (Ads-Hub). Thiếu thì app vẫn chạy, tab Kết nối nguồn số báo chưa cấu hình.
3. Email đăng nhập phải có trong `ws_users` (Research) và `dash_users` (Ads-Hub). Đăng nhập ở **Mô hình thu nhập → Kết nối nguồn số**.

## Phát triển

```bash
npm install
cp .env.example .env.local   # điền Supabase URL + anon key
npm run dev
```

Trước khi push (CI cũng chạy): `npx tsc -b` · `npm test` · `npm run build` · `npx eslint src`. Push `main` là deploy lên GitHub Pages.

- Logic thuần ở `src/lib/*.ts`, test ở `*.test.ts`.
- Migration mới: `supabase/migrations/NNN_*.sql`, bật RLS + `grant ... to authenticated`, chạy thử Postgres cục bộ trước.
- Sửa hướng dẫn: sửa `docs/HUONG-DAN.md`, trang trong app tự cập nhật khi deploy.
- Sao lưu tự động: `backup-template/README.md`.
