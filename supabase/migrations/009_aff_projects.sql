-- 009: Sổ dự án Affiliate (Vật lý + SaaS) + số liệu theo đợt nhập.
-- Chạy sau 008. Mỗi file chỉ chạy một lần.

alter table public.aff_config add column win_min_orders int not null default 3 check (win_min_orders >= 1);

create table public.aff_projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  link         text not null default '',
  model        text not null default 'phys' check (model in ('phys','saas')),
  network      text not null default '',
  niche        text not null default '',
  geo          text not null default '',
  stage        text not null default 'research'
               check (stage in ('research','dat_loc','dang_ky','duoc_duyet','test','win','dung')),
  dates        jsonb not null default '{}'::jsonb,   -- {giai đoạn: 'YYYY-MM-DD'} ngày vào từng giai đoạn
  op_status    text check (op_status in ('scale','duy_tri','theo_doi','dung')),
  ext_reason   text not null default '',             -- lý do mở rộng test (trần × test_cap_mult)
  stop_reason  text not null default '',
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create index aff_projects_user_stage on public.aff_projects(user_id, stage);

-- Mỗi lần nhập số (theo tuần hoặc theo đợt): cộng dồn ra tổng của dự án.
create table public.aff_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id   uuid not null references public.aff_projects(id) on delete cascade,
  date         date not null,
  cost         numeric not null default 0 check (cost >= 0),       -- Chi phí ads
  revenue      numeric not null default 0 check (revenue >= 0),    -- Doanh số (hoa hồng ghi nhận)
  received     numeric not null default 0 check (received >= 0),   -- Thực nhận (network đã trả)
  orders       numeric not null default 0 check (orders >= 0),     -- Số đơn
  refs         numeric not null default 0 check (refs >= 0),       -- SaaS: đăng ký dùng thử
  customers    numeric not null default 0 check (customers >= 0),  -- SaaS: khách trả tiền mới
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create index aff_entries_project on public.aff_entries(project_id, date);

do $$
declare t text;
begin
  foreach t in array array['aff_projects','aff_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
