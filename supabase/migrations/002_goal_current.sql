-- 002: giá trị hiện tại của mục tiêu năm (chỉ số kết quả, cập nhật tay)
-- Chạy trong Supabase SQL Editor sau 001_init.sql.
alter table public.goals add column if not exists current numeric;
update public.goals set current = baseline where current is null;
alter table public.goals alter column current set not null;
alter table public.goals alter column current set default 0;
