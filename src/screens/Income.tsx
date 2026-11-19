import AffiliatePlan from '../components/aff/AffiliatePlan'

/** Mô hình thu nhập: Affiliate Global (nguồn thu chính).
 *  Phễu tự cấu hình (SPEC §9) đã bỏ khỏi app ngày 19/11/2026 theo yêu cầu Luca; bảng income_models vẫn giữ trong database.
 *  Khi có mô hình thu nhập mới sẽ làm lại theo nhu cầu lúc đó. */
export default function Income() {
  return (
    <div className="stack">
      <h1>Mô hình thu nhập</h1>
      <AffiliatePlan />
    </div>
  )
}
