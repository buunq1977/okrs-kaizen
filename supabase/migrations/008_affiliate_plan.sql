-- 008: Mô hình thu nhập Affiliate Global (Vật lý + SaaS), bảng phân bổ theo tháng.
-- Chạy sau 007. Mỗi file chỉ chạy một lần.

-- Cấu hình chung + hệ số mặc định (1 dòng / người dùng).
-- Chỉ sửa được ở đầu kỳ (app kiểm tra), trừ lần thiết lập đầu tiên.
create table public.aff_config (
  user_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  year_goal          numeric not null default 16000,        -- lợi nhuận ròng sau ads / tháng
  goal_month         date not null default '2027-12-01',
  base_budget        numeric not null default 200,          -- ngân sách test tối thiểu / tháng
  reinvest_pct       numeric not null default 50,           -- % lợi nhuận đã nhận tháng trước cộng vào ngân sách test
  test_cap_mult      numeric not null default 2,            -- trần mở rộng test 1 dự án = × chi phí test mặc định
  edit_days          int not null default 3,                -- số ngày đầu tháng được sửa kế hoạch
  cap_tests_week     numeric not null default 15,           -- công suất test / tuần (một người)
  working_days_week  numeric not null default 7,
  reg_per_test       numeric not null default 2,            -- số đăng ký cho mỗi test
  research_per_test  numeric not null default 5,            -- số research cho mỗi test
  phys               jsonb not null default '{}'::jsonb,     -- hệ số Vật lý
  saas               jsonb not null default '{}'::jsonb,     -- hệ số SaaS
  updated_at         timestamptz not null default now(),
  constraint aff_config_pos check (year_goal >= 0 and base_budget >= 0 and reinvest_pct between 0 and 100
    and test_cap_mult >= 1 and edit_days between 1 and 10 and cap_tests_week > 0
    and working_days_week between 1 and 7 and reg_per_test > 0 and research_per_test > 0)
);

-- Bảng phân bổ: mỗi tháng một dòng. Chốt tháng thì lưu bản chụp hệ số (coeffs).
create table public.aff_months (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month          date not null check (extract(day from month) = 1),
  share_phys     numeric not null default 100 check (share_phys between 0 and 100),  -- % công sức + ngân sách test cho Vật lý
  budget_test    numeric not null default 200 check (budget_test >= 0),
  season         numeric not null default 1 check (season > 0),                       -- hệ số mùa vụ Vật lý
  profit_target  numeric not null default 0 check (profit_target >= 0),                -- lợi nhuận ròng mục tiêu của tháng
  coeffs         jsonb,                                                                -- {phys, saas} lúc chốt
  locked_at      timestamptz,
  note           text not null default '',
  created_at     timestamptz not null default now(),
  unique (user_id, month)
);

do $$
declare t text;
begin
  foreach t in array array['aff_config','aff_months'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
