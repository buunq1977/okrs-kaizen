-- 004: OKR + Kaizen v2 theo SPEC.md (OKR_KAIZEN_APP_SPEC).
-- Chạy 1 lần trong Supabase SQL Editor, sau 001–003.
-- XOÁ các bảng kế hoạch cũ (Luca xác nhận chưa có dữ liệu, 03/11/2026).
-- GIỮ: visions, goals, metrics (tầm nhìn 5 năm + tối đa 5 mục tiêu ưu tiên, §17 D1).

drop table if exists public.tasks, public.krs, public.actions, public.periods, public.settings cascade;
drop function if exists public.enforce_max_daily_tasks() cascade;

-- ---------- Kỳ: ngày / tuần / tháng / năm, kèm tiêu điểm O và Kaizen ----------
create table public.periods (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('day','week','month','year')),
  start_date        date not null,
  status            text not null default 'draft' check (status in ('draft','locked')),
  locked_at         timestamptz,
  lock_reason       text,                                   -- lý do chốt khi chưa đủ tiêu chí (§4.4)
  unlocks           jsonb not null default '[]'::jsonb,     -- [{at, reason}] mở khoá có lý do (§17 D2)
  o_title           text not null default '',
  o_smart           jsonb not null default '{}'::jsonb,     -- S M A R T KRO
  o_metric          text not null default '',
  linked            boolean not null default false,         -- O này liên quan O cấp trên
  link_reason       text not null default '',
  goal_id           uuid references public.goals(id) on delete set null,  -- tháng/năm: mục tiêu ưu tiên
  no_fixed_schedule boolean not null default false,
  kaizen            jsonb not null default '{}'::jsonb,     -- đo lường, nhật ký, nguyên nhân, từ khoá, bài học, tự kiểm
  created_at        timestamptz not null default now(),
  unique (user_id, kind, start_date),
  constraint periods_week_monday check (kind <> 'week' or extract(isodow from start_date) = 1),
  constraint periods_month_first check (kind <> 'month' or extract(day from start_date) = 1),
  constraint periods_year_first  check (kind <> 'year' or (extract(month from start_date) = 1 and extract(day from start_date) = 1)),
  constraint periods_link_reason check (not linked or length(trim(link_reason)) > 0)   -- §3: liên quan phải có lý do
);

-- ---------- KR ----------
create table public.key_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id       uuid not null references public.periods(id) on delete cascade,
  title           text not null default '',
  metric          text not null default '',
  smart           jsonb not null default '{}'::jsonb,
  linked          boolean not null default false,          -- liên quan trực tiếp O của kỳ
  link_reason     text not null default '',
  weight          numeric check (weight is null or weight > 0),
  pct_override    numeric check (pct_override is null or pct_override between 0 and 100),
  override_reason text,
  from_action_id  uuid,                                    -- tạo từ hành động Kaizen kỳ trước
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  constraint kr_link_reason check (not linked or length(trim(link_reason)) > 0),
  constraint kr_override_reason check (pct_override is null or length(trim(coalesce(override_reason,''))) > 0)
);

-- ---------- KA ----------
create table public.key_actions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kr_id          uuid not null references public.key_results(id) on delete cascade,
  title          text not null check (length(trim(title)) > 0),
  done           boolean not null default false,
  weight         numeric check (weight is null or weight > 0),
  from_action_id uuid,
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- 1a. Lịch cố định & cam kết ----------
create table public.schedule_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id  uuid not null references public.periods(id) on delete cascade,
  date       date not null,
  time_from  time not null,
  time_to    time not null,
  title      text not null default '',
  people     text not null default '',
  fixed      boolean not null default false,   -- tô vàng: không dời được
  done       boolean not null default false,
  kr_id      uuid references public.key_results(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- 1b. Quan sát + 2. Phân tích + 3. Nguyên nhân lõi ----------
create table public.observations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id     uuid not null references public.periods(id) on delete cascade,
  category      text not null check (category in ('work_finance','relationship','body_mind_wisdom')),
  content       text not null default '',
  consequence   text not null default '',     -- "Nếu không làm thì sao?"
  is_selected   boolean not null default false, -- tô đậm ở bước Phân tích
  tham          text not null default '',
  san           text not null default '',
  si            text not null default '',
  cause_note    text not null default '',
  resolve_check boolean not null default false, -- "Giải quyết nguyên nhân này, vấn đề có hết không?"
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- Kaizen 4. Hành động tiếp theo ----------
create table public.next_actions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id           uuid not null references public.periods(id) on delete cascade,
  text                text not null default '',
  smart               jsonb not null default '{}'::jsonb,   -- S M A R T NEXT
  converted_period_id uuid references public.periods(id) on delete set null,
  converted_kr_id     uuid references public.key_results(id) on delete set null,
  converted_ka_id     uuid references public.key_actions(id) on delete set null,
  sort                int not null default 0,
  created_at          timestamptz not null default now()
);

-- ---------- Kiểm chứng 3 chiều (tuần/tháng, dùng ở giai đoạn sau) ----------
create table public.validations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id  uuid not null references public.periods(id) on delete cascade,
  direction  text not null check (direction in ('top_down','cross','bottom_up')),
  person     text not null default '',
  asked      boolean not null default false,
  smart      jsonb not null default '{}'::jsonb,
  note       text not null default '',
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Cài đặt (mọi ngưỡng §12) ----------
create table public.settings (
  user_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  red_below          numeric not null default 50,   -- < 50% đỏ
  pass_pct           numeric not null default 80,   -- ≥ 80% xanh, ngưỡng "đạt"
  only_linked_pct    boolean not null default true, -- chỉ tính phần liên quan O
  show_both_pct      boolean not null default true, -- hiện "% mục tiêu" và "% tổng"
  weights_enabled    boolean not null default false,
  link_pct           numeric not null default 60,   -- quy tắc 60% (tuần/tháng/năm)
  day_min_linked_kr  int not null default 1,
  day_min_kr         int not null default 3,
  day_max_kr         int not null default 4,
  max_daily_actions  int not null default 3,
  day_start          time not null default '04:30',
  day_end            time not null default '22:30',
  slot_minutes       int not null default 30 check (slot_minutes in (30, 60)),
  auto_lock          boolean not null default true,
  lock_time          time not null default '22:00',
  red_lock           boolean not null default true,
  red_streak         int not null default 2 check (red_streak between 1 and 7),
  rest_weekdays      int[] not null default '{}',   -- 1 = thứ Hai … 7 = Chủ nhật
  remind_time        time not null default '20:00',
  year_mode          text not null default 'month' check (year_mode in ('month','quarter')),
  timezone           text not null default 'Asia/Ho_Chi_Minh',
  updated_at         timestamptz not null default now(),
  constraint settings_thresholds check (red_below < pass_pct and red_below >= 0 and pass_pct <= 100),
  constraint settings_kr_range check (day_min_kr >= 1 and day_max_kr >= day_min_kr)
);

-- ---------- RLS + quyền ----------
do $$
declare t text;
begin
  foreach t in array array['periods','key_results','key_actions','schedule_items','observations','next_actions','validations','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid()))
                    with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
grant select on public.settings to anon;  -- chỉ cho workflow keepalive; không có policy cho anon nên luôn rỗng

-- ---------- Index ----------
create index on public.periods        (user_id, kind, start_date);
create index on public.key_results    (period_id);
create index on public.key_actions    (kr_id);
create index on public.schedule_items (period_id);
create index on public.observations   (period_id);
create index on public.next_actions   (period_id);
create index on public.validations    (period_id);
