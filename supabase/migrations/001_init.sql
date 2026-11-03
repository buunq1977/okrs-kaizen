-- OKRs Kaizen — schema v1
-- Chạy 1 lần trong Supabase: SQL Editor → New query → dán toàn bộ file → Run.
-- Mọi bảng bật Row Level Security: mỗi người chỉ đọc/ghi được dòng của chính mình.

create extension if not exists pgcrypto;

-- ---------- Tầm nhìn 5 năm ----------
create table public.visions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  target_value numeric not null,                       -- R3: bắt buộc có con số
  unit         text not null check (length(trim(unit)) > 0),
  target_year  int  not null check (target_year between 2026 and 2100),
  created_at   timestamptz not null default now()
);

-- ---------- Mục tiêu năm ----------
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vision_id   uuid references public.visions(id) on delete set null,
  title       text not null check (length(trim(title)) > 0),
  baseline    numeric not null default 0,
  target      numeric not null,                        -- R3
  unit        text not null check (length(trim(unit)) > 0),
  deadline    date not null,
  status      text not null default 'active' check (status in ('active','paused','dropped','done')),
  drop_reason text,
  created_at  timestamptz not null default now(),
  constraint goals_drop_needs_reason check (status <> 'dropped' or length(trim(coalesce(drop_reason,''))) > 0),
  constraint goals_target_differs check (target <> baseline)
);

-- R1: tối đa 5 mục tiêu năm đang mở
create or replace function public.enforce_max_active_goals() returns trigger
language plpgsql as $$
begin
  if new.status = 'active' and (
    select count(*) from public.goals
    where user_id = new.user_id and status = 'active' and id <> new.id
  ) >= 5 then
    raise exception 'Đã đủ 5 mục tiêu đang mở. Tạm dừng hoặc bỏ một mục tiêu trước khi thêm.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger goals_max_active
  before insert or update of status on public.goals
  for each row execute function public.enforce_max_active_goals();

-- ---------- Chỉ số (leading / lagging) ----------
create table public.metrics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id    uuid not null references public.goals(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  unit       text not null check (length(trim(unit)) > 0),
  kind       text not null check (kind in ('leading','lagging')),
  created_at timestamptz not null default now()
);

-- ---------- Kỳ: tháng / tuần / ngày ----------
create table public.periods (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind               text not null check (kind in ('month','week','day')),
  start_date         date not null,                    -- tháng: ngày 1; tuần: thứ Hai; ngày: chính ngày đó
  focus_title        text,
  focus_smart        jsonb not null default '{}'::jsonb,
  activated_goal_ids uuid[] not null default '{}',     -- chỉ dùng cho tháng
  observe            jsonb not null default '{}'::jsonb, -- Quan sát 3 mảng, phân tích, nguyên nhân lõi
  kaizen             jsonb not null default '{}'::jsonb, -- nhật ký, nguyên nhân %, bài học
  locked_at          timestamptz,                      -- R6: thời điểm chốt kế hoạch
  checked_in_at      timestamptz,                      -- R7: check-in cuối ngày
  created_at         timestamptz not null default now(),
  unique (user_id, kind, start_date),
  constraint periods_max_3_active check (cardinality(activated_goal_ids) <= 3),  -- R2
  constraint periods_week_monday check (kind <> 'week' or extract(isodow from start_date) = 1),
  constraint periods_month_first check (kind <> 'month' or extract(day from start_date) = 1)
);

-- ---------- KR tháng / tuần ----------
create table public.krs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id    uuid not null references public.periods(id) on delete cascade,
  goal_id      uuid not null references public.goals(id) on delete cascade,
  parent_kr_id uuid references public.krs(id) on delete set null,   -- KR tuần → KR tháng
  metric_id    uuid references public.metrics(id) on delete set null,
  title        text not null check (length(trim(title)) > 0),
  target       numeric not null check (target > 0),                -- R3
  unit         text not null check (length(trim(unit)) > 0),
  smart        jsonb not null default '{}'::jsonb,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------- Việc trong ngày (tối đa 3) ----------
create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id  uuid not null references public.periods(id) on delete cascade,  -- kỳ ngày
  kr_id      uuid references public.krs(id) on delete set null,             -- null = "ngoài mục tiêu"
  title      text not null check (length(trim(title)) > 0),
  target     numeric not null check (target > 0),                           -- R3: việc cũng có con số
  unit       text not null check (length(trim(unit)) > 0),
  actual     numeric,                                                       -- nhập khi check-in
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- R5: tối đa 3 việc gắn mục tiêu mỗi ngày (việc "ngoài mục tiêu" không tính)
create or replace function public.enforce_max_daily_tasks() returns trigger
language plpgsql as $$
begin
  if new.kr_id is not null and (
    select count(*) from public.tasks
    where period_id = new.period_id and kr_id is not null and id <> new.id
  ) >= 3 then
    raise exception 'Mỗi ngày tối đa 3 việc gắn mục tiêu.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger tasks_max_daily
  before insert or update of kr_id, period_id on public.tasks
  for each row execute function public.enforce_max_daily_tasks();

-- ---------- Hành động tiếp theo (Kaizen) ----------
create table public.actions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id         uuid not null references public.periods(id) on delete cascade,
  text              text not null check (length(trim(text)) > 0),
  smart             jsonb not null default '{}'::jsonb,
  push_to_period_id uuid references public.periods(id) on delete set null,
  done              boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------- Cài đặt ----------
create table public.settings (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  lock_time      time    not null default '22:00',   -- R6
  green_pct      numeric not null default 100,
  yellow_pct     numeric not null default 80,
  red_streak     int     not null default 2,         -- R8
  rest_weekdays  int[]   not null default '{}',      -- 1 = thứ Hai … 7 = Chủ nhật
  timezone       text    not null default 'Asia/Ho_Chi_Minh',
  updated_at     timestamptz not null default now()
);

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['visions','goals','metrics','periods','krs','tasks','actions','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid()))
                    with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------- Index ----------
create index on public.goals   (user_id, status);
create index on public.periods (user_id, kind, start_date);
create index on public.krs     (period_id);
create index on public.krs     (parent_kr_id);
create index on public.tasks   (period_id);
create index on public.tasks   (kr_id);
create index on public.actions (period_id);
