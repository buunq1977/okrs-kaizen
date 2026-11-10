-- 011: Nối OKR với Sổ dự án Affiliate: KR/KA tự đếm từ bộ đếm search và Sổ dự án.
-- Chạy sau 010. Mỗi file chỉ chạy một lần.

alter table public.key_results
  add column aff_metric text check (aff_metric in ('search','chon','dang_ky','duyet','test','win','profit')),
  add column aff_model  text check (aff_model in ('phys','saas'));   -- null = cả Vật lý + SaaS

alter table public.key_actions
  add column aff_metric text check (aff_metric in ('search','chon','dang_ky','duyet','test','win','profit')),
  add column aff_target numeric check (aff_target >= 0);
