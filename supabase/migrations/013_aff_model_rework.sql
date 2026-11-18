-- 013: Viết lại mô hình Affiliate (plan v2, docs/plan-aff-model-v2.md).
-- Chạy sau 012. Mỗi file chỉ chạy một lần. Chỉ thêm cột / nới ràng buộc, không xoá dữ liệu.
--  * 3 mô hình riêng: Vật lý (phys), Tools AI (tools_ai), SaaS (saas).
--  * Phí, thuế, chi phí cố định, quỹ cầu nối/dự phòng, cổng bằng chứng, nhịp test giai đoạn tìm winner.
--  * Vốn ngoài theo tháng, bản chụp số thực tế khi chốt tháng.
--  * Nối dự án OKR với đăng ký ở Research (ws_reg_id), checklist đủ điều kiện scale.
-- Tỷ giá, maxtest, ngưỡng ROAS, Click/Sale KHÔNG lưu ở đây: đọc từ Research (Cài đặt tính toán).

-- Cấu hình mô hình
alter table public.aff_config
  add column if not exists tools               jsonb   not null default '{}'::jsonb,   -- hệ số Tools AI
  add column if not exists goal_levels         jsonb   not null default '[16000, 50000, 120000]'::jsonb, -- 3 mức O năm ($/tháng)
  add column if not exists fee_pct             numeric not null default 5,     -- phí tài khoản Invoice, % chi tiêu ads
  add column if not exists tax_pct             numeric not null default 8,     -- thuế, %
  add column if not exists tax_base            text    not null default 'profit', -- thuế tính trên: profit (lợi nhuận) | received (thực nhận)
  add column if not exists fixed_cost_month    numeric not null default 0,     -- chi phí cố định / tháng
  add column if not exists bridge_pct          numeric not null default 15,    -- quỹ cầu nối chờ payout, % vốn vận hành
  add column if not exists reserve_pct         numeric not null default 10,    -- quỹ dự phòng, % vốn vận hành
  add column if not exists kickoff_tests_month int     not null default 60,    -- nhịp test / tháng khi chưa có winner
  add column if not exists gate1_profit        numeric not null default 1000,  -- mốc cổng ($ lợi nhuận đã nhận sau phí / tháng)
  add column if not exists gate2_profit        numeric not null default 2000,
  add column if not exists saas_unlock_gate    int     not null default 2,     -- cổng mở SaaS + Tools AI
  add column if not exists approval_warn_pct   numeric not null default 70;    -- % duyệt hoa hồng dưới mức này thì cảnh báo

alter table public.aff_config drop constraint if exists aff_config_v2_check;
alter table public.aff_config add constraint aff_config_v2_check check (
  fee_pct between 0 and 100 and tax_pct between 0 and 100 and tax_base in ('profit', 'received')
  and fixed_cost_month >= 0 and bridge_pct between 0 and 100 and reserve_pct between 0 and 100
  and kickoff_tests_month >= 0 and gate1_profit >= 0 and gate2_profit >= gate1_profit
  and saas_unlock_gate between 0 and 3 and approval_warn_pct between 0 and 100
  and jsonb_typeof(goal_levels) = 'array' and jsonb_typeof(tools) = 'object');

-- Bảng phân bổ theo tháng: thêm tỷ trọng Tools AI (SaaS = 100 − Vật lý − Tools AI), vốn ngoài, bản chụp số thực tế
alter table public.aff_months
  add column if not exists share_tools   numeric not null default 0,
  add column if not exists extra_capital numeric not null default 0,
  add column if not exists actuals       jsonb;
alter table public.aff_months drop constraint if exists aff_months_v2_check;
alter table public.aff_months add constraint aff_months_v2_check check (
  share_tools between 0 and 100 and share_phys + share_tools <= 100 and extra_capital >= 0);

-- Sổ dự án: thêm mô hình Tools AI, nối Research, checklist scale
alter table public.aff_projects drop constraint if exists aff_projects_model_check;
alter table public.aff_projects add constraint aff_projects_model_check check (model in ('phys', 'tools_ai', 'saas'));
alter table public.aff_projects
  add column if not exists ws_reg_id             bigint,                              -- id đăng ký ở Research
  add column if not exists scale_check           jsonb not null default '{}'::jsonb,  -- checklist đủ điều kiện scale
  add column if not exists scale_override_reason text  not null default '';           -- lý do scale khi chưa đủ điều kiện
create unique index if not exists aff_projects_ws_reg on public.aff_projects(user_id, ws_reg_id) where ws_reg_id is not null;

-- Số nhập tay theo đợt: thêm click (dùng cho cờ dừng theo click khi không có số Ads-Hub)
alter table public.aff_entries add column if not exists clicks int check (clicks >= 0);

-- Bộ đếm search: thêm Tools AI, đếm lý do loại
alter table public.aff_tallies drop constraint if exists aff_tallies_model_check;
alter table public.aff_tallies add constraint aff_tallies_model_check check (model in ('phys', 'tools_ai', 'saas'));
alter table public.aff_tallies add column if not exists reject_reasons jsonb not null default '{}'::jsonb;

-- KR/KA tự đếm: thêm Tools AI và 2 khoá mới (dự án đủ điều kiện scale, % duyệt). Khoá cũ giữ nguyên nghĩa.
alter table public.key_results drop constraint if exists key_results_aff_model_check;
alter table public.key_results add constraint key_results_aff_model_check check (aff_model in ('phys', 'tools_ai', 'saas'));
alter table public.key_results drop constraint if exists key_results_aff_metric_check;
alter table public.key_results add constraint key_results_aff_metric_check
  check (aff_metric in ('search', 'chon', 'dang_ky', 'duyet', 'test', 'win', 'profit', 'scale_ready', 'approval'));
alter table public.key_actions drop constraint if exists key_actions_aff_metric_check;
alter table public.key_actions add constraint key_actions_aff_metric_check
  check (aff_metric in ('search', 'chon', 'dang_ky', 'duyet', 'test', 'win', 'profit', 'scale_ready', 'approval'));
