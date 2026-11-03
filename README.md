# OKRs Kaizen

App lập mục tiêu 5 năm → năm → tháng → tuần → ngày và giữ kỷ luật hằng ngày. Quy tắc và thiết kế: `SPEC.md`.

App: https://buunq1977.github.io/okrs-kaizen/

## Dùng hằng ngày

| Khi nào | Màn hình | Làm gì |
|---|---|---|
| Một lần | Mục tiêu | Tầm nhìn 5 năm, tối đa 5 mục tiêu năm, mỗi mục tiêu có ≥1 chỉ số hành động |
| Đầu tháng | Tháng | Kích hoạt 1–3 mục tiêu, đặt KR tháng |
| Thứ Hai | Tuần | Chia KR tháng thành KR tuần, lịch Sáng/Chiều/Tối |
| Trước 22:00 | Ngày mai | Tiêu điểm + tối đa 3 việc có con số, gắn KR tuần. Chốt kế hoạch |
| Cuối ngày | Hôm nay | Nhập số thực tế, Check-in, viết Kaizen |
| Chủ nhật / cuối tháng | Tuần / Tháng | Kaizen, đẩy hành động sang kỳ sau |

## Cài đặt Supabase

Chạy lần lượt trong **SQL Editor** (mỗi file chạy một lần):

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_goal_current.sql`

GitHub Secrets cần có: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Sao lưu tự động: xem `backup-template/README.md`.

## Chạy ở máy

```bash
npm install
cp .env.example .env.local   # điền Supabase URL + anon key
npm run dev
```
