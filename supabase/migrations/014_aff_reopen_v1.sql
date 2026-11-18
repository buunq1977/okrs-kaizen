-- 014: Bỏ hẳn mô hình Affiliate cũ (v1). Luca duyệt 18/11/2026: tính lại tháng đã chốt theo mô hình cũ bằng mô hình mới.
-- Chạy sau 013. Chạy lại được (lần 2 không đổi gì).
--  * Tháng đã chốt theo mô hình cũ = bản chụp hệ số không có "model_version". Mở lại tháng đó: xoá bản chụp + bỏ trạng thái chốt.
--  * Sau khi chạy, tháng đó tính theo mô hình mới như các tháng chưa chốt; Cài đặt sửa tự do cho tới khi chốt tháng đầu tiên theo mô hình mới.
--  * Không xoá dòng nào, không đổi ngân sách, tỷ trọng, mùa vụ, lợi nhuận mục tiêu đã nhập.

update public.aff_months
set coeffs = null, locked_at = null
where coeffs is not null and not (coeffs ? 'model_version');

-- Kiểm tra: phải còn 0 tháng chốt theo mô hình cũ
select count(*) as thang_mo_hinh_cu_con_lai
from public.aff_months
where coeffs is not null and not (coeffs ? 'model_version');
