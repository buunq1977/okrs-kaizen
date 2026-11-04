# CLAUDE.md

Đọc `SPEC.md` (spec v3, chốt 04/11/2026) trước khi làm bất cứ việc gì. Spec là nguồn sự thật. Muốn đổi quy tắc trong spec phải hỏi Luca trước. Spec cũ: `docs/SPEC-v1.md`, `docs/SPEC-v2-luca.md` (chỉ để tham khảo).

## Cách làm việc với Luca
- Tiếng Việt, thẳng, ngắn. Giao diện app bằng tiếng Việt.
- Làm theo **Thứ tự xây** ở SPEC §17. **Xong mỗi trang thì dừng, báo Luca duyệt rồi mới làm trang tiếp.**
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
