# CLAUDE.md

Đọc `SPEC.md` (**SPEC v0**, bản gốc chốt 19/11/2026) trước khi làm bất cứ việc gì. Spec là nguồn sự thật, chỉ có một file. Muốn đổi quy tắc phải hỏi Luca trước; đổi xong sửa thẳng mục đó trong `SPEC.md` và thêm 1 dòng ở §20 (v0.1, v0.2…). Không tạo file spec mới.

Tài liệu kèm: `docs/MO-HINH-AFFILIATE.md` (mô hình Affiliate, chi tiết SPEC §9) · `docs/HUONG-DAN.md` (hướng dẫn dùng; app hiện nguyên file này ở **Thêm → Hướng dẫn**). Đổi giao diện hay quy tắc thì cập nhật hai file này cùng lúc.

## Cách làm việc với Luca
- Tiếng Việt, thẳng, ngắn. Giao diện app bằng tiếng Việt.
- Mỗi yêu cầu: phản biện, đề xuất → Luca duyệt → làm, kiểm tra, báo. **Xong mỗi phần thì dừng, báo Luca duyệt; chỉ push khi Luca bảo.**
- Phản biện khi yêu cầu mâu thuẫn spec hoặc có rủi ro; đưa 1 đề xuất rõ ràng.
- Hỏi trước khi làm việc có tác động ngoài repo: tạo tài khoản, đổi cài đặt GitHub/Supabase, xoá dữ liệu.
- Cuối mỗi lần làm: liệt kê file tạo/sửa/xoá và file SQL Luca cần chạy.

## Kỹ thuật
- React + Vite + TypeScript · Supabase (email + mật khẩu, RLS) · GitHub Pages (repo public, deploy khi push `main`).
- Mọi ngưỡng ở SPEC §15 nằm trong bảng `settings`, không hard-code.
- Logic tính tách ở `src/lib/okr.ts` (và file `src/lib/*.ts` thuần khác), có test `*.test.ts`. Sửa logic thì sửa test; chạy `npm test` trước khi push (CI cũng chạy).
- Migration: `supabase/migrations/NNN_*.sql`, chạy thử trên Postgres cục bộ trước khi giao. Luca tự chạy trong Supabase SQL Editor; nhắc rõ khi có file mới.
- Mọi bảng mới: bật RLS (`user_id = auth.uid()`) và `grant ... to authenticated`.
- Không commit secret. Supabase URL và anon key nằm trong GitHub Secrets.
