-- 010: Đếm số dự án đã search theo ngày (không cần nhập tên/link từng dự án).
-- Dự án chỉ được ghi vào Sổ dự án từ bước "Đã chọn" (đủ điều kiện, sẽ đăng ký).
-- Chạy sau 009. Mỗi file chỉ chạy một lần.

create table public.aff_tallies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  kind        text not null default 'search' check (kind in ('search')),
  model       text not null default 'phys' check (model in ('phys','saas')),
  count       int not null default 0 check (count >= 0),
  created_at  timestamptz not null default now(),
  unique (user_id, date, kind, model)
);

alter table public.aff_tallies enable row level security;
create policy "own rows" on public.aff_tallies for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.aff_tallies to authenticated;
