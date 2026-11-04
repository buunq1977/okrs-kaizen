-- 006: Trang Tuần (SPEC v3 §3.1, §7). Chạy sau 005.
-- KA tuần tự tick khi O ngày phục vụ nó đạt ngưỡng; đánh dấu để không tick lại sau khi người dùng bỏ tick tay.
alter table public.key_actions add column auto_ticked boolean not null default false;
