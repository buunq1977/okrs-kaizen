-- 007: Tháng / Quý / Năm / Kỳ khởi động, Tầm nhìn, Mô hình thu nhập, Kaizen số liệu, điều chỉnh có luật (SPEC v3 §8–§11).
-- Chạy sau 006. Không xoá dữ liệu cũ.

-- ---------- KR số (§4.3, §8.5) ----------
alter table public.key_results
  add column kind            text not null default 'tick' check (kind in ('tick','numeric')),
  add column parent_kr_id    uuid references public.key_results(id) on delete set null,   -- KR tháng → KR quý → KR năm
  add column baseline        numeric,
  add column target          numeric,
  add column unit            text not null default '',
  add column deadline        date,
  add column source          text not null default '',          -- nguồn đo
  add column leading_ind     jsonb not null default '[]'::jsonb, -- [{id, name, per_week, actuals: {weekStart: value}}]
  add column cumulative_plan jsonb not null default '[]'::jsonb, -- [{date, planned}] phần tăng cộng dồn so với điểm bắt đầu
  add column milestones      jsonb not null default '[]'::jsonb, -- KR năm: [{q, value}] giá trị tuyệt đối cuối mỗi quý
  add column income_model_id uuid,
  add column is_team         boolean not null default false,      -- KR đội ngũ tự vận hành / đòn bẩy
  add column is_coef         boolean not null default false,      -- KR "đo hệ số"
  add column series_id       uuid references public.schedule_series(id) on delete set null,  -- đếm từ lịch lặp lại
  add column orig_target     numeric,                             -- bản gốc khi chốt
  add column orig_deadline   date,
  add column status          text not null default 'active' check (status in ('active','paused','stopped'));

-- Thực tế KR số: mỗi dòng là phần tăng thêm vào ngày đó
create table public.kr_actuals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kr_id      uuid not null references public.key_results(id) on delete cascade,
  date       date not null,
  value      numeric not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Điều chỉnh kế hoạch có luật (§11.4, §11.5) ----------
create table public.plan_changes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kr_id       uuid references public.key_results(id) on delete cascade,
  period_id   uuid references public.periods(id) on delete cascade,
  type        text not null check (type in ('add','raise','method','lower','cut','stop','pause')),
  before      jsonb not null default '{}'::jsonb,
  after       jsonb not null default '{}'::jsonb,
  reason      text not null check (length(trim(reason)) > 0),
  cause_group text check (cause_group in ('a','b','c','d')),
  evidence    text not null default '',
  mentor      text not null default '',
  status      text not null default 'applied' check (status in ('pending','applied','cancelled')),
  apply_at    timestamptz,
  applied_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint change_lower_rule check (type not in ('lower','cut') or cause_group in ('b','c','d'))
);

-- ---------- Mô hình thu nhập (§9) ----------
create table public.income_models (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                text not null default '',
  currency            text not null default 'USD',
  target_income_month numeric,
  fx_rate             numeric,
  fx_updated_at       date,
  value_per_unit      numeric,
  unit_name           text not null default 'người hoạt động',
  retention           numeric,          -- 0–1, null = 1
  stages              jsonb not null default '[]'::jsonb,   -- [{id, name, conversion}] từ trên xuống; conversion = tỷ lệ sang bước sau (0–1)
  working_days_week   numeric not null default 5,
  capacity_per_day    numeric,
  unknown             jsonb not null default '{}'::jsonb,   -- {field: true} hệ số chưa đo
  prev_year_income    numeric,
  created_at          timestamptz not null default now()
);
alter table public.key_results add constraint kr_income_model_fk foreign key (income_model_id) references public.income_models(id) on delete set null;

-- ---------- Tầm nhìn (§8.2) ----------
create table public.vision_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year_no      int not null check (year_no between 1 and 10),
  goal         text not null default '',
  verification text not null default '',
  created_at   timestamptz not null default now(),
  unique (user_id, year_no)
);
alter table public.settings add column vision_start date;   -- ngày bắt đầu Năm 1

-- ---------- Sự kiện & mốc quan trọng (C7) ----------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id    uuid references public.periods(id) on delete cascade,
  date         date not null,
  time         time,
  title        text not null check (length(trim(title)) > 0),
  people       text not null default '',
  kind         text not null default 'su_kien' check (kind in ('lich_hen','deadline','su_kien','loi_hua')),
  objective_id uuid references public.objectives(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------- Dự án trọng tâm (Quý) + lý do bỏ buổi rà ----------
alter table public.periods add column projects jsonb not null default '[]'::jsonb;   -- [{id, title}] tối đa 2

-- ---------- RLS + quyền ----------
do $$
declare t text;
begin
  foreach t in array array['kr_actuals','plan_changes','income_models','vision_items','events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create index on public.kr_actuals (kr_id, date);
create index on public.plan_changes (kr_id);
create index on public.events (user_id, date);
create index on public.key_results (parent_kr_id);
