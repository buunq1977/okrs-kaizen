import { useEffect, useState } from 'react'
import AffiliatePlan from '../components/aff/AffiliatePlan'
import AffSettings, { AffSources } from '../components/aff/AffSettings'
import { INCOME_TAB_EVENT, takeIncomeTab, type IncomeTab } from '../lib/incomeTab'

/** Mô hình thu nhập: kế hoạch Affiliate Global, cấu hình mô hình (hệ số, phí, cổng…) và kết nối nguồn số (Research + Ads-Hub).
 *  Phễu tự cấu hình (SPEC §9) đã bỏ khỏi app ngày 19/11/2026; bảng income_models vẫn giữ trong database.
 *  Cấu hình mô hình và kết nối chuyển từ Cài đặt sang đây ngày 19/11/2026 theo yêu cầu Luca. */
export default function Income() {
  const [tab, setTab] = useState<IncomeTab>(() => takeIncomeTab() ?? 'plan')
  useEffect(() => {
    const f = (e: Event) => setTab((e as CustomEvent<IncomeTab>).detail)
    window.addEventListener(INCOME_TAB_EVENT, f)
    return () => window.removeEventListener(INCOME_TAB_EVENT, f)
  }, [])
  const TABS: [IncomeTab, string][] = [
    ['plan', 'Kế hoạch Affiliate'],
    ['config', 'Cấu hình mô hình'],
    ['sources', 'Kết nối nguồn số'],
  ]
  return (
    <div className="stack">
      <h1>Mô hình thu nhập</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'plan' && <AffiliatePlan />}
      {tab === 'config' && <AffSettings />}
      {tab === 'sources' && <AffSources />}
    </div>
  )
}
