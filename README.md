# OKRs Kaizen

App OKR + Kaizen theo ngày, tuần, tháng, năm. Quy tắc và thiết kế: `SPEC.md` (§17 là quyết định đã chốt).

Kiểm tra logic: `npm test`.

App: https://buunq1977.github.io/okrs-kaizen/

## Dùng hằng ngày (SPEC §9)

| Khi nào | Màn hình | Làm gì |
|---|---|---|
| Một lần | Mục tiêu | Tầm nhìn 5 năm, tối đa 5 mục tiêu ưu tiên có con số |
| Cuối ngày D (20:00) | Hôm nay | Kaizen 4 bước: Đo lường → Nhật ký + Nguyên nhân (bôi đỏ từ khoá) → Bài học → Hành động, chuyển hành động vào ngày mai |
| Ngay sau đó | Ngày mai | OKR 7 bước: Lịch cố định → Quan sát → Phân tích → Nguyên nhân → O → KR → KA, rồi Chốt kế hoạch (trước 22:00) |
| Trong ngày D+1 | Hôm nay | Tick KA, Check lịch |

Tuần / Tháng / Năm đầy đủ: giai đoạn tiếp theo.

## Cài đặt Supabase

Chạy lần lượt trong **SQL Editor** (mỗi file chạy một lần):

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_goal_current.sql`
3. `supabase/migrations/003_grants.sql`
4. `supabase/migrations/004_okr_kaizen_v2.sql` (xoá bảng kế hoạch cũ, tạo bảng OKR + Kaizen v2)

GitHub Secrets cần có: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Sao lưu tự động: xem `backup-template/README.md`.

## Chạy ở máy

```bash
npm install
cp .env.example .env.local   # điền Supabase URL + anon key
npm run dev
```
