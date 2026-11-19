/* Mở thẳng một tab của màn Mô hình thu nhập từ nơi khác trong app (lời nhắc "đăng nhập Research", "sửa hệ số"…).
   Gọi openIncomeTab(tab) rồi go('income'): nếu màn đang mở thì đổi tab ngay (sự kiện), nếu chưa thì tab được đọc khi màn mở. */
export type IncomeTab = 'plan' | 'config' | 'sources'
export const INCOME_TAB_EVENT = 'okr-income-tab'
const KEY = 'okr-income-tab'

export function openIncomeTab(tab: IncomeTab) {
  try {
    sessionStorage.setItem(KEY, tab)
  } catch {
    // trình duyệt chặn bộ nhớ phiên: vẫn đổi tab bằng sự kiện nếu màn đang mở
  }
  window.dispatchEvent(new CustomEvent<IncomeTab>(INCOME_TAB_EVENT, { detail: tab }))
}
export function takeIncomeTab(): IncomeTab | null {
  try {
    const v = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return v === 'plan' || v === 'config' || v === 'sources' ? v : null
  } catch {
    return null
  }
}
