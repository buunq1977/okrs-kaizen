-- 015: Nhãn "loại vì…" cho bộ đếm search (GĐ6, plan-aff-model-v2). Chạy sau 014. Chạy lại được.
--  * Chỉ thêm 1 cột vào aff_config: danh sách nhãn Luca sửa được ở Cài đặt → Mô hình Affiliate.
--  * Số lần loại theo nhãn lưu ở aff_tallies.reject_reasons (đã có từ 013): {"Hoa hồng thấp": 3, ...} theo ngày + mô hình.
alter table public.aff_config
  add column if not exists reject_labels jsonb not null
  default '["Hoa hồng thấp", "CPC cao, không hoà vốn", "Cấm chạy Ads / brand", "Payout rate thấp", "Trustpilot xấu", "Ít người tìm"]'::jsonb;
alter table public.aff_config drop constraint if exists aff_config_reject_labels_check;
alter table public.aff_config add constraint aff_config_reject_labels_check check (jsonb_typeof(reject_labels) = 'array' and jsonb_array_length(reject_labels) <= 12);
