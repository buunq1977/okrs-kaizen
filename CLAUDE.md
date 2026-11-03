# CLAUDE.md

Đọc `SPEC.md` trước khi làm bất cứ việc gì. Spec là nguồn sự thật; mục §17 là quyết định đã chốt với Luca. Muốn đổi quy tắc trong spec phải hỏi Luca.

- Giao tiếp với Luca bằng tiếng Việt, thẳng, ngắn. Giao diện app bằng tiếng Việt.
- Stack: React + Vite + TypeScript, Supabase, GitHub Pages (repo public).
- Mọi ngưỡng ở §12 là cài đặt trong bảng `settings`, không hard-code.
- Logic % và quy tắc nằm ở `src/lib/okr.ts`, có test ở `src/lib/okr.test.ts`. Sửa logic thì sửa test, chạy `npm test`.
- Không commit secret. Supabase URL và anon key để trong GitHub Secrets.
- Mọi bảng Supabase phải bật Row Level Security và cấp quyền cho `authenticated`.
- Migration mới đặt ở `supabase/migrations/NNN_*.sql`; Luca tự chạy trong SQL Editor, nhắc rõ khi có file mới.
- Hỏi trước khi làm việc có tác động ngoài repo: tạo tài khoản, đổi cài đặt GitHub/Supabase, xoá dữ liệu.
- Làm theo thứ tự §13 và §17 D5; xong mỗi giai đoạn thì báo và chờ duyệt.
