// Cấu hình gắn với tài khoản (gom 1 chỗ). Mỗi giá trị đổi được bằng GitHub Secret cùng tên (build đọc từ biến VITE_*),
// không cần sửa code khi chuyển sang tài khoản khác — xem CAI-DAT-MOI.md bên repo ads-hub.
// Supabase của app (VITE_SUPABASE_URL / _ANON_KEY) và 2 nguồn số (VITE_WS_*, VITE_ADSHUB_*) đọc ở src/lib/supabase.ts.

/** Trang Workspace (Research, Ads-Hub, KQKD) — nút "← Workspace". */
export const WORKSPACE_URL = (import.meta.env.VITE_WORKSPACE_URL as string | undefined) || 'https://workspace.buunq.workers.dev'

/** Khoá CÔNG KHAI VAPID của Worker okrs-push (push-worker/wrangler.jsonc → VAPID_PUBLIC). Đổi khoá thì đổi cả 2 chỗ. */
export const VAPID_PUBLIC = (import.meta.env.VITE_VAPID_PUBLIC as string | undefined) || 'BKyQbGBc_rwgpCDhT4wONWLnlcr5QI3UQkMOVfsQhJkN4aFYihHA7BQpUrhxSPey-KZx0ssnopjDdyFUhSB72Hs'
