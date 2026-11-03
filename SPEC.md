# OKRs Kaizen — Spec v0.1

Ứng dụng lập và giữ kỷ luật mục tiêu cá nhân cho người làm tự do. Mục tiêu phân tầng 5 năm → năm → tháng → tuần → ngày. Mỗi ngày có một con số cụ thể phải đạt, và app đòi đạt con số đó.

Trạng thái: **bản nháp chờ Luca duyệt**. Mọi ngưỡng ghi `[Assumption]` chỉnh được trong Cài đặt.

---

## 1. Vấn đề cần giải

- Làm tự do, tự chủ thời gian → dễ sao nhãng, trì trệ, mục tiêu không xong.
- Bảng Excel cũ là form ghi chép: không có cơ chế báo chậm, không có ai đòi.
- App phải trả lời 3 câu mỗi ngày: **Hôm nay phải làm con số nào? Mình đang nhanh hay chậm so với tiến độ? Nếu chậm, vì sao và sửa gì?**

## 2. Nguyên tắc cứng

| # | Quy tắc | App thực thi thế nào |
|---|---|---|
| R1 | Tối đa **5 mục tiêu năm** đang mở | Nút thêm bị khoá khi đủ 5. Muốn thêm → phải chọn 1 mục tiêu để *Tạm dừng* hoặc *Bỏ* (có lý do) |
| R2 | Mỗi tháng chỉ **1–3 mục tiêu được kích hoạt** xuống tuần/ngày | Chọn khi lập kế hoạch tháng; mục tiêu không kích hoạt vẫn hiển thị nhưng không sinh việc |
| R3 | Mọi mục tiêu và KR **phải có con số** | Form bắt buộc: baseline, target, đơn vị, hạn chót. Không lưu được nếu thiếu. Không dùng đoán chữ |
| R4 | Mỗi mục tiêu năm có **≥ 1 chỉ số hành động** (leading) | Ví dụ: "campaign launch/tuần", "keyword research/ngày". Ngày được chấm theo chỉ số này |
| R5 | Ngày: **1 tiêu điểm + tối đa 3 việc bắt buộc**, mỗi việc gắn vào 1 KR tuần | Việc không gắn → nhãn "ngoài mục tiêu", không tính % |
| R6 | Kế hoạch ngày mai chốt trước **22:00** `[Assumption]` | Sau giờ chốt, kế hoạch khoá; sửa phải ghi lý do |
| R7 | Check-in cuối ngày bắt buộc | Ngày chưa check-in hiển thị xám ở mọi tầng, không được coi là 0% âm thầm |
| R8 | Đỏ **2 ngày liền** `[Assumption]` → khoá thêm việc mới đến khi viết xong Kaizen | |

## 3. Mô hình phân tầng

```
Vision (5 năm)        1–3      con số + năm đích
 └─ Goal (năm)        ≤ 5      baseline, target, unit, deadline, ≥1 leading metric
     └─ Monthly KR    theo 1–3 goal kích hoạt   target tháng (gợi ý = chia đều phần còn lại, sửa được)
         └─ Weekly KR                            target tuần + kiểm chứng 3 chiều
             └─ Daily  1 tiêu điểm + ≤3 việc     mỗi việc có con số (VD: 2 campaign, 40 keyword)
```

Khối **Kaizen** giữ như template ở mọi tầng: Đo lường → Nguyên nhân (nhật ký Sáng/Chiều/Tối + nguyên nhân %) → Bài học → Hành động tiếp theo (SMART + "đưa vào kỳ sau").

Khối **Quan sát** giữ ở tầng tháng/tuần: Công việc/Tài chính · Mối quan hệ · Thân–Tâm–Trí · Phân tích · Nguyên nhân lõi (Tham / Si).

## 4. Đo tiến độ

- **Giá trị thực tế** của KR = tổng số liệu check-in các ngày bên dưới (VD: cộng số campaign đã launch). Không dùng % tick ô như bản cũ.
- **Đường tiến độ cần đạt (pace):** tuyến tính từ baseline đến target theo số ngày làm việc. Cho phép chọn ngày nghỉ trong tuần.
- **Trạng thái:** Xanh ≥ 100% pace · Vàng 80–99% · Đỏ < 80% `[Assumption]`.
- % hoàn thành tầng trên = trung bình có trọng số các KR con (mặc định trọng số bằng nhau).

## 5. Màn hình (v1)

1. **Hôm nay** (màn mở mặc định): tiêu điểm, 3 việc có con số, ô nhập số thực tế, trạng thái pace của từng mục tiêu kích hoạt, nút Check-in.
2. **Lập kế hoạch ngày mai**: kéo từ KR tuần, đồng hồ đếm đến giờ chốt.
3. **Tuần**: KR tuần, lưới lịch Sáng/Chiều/Tối, kiểm chứng 3 chiều, Kaizen tuần, biểu đồ % từng ngày.
4. **Tháng**: chọn 1–3 goal kích hoạt, KR tháng, Quan sát, Kaizen tháng.
5. **Mục tiêu**: Vision 5 năm + 5 ô Goal năm, nút Tạm dừng/Bỏ/Thay.
6. **Cài đặt**: giờ chốt, ngưỡng màu, ngày nghỉ, xuất/nhập JSON.

## 6. Kỹ thuật

| Phần | Chọn | Ghi chú |
|---|---|---|
| Frontend | React + Vite + TypeScript | PWA để cài lên điện thoại |
| Host | GitHub Pages | Deploy bằng GitHub Actions khi push `main`. Repo **public** (Pages miễn phí chỉ cho repo public, quyết định 03/11/2026). Code công khai; dữ liệu được bảo vệ bằng đăng nhập + RLS |
| Dữ liệu + đăng nhập | Supabase (gói Free) | Postgres + Auth (magic link email). Row Level Security: mỗi user chỉ đọc/ghi dữ liệu của mình |
| Sao lưu | GitHub Action chạy hằng ngày | Gọi API → lưu JSON vào **repo private riêng** (repo app đã public, không được lưu dữ liệu vào đây). Đồng thời giữ Supabase không bị pause |

### Ràng buộc gói Free Supabase [Verified 03/11/2026, supabase.com/pricing]

- 500 MB database/project, 5 GB egress, 50.000 MAU, tối đa 2 project active.
- **Pause sau 7 ngày không hoạt động**; khôi phục được trong 1 năm, dữ liệu giữ nguyên.
- **Không có backup tự động** → bắt buộc có backup riêng (mục trên).

Ước tính dung lượng [Estimated]: ~5–10 KB/ngày → dưới 5 MB/năm. 500 MB dư cho hàng chục năm.

## 7. Bảng dữ liệu (phác thảo)

- `visions(id, title, target_value, unit, target_year)`
- `goals(id, vision_id, title, baseline, target, unit, deadline, status[active|paused|dropped], drop_reason)`
- `metrics(id, goal_id, name, unit, kind[leading|lagging])`
- `periods(id, kind[month|week|day], start_date, focus_title, locked_at, checked_in_at, kaizen jsonb, observe jsonb)`
- `krs(id, period_id, goal_id, parent_kr_id, metric_id, title, target, smart jsonb)`
- `tasks(id, period_id, kr_id, title, target, unit, actual)` — việc trong ngày, số thực tế nhập khi check-in. Giá trị thực tế của KR = tổng `actual` các việc gắn vào nó
- `actions(id, period_id, text, smart jsonb, push_to_period_id, done)`
- `settings(user_id, lock_time, green_pct, yellow_pct, red_streak, rest_weekdays, timezone)`

Schema thật: `supabase/migrations/001_init.sql`. Quy tắc R1 (≤5 mục tiêu mở), R2 (≤3 kích hoạt/tháng), R3 (bắt buộc con số), R5 (≤3 việc gắn mục tiêu/ngày) được chặn ngay ở database, không chỉ ở giao diện.

## 8. Ngoài phạm vi v1

Thông báo đẩy (push notification), nhắc qua Telegram/email, chia sẻ cho mentor xem, nhập dữ liệu từ bản artifact cũ. Ghi lại để làm v2.

## 9. Lộ trình build

1. Khởi tạo repo, CI deploy GitHub Pages (trang trống chạy được).
2. Supabase schema + RLS + đăng nhập.
3. Mục tiêu (Vision/Goal) với rule R1, R3, R4.
4. Tháng → Tuần → Ngày, check-in, pace.
5. Kaizen + đẩy hành động sang kỳ sau.
6. Khoá giờ chốt (R6–R8), sao lưu hằng ngày.
