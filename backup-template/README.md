# Sao lưu tự động hằng ngày

Repo `okrs-kaizen` là public, nên bản sao lưu **không** được lưu ở đây. Làm như sau:

1. Tạo repo **private** mới, ví dụ `okrs-kaizen-backup`.
2. Copy 2 file trong thư mục này sang repo mới, giữ đúng đường dẫn:
   - `backup.mjs` → `backup.mjs`
   - `backup.yml` → `.github/workflows/backup.yml`
3. Trong repo private đó: **Settings → Secrets and variables → Actions**, thêm:
   - `SUPABASE_URL`: Project URL của Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API → `service_role`
4. Vào tab **Actions → Daily backup → Run workflow** để chạy thử. File `backups/YYYY-MM-DD.json` sẽ xuất hiện trong repo.

⚠️ `service_role` key bỏ qua mọi RLS, đọc được toàn bộ dữ liệu. **Chỉ** đặt nó trong secret của repo private, không bao giờ đặt vào repo `okrs-kaizen` hay gửi cho ai.

Bản sao lưu giữ 60 ngày gần nhất, cũ hơn tự xoá.
