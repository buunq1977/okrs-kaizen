-- 005: Spec v3, phần cho trang Ngày (và nền cho Tuần/Tháng).
-- Chạy trong Supabase SQL Editor sau 004. Giữ nguyên dữ liệu đã nhập: O của Ngày/Tuần được chuyển sang bảng objectives.

-- ---------- Tiêu điểm O tách khỏi periods (Tháng/Quý/Năm có 3 O theo 3 mảng) ----------
create table public.objectives (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id         uuid not null references public.periods(id) on delete cascade,
  area              text check (area in ('cv_tc','mqh','ttt')),   -- null = O duy nhất của Ngày/Tuần
  title             text not null default '',
  smart             jsonb not null default '{}'::jsonb,            -- S M A R T KRO
  o_metric          text not null default '',                      -- mô tả số đo O
  o_target          numeric,                                       -- đích số của O (nếu có)
  o_actual          numeric,                                       -- O thực tế (Kaizen bước 1)
  o_result          text check (o_result in ('dat','mot_phan','chua')),
  serves_kr_id      uuid references public.key_results(id) on delete set null,  -- O ngày phục vụ KR tuần
  serves_ka_id      uuid,                                          -- O ngày phục vụ KA tuần (FK thêm bên dưới)
  contributes_kr_id uuid references public.key_results(id) on delete set null,  -- O tuần đóng góp KR tháng
  weekly_target     numeric,
  weekly_actual     numeric,
  passive           boolean not null default false,
  sort              int not null default 0,
  created_at        timestamptz not null default now()
);
alter table public.objectives add constraint objectives_serves_ka_fk foreign key (serves_ka_id) references public.key_actions(id) on delete set null;
create unique index objectives_one_main on public.objectives (period_id) where area is null;
create unique index objectives_one_per_area on public.objectives (period_id, area) where area is not null;

insert into public.objectives (user_id, period_id, title, smart, o_metric)
select user_id, id, o_title, o_smart, o_metric from public.periods where kind in ('day','week');

alter table public.periods drop constraint if exists periods_link_reason;
alter table public.periods drop column o_title, drop column o_smart, drop column o_metric,
                           drop column linked, drop column link_reason, drop column goal_id;
alter table public.periods drop constraint periods_kind_check;
alter table public.periods add constraint periods_kind_check check (kind in ('day','week','month','quarter','year','kickoff'));
alter table public.periods add column end_date date;   -- dùng cho kỳ khởi động

-- Nhật ký Kaizen: {s,c,t} → danh sách dòng {time, did, result}
update public.periods
set kaizen = jsonb_set(kaizen, '{journal}', (
  select coalesce(jsonb_agg(jsonb_build_object('time', x.k, 'did', x.v, 'result', '')), '[]'::jsonb)
  from (values ('Sáng', kaizen->'journal'->>'s'), ('Chiều', kaizen->'journal'->>'c'), ('Tối', kaizen->'journal'->>'t')) as x(k, v)
  where coalesce(x.v, '') <> ''))
where jsonb_typeof(kaizen->'journal') = 'object';

-- ---------- KR gắn với O; bỏ cờ "liên quan" (C4) ----------
alter table public.key_results add column objective_id uuid references public.objectives(id) on delete cascade;
update public.key_results k set objective_id = o.id from public.objectives o where o.period_id = k.period_id and o.area is null;
alter table public.key_results drop constraint if exists kr_link_reason;
alter table public.key_results drop column linked, drop column link_reason;

-- ---------- Lịch: nhiều mục mỗi ô, loại mục, lời hứa chưa có giờ, lặp lại (C8) ----------
create table public.schedule_series (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rule       text not null check (rule in ('daily','weekly','monthly')),
  weekdays   int[] not null default '{}',        -- 1 = thứ Hai … 7 = Chủ nhật (rule = weekly)
  month_day  int check (month_day between 1 and 31),
  start_date date not null,
  end_date   date,
  time_from  time not null,
  time_to    time not null,
  title      text not null check (length(trim(title)) > 0),
  people     text not null default '',
  kind       text not null default 'viec' check (kind in ('viec','loi_hua','lich_hen')),
  fixed      boolean not null default false,
  kr_id      uuid references public.key_results(id) on delete set null,   -- gắn KR tháng (giai đoạn Tháng)
  increment  numeric not null default 1,
  created_at timestamptz not null default now(),
  constraint series_weekly check (rule <> 'weekly' or cardinality(weekdays) > 0),
  constraint series_monthly check (rule <> 'monthly' or month_day is not null),
  constraint series_range check (end_date is null or end_date >= start_date)
);
alter table public.schedule_items alter column time_from drop not null, alter column time_to drop not null;
alter table public.schedule_items
  add column kind      text not null default 'viec' check (kind in ('viec','loi_hua','lich_hen')),
  add column untimed   boolean not null default false,
  add column series_id uuid references public.schedule_series(id) on delete cascade,
  add column skipped   boolean not null default false;   -- bỏ riêng 1 lần của chuỗi lặp
alter table public.schedule_items add constraint schedule_timed check (untimed or time_from is not null);
create unique index schedule_one_override on public.schedule_items (series_id, date) where series_id is not null;

-- ---------- Quan sát mang sang (C13) ----------
alter table public.observations add column closed boolean not null default false,
                                add column carried_from uuid references public.observations(id) on delete set null;

-- ---------- Cài đặt v3 (§15) ----------
alter table public.settings
  drop column only_linked_pct, drop column show_both_pct, drop column link_pct, drop column day_min_linked_kr, drop column remind_time,
  add column remind_lead_min      int not null default 90 check (remind_lead_min between 15 and 240),  -- C20
  add column gap_suggest_pts      int not null default 30,
  add column ka_autotick          boolean not null default true,
  add column status_red           numeric not null default 70,
  add column status_green         numeric not null default 90,
  add column kr_min_cvtc          int not null default 3,
  add column kr_min_other         int not null default 1,
  add column kr_max_other         int not null default 2,
  add column max_open_kr          int not null default 7,
  add column lower_per_kr_quarter int not null default 1,
  add column stop_per_quarter     int not null default 1,
  add column change_cooldown_h    int not null default 48,
  add column trigger_lag_pct      numeric not null default 20,
  add column trigger_weeks        int not null default 2,
  add column trigger_quarter_pct  numeric not null default 30,
  add column default_tab          text not null default 'auto' check (default_tab in ('auto','okr','kaizen'));
alter table public.settings add constraint settings_status check (status_red < status_green);

-- ---------- RLS + quyền cho bảng mới ----------
do $$
declare t text;
begin
  foreach t in array array['objectives','schedule_series'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create index on public.objectives (period_id);
create index on public.key_results (objective_id);
create index on public.schedule_series (user_id, start_date);
create index on public.schedule_items (series_id);
