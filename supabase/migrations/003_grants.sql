-- 003: cấp quyền cho người đã đăng nhập dùng các bảng của app.
-- RLS vẫn đang bật: mỗi người chỉ thấy và sửa được dòng của chính mình.
-- Chạy trong Supabase SQL Editor sau 001 và 002.

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on
  public.visions, public.goals, public.metrics, public.periods,
  public.krs, public.tasks, public.actions, public.settings
to authenticated;

-- Chỉ để workflow keepalive gọi vào database mỗi ngày.
-- Không có policy nào cho anon nên kết quả luôn rỗng, không lộ dữ liệu.
grant select on public.settings to anon;
