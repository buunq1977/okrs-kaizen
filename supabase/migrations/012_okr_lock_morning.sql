-- 012: OKR ngày D chốt trước 08:00 ngày D (trước: 22:00 ngày D-1).
-- lock_time (22:00) giờ là hạn chốt Kaizen ngày D. Chạy sau 011.
alter table public.settings add column okr_lock_time time not null default '08:00';
